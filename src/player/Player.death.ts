import { InvalidDeathLossRateError } from "../types/error.js";
import { parseDuration } from "../utils/duration.js";
import type { InventoryItemRecord } from "../inventory/inventory.interface.js";
import { ItemRarity } from "../inventory/item.enum.js";
import type PlayerEntity from "./player.entity.js";
import { createLogger } from "../utils/logger.js";
const log = createLogger("death");


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
  | { mode: "default"; revived: boolean }
  /** A `playerDeath` listener cancelled the death: the player survives with `survivalHealth` health points. */
  | { mode: "cancelled"; survivalHealth: number; reason?: string };

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
 * A stack the death will take items from, planned before the `playerDeath` event so listeners can see it.
 */
interface PlannedStackLoss {
  readonly item: LostItem;
  readonly equipped: boolean;
  /** Serialized item data of the stack, to take from the same stack when the loss is committed. */
  readonly nbtKey: string;
}

const nbtKeyOf = (record: InventoryItemRecord): string => JSON.stringify(record.itemNbtData ?? null);

/**
 * Computes which stacks the death would take items from, without changing anything.
 *
 * @param player The player who is about to die.
 * @param config The resolved configuration.
 * @param random A random source returning a value in [0, 1).
 * @returns The planned losses (empty if the feature is disabled or nothing would be lost).
 */
async function planDeathItemLoss(
  player: PlayerEntity,
  config: ResolvedDeathItemLossConfig,
  random: () => number,
): Promise<PlannedStackLoss[]> {
  if (!config.enabled) return [];

  const planned: PlannedStackLoss[] = [];
  for (const inventoryItem of await player.inventory.getItems()) {
    if (config.protectEquipped && inventoryItem.isEquipped) continue;

    const lostQuantity = computeLostQuantity(
      inventoryItem.quantity,
      config.lossRates[inventoryItem.rarity],
      random,
    );
    if (lostQuantity <= 0) continue;

    planned.push({
      item: {
        itemId: inventoryItem.itemId,
        name: inventoryItem.name,
        rarity: inventoryItem.rarity,
        quantity: lostQuantity,
      },
      equipped: inventoryItem.isEquipped === true,
      nbtKey: nbtKeyOf(inventoryItem),
    });
  }
  return planned;
}

/**
 * Takes the planned quantities from the *current* inventory and persists it.
 * The inventory is read again here: a `playerDeath` listener may have changed it since the plan was made.
 */
async function commitDeathItemLoss(
  player: PlayerEntity,
  planned: readonly PlannedStackLoss[],
): Promise<void> {
  if (planned.length === 0) return;

  const records: InventoryItemRecord[] = await player.inventory.getItems();
  for (const { item, equipped, nbtKey } of planned) {
    let remaining = item.quantity;
    // Same stack first (same item data), then any stack of the item in the same equipped state.
    const passes: Array<(record: InventoryItemRecord) => boolean> = [
      (record) => nbtKeyOf(record) === nbtKey,
      () => true,
    ];
    for (const accepts of passes) {
      for (const record of records) {
        if (remaining <= 0) break;
        if (record.itemId !== item.itemId || (record.isEquipped === true) !== equipped || !accepts(record)) continue;
        const taken = Math.min(record.quantity, remaining);
        record.quantity -= taken;
        remaining -= taken;
      }
    }
  }

  // Single save of the whole inventory (empty stacks removed) instead of N remove() calls.
  await player.inventory.save(records.filter((record) => record.quantity > 0));
  log.info(`🎒 ${player.name} lost ${planned.length} item stack(s) on death.`);
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
  const planned = await planDeathItemLoss(player, config, random);
  await commitDeathItemLoss(player, planned);
  return planned.map(({ item }) => item);
}

