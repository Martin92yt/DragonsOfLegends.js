import { consola } from "consola";
import { InvalidDeathLossRateError } from "../types/error.js";
import { parseDuration } from "../utils/duration.js";
import type { InventoryItemRecord } from "../inventory/inventory.interface.js";
import { ItemRarity } from "../inventory/item.enum.js";
import type PlayerEntity from "./player.entity.js";

/**
 * Death item-loss configuration (`deathItemLoss` world option).
 */
export interface DeathItemLossOptions {
  /** Enables item loss on death (only applied by the `loose` death mode). */
  readonly enabled: boolean;
  /**
   * Protects equipped items from being lost.
   * @defaultValue true
   */
  readonly protectEquipped?: boolean;
  /**
   * Loss rate in percent (0-100) per rarity; missing rarities use {@link DEFAULT_DEATH_LOSS_RATES}.
   * A rate of 50 halves a stack; 100 removes it entirely.
   */
  readonly lossRates?: Readonly<Partial<Record<ItemRarity, number>>>;
}

/**
 * Fully resolved death item-loss configuration.
 */
export interface ResolvedDeathItemLossConfig {
  readonly enabled: boolean;
  readonly protectEquipped: boolean;
  readonly lossRates: Readonly<Record<ItemRarity, number>>;
}

/**
 * Describes a stack of items lost on death.
 */
export interface LostItem {
  readonly itemId: string;
  readonly name: string;
  readonly rarity: ItemRarity;
  /** Quantity lost from the stack. */
  readonly quantity: number;
}

export type DeathResult =
  | { mode: "hardcore"; deleted: boolean }
  | { mode: "cooldown"; cooldownTime: string | number; cooldownMs: number; respawnAt: number }
  | { mode: "loose"; lostGold: number; lostItems: LostItem[] }
  | { mode: "default"; revived: boolean };

/**
 * Default loss rate (percent) per rarity.
 */
// Rationale: the rarer the item, the heavier the loss, so risk grows with the value carried.
// Common consumables are barely affected (10%), epics are halved (50%) and legendaries are
// mostly lost (75%) while remaining recoverable, which keeps death punishing but not ruinous.
export const DEFAULT_DEATH_LOSS_RATES: Readonly<Record<ItemRarity, number>> = {
  [ItemRarity.Common]: 10,
  [ItemRarity.Uncommon]: 20,
  [ItemRarity.Rare]: 35,
  [ItemRarity.Epic]: 50,
  [ItemRarity.Legendary]: 75,
};

/**
 * Merges user options with defaults and validates every rate.
 *
 * @param options The user-provided options, if any.
 * @returns The resolved configuration.
 * @throws {InvalidDeathLossRateError} If a rate is not a finite number between 0 and 100.
 */
export function resolveDeathItemLossConfig(
  options?: DeathItemLossOptions,
): ResolvedDeathItemLossConfig {
  const lossRates: Record<ItemRarity, number> = { ...DEFAULT_DEATH_LOSS_RATES };

  for (const rarity of Object.values(ItemRarity)) {
    const customRate = options?.lossRates?.[rarity];
    if (customRate === undefined) continue;
    if (!Number.isFinite(customRate) || customRate < 0 || customRate > 100) {
      throw new InvalidDeathLossRateError(rarity, customRate);
    }
    lossRates[rarity] = customRate;
  }

  return {
    enabled: options?.enabled ?? false,
    protectEquipped: options?.protectEquipped ?? true,
    lossRates,
  };
}

/**
 * Computes how many units of a stack are lost.
 *
 * The fractional part of the expected loss is rolled probabilistically, so single items
 * (e.g. a rare sword at 35%) can still be lost instead of always rounding down to zero.
 *
 * @param quantity The stack size.
 * @param ratePercent The loss rate in percent.
 * @param random A random source returning a value in [0, 1).
 * @returns The quantity lost, between 0 and `quantity`.
 */
export function computeLostQuantity(
  quantity: number,
  ratePercent: number,
  random: () => number,
): number {
  const expectedLoss = (quantity * ratePercent) / 100;
  const guaranteedLoss = Math.floor(expectedLoss);
  const bonusLoss = random() < expectedLoss - guaranteedLoss ? 1 : 0;
  return Math.min(quantity, guaranteedLoss + bonusLoss);
}

/**
 * Applies the item-loss penalty to a dead player and persists the updated inventory.
 *
 * @param player The player who died.
 * @param config The resolved configuration.
 * @param random A random source returning a value in [0, 1). Defaults to `Math.random`.
 * @returns The list of lost stacks (empty if the feature is disabled or nothing was lost).
 */
export async function applyDeathItemLoss(
  player: PlayerEntity,
  config: ResolvedDeathItemLossConfig,
  random: () => number = Math.random,
): Promise<LostItem[]> {
  if (!config.enabled) return [];

  const inventoryItems: InventoryItemRecord[] =
    await player.inventory.getItems();
  const lostItems: LostItem[] = [];

  for (const inventoryItem of inventoryItems) {
    if (config.protectEquipped && inventoryItem.isEquipped) continue;

    const lostQuantity = computeLostQuantity(
      inventoryItem.quantity,
      config.lossRates[inventoryItem.rarity],
      random,
    );
    if (lostQuantity <= 0) continue;

    inventoryItem.quantity -= lostQuantity;
    lostItems.push({
      itemId: inventoryItem.itemId,
      name: inventoryItem.name,
      rarity: inventoryItem.rarity,
      quantity: lostQuantity,
    });
  }

  if (lostItems.length > 0) {
    // Single save of the whole inventory (empty stacks removed) instead of N remove() calls.
    await player.inventory.save(
      inventoryItems.filter((inventoryItem) => inventoryItem.quantity > 0),
    );
    consola.info(
      `🎒 ${player.name} lost ${lostItems.length} item stack(s) on death.`,
    );
  }

  return lostItems;
}

/**
 * Handles the death mechanics of a player based on world configuration options.
 *
 * @param player The player entity that has died.
 * @returns The result of the death processing.
 * @throws {InvalidDeathLossRateError} If the `deathItemLoss` configuration contains an invalid rate.
 */
export async function handlePlayerDeath(
  player: PlayerEntity,
): Promise<DeathResult> {
  const worldOptions = player.worldInstance.initializationOptions;
  const deathMode = worldOptions.deathMode ?? "cooldown";

  consola.warn(`💀 Player ${player.name} has died! Death Mode: ${deathMode}`);
  player.worldInstance.combat.clear(player.id);

  switch (deathMode) {
    case "hardcore": {
      // The in-memory instance stays locked forever: any action attempted through a stale reference is refused.
      player.life.killPermanently();
      consola.error(
        `🔥 Hardcore death: ${player.name} has lost everything permanently.`,
      );
      await player.worldInstance.events.emitAsync("playerDeath", { playerId: player.id, player, mode: "hardcore", locationId: player.location });
      // Pas de save() après delete() : il recréerait le joueur supprimé en base.
      await player.worldInstance.players.delete(player.id);
      return { mode: "hardcore", deleted: true };
    }

    case "cooldown": {
      const cooldownTime = worldOptions.deathCooldown ?? "1m";
      const cooldownMs = parseDuration(cooldownTime);
      // From now on, every player action is refused until `respawnAt` (see PlayerLife.assertCanAct).
      const respawnAt = player.life.die(cooldownMs);
      consola.info(
        `⏳ ${player.name} is dead and resting. Cooldown: ${cooldownTime}`,
      );
      // Persisted right away so the lock survives a restart or an eviction from the cache.
      await player.worldInstance.players.save(player);
      await player.worldInstance.events.emitAsync("playerDeath", { playerId: player.id, player, mode: "cooldown", locationId: player.location, respawnAt });
      return { mode: "cooldown", cooldownTime, cooldownMs, respawnAt };
    }

    case "loose": {
      const penaltyRate = worldOptions.deathPenaltyRate ?? 5; // ex: 5%
      const lostGold = Math.floor(player.gold * (penaltyRate / 100));

      player.gold = Math.max(0, player.gold - lostGold);
      player.health.current = player.health.max; // Réanimation directe avec pénalité

      const lostItems = await applyDeathItemLoss(
        player,
        resolveDeathItemLossConfig(worldOptions.deathItemLoss),
      );

      consola.info(
        `💸 Loose death: ${player.name} lost ${lostGold} gold (${penaltyRate}% penalty) and ${lostItems.length} item stack(s).`,
      );
      await player.worldInstance.players.save(player);
      await player.worldInstance.events.emitAsync("playerDeath", { playerId: player.id, player, mode: "loose", locationId: player.location, lostGold, lostItems });
      return { mode: "loose", lostGold, lostItems };
    }

    default: {
      player.health.current = player.health.max;
      return { mode: "default", revived: true };
    }
  }
}