/**
 * Handles the death mechanics of a player based on world configuration options.
 *
 * The death is resolved in three steps: the consequences are *planned* (respawn time, gold and items that would be
 * lost), the cancellable `playerDeath` event is emitted, then the consequences are *applied* unless a listener
 * cancelled the event. A cancelled death leaves the player alive with `survivalHealth` health points (1 by default).
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
  const { events, combat, players } = player.worldInstance;

  log.warn(`💀 Player ${player.name} has died! Death Mode: ${deathMode}`);

  if (deathMode !== "hardcore" && deathMode !== "cooldown" && deathMode !== "loose") {
    // Unknown mode: immediate revival, no event (there is no consequence to cancel).
    combat.clear(player.id);
    player.health.current = player.health.max;
    return { mode: "default", revived: true };
  }

  // 1. Plan: compute what the death would do, without changing anything.
  const cooldownTime = worldOptions.deathCooldown ?? "1m";
  const cooldownMs = deathMode === "cooldown" ? parseDuration(cooldownTime) : 0;
  const plannedRespawnAt = deathMode === "cooldown" ? Date.now() + cooldownMs : undefined;
  const penaltyRate = worldOptions.deathPenaltyRate ?? 5; // ex: 5%
  const plannedGoldLoss = deathMode === "loose" ? Math.floor(player.gold * (penaltyRate / 100)) : undefined;
  const plannedItemLoss = deathMode === "loose"
    ? await planDeathItemLoss(player, resolveDeathItemLossConfig(worldOptions.deathItemLoss), Math.random)
    : [];

  // 2. Ask the listeners: nothing has been applied yet, so a cancellation leaves the player untouched.
  const event = await events.emitCancellable("playerDeath", {
    playerId: player.id,
    player,
    mode: deathMode,
    locationId: player.location,
    ...(plannedRespawnAt !== undefined ? { respawnAt: plannedRespawnAt } : {}),
    ...(plannedGoldLoss !== undefined ? { lostGold: plannedGoldLoss, lostItems: plannedItemLoss.map(({ item }) => item) } : {}),
    survivalHealth: 1,
  });

  if (event.isCancelled) {
    const requested = Number.isFinite(event.survivalHealth) ? Math.floor(event.survivalHealth) : 1;
    const survivalHealth = Math.min(player.health.max, Math.max(1, requested));
    player.health.current = survivalHealth;
    log.info(
      `🛡️ Death of ${player.name} cancelled${event.cancelReason ? ` (${event.cancelReason})` : ""}: survives with ${survivalHealth} health.`,
    );
    return {
      mode: "cancelled",
      survivalHealth,
      ...(event.cancelReason !== undefined ? { reason: event.cancelReason } : {}),
    };
  }

  // 3. Apply.
  combat.clear(player.id);

  switch (deathMode) {
    case "hardcore": {
      // The in-memory instance stays locked forever: any action attempted through a stale reference is refused.
      player.life.killPermanently();
      log.error(
        `🔥 Hardcore death: ${player.name} has lost everything permanently.`,
      );
      // Pas de save() après delete() : il recréerait le joueur supprimé en base.
      await players.delete(player.id);
      return { mode: "hardcore", deleted: true };
    }

    case "cooldown": {
      // From now on, every player action is refused until `respawnAt` (see PlayerLife.assertCanAct).
      const respawnAt = player.life.die(Math.max(0, (plannedRespawnAt ?? Date.now()) - Date.now()));
      log.info(
        `⏳ ${player.name} is dead and resting. Cooldown: ${cooldownTime}`,
      );
      // Persisted right away so the lock survives a restart or an eviction from the cache.
      await players.save(player);
      return { mode: "cooldown", cooldownTime, cooldownMs, respawnAt };
    }

    case "loose": {
      const lostGold = Math.min(player.gold, plannedGoldLoss ?? 0);
      player.gold = Math.max(0, player.gold - lostGold);
      player.health.current = player.health.max; // Réanimation directe avec pénalité

      await commitDeathItemLoss(player, plannedItemLoss);

      log.info(
        `💸 Loose death: ${player.name} lost ${lostGold} gold (${penaltyRate}% penalty) and ${plannedItemLoss.length} item stack(s).`,
      );
      await players.save(player);
      return { mode: "loose", lostGold, lostItems: plannedItemLoss.map(({ item }) => item) };
    }
  }
}
