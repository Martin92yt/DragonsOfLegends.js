import type ItemRegistry from "../inventory/item.registry.js";
import { isItemRarity, ItemRarity } from "../inventory/item.enum.js";
import Registry from "../registry/registry.js";
import { InvalidRegistryEntryError } from "../types/error.js";
import type PlayerEntity from "../player/player.entity.js";
import { computeDropChances, pickDrop, rollInRange } from "./lootbox.rules.js";
import type { LootboxDefinition, LootboxDrop, LootboxDropChance, LootboxOpenResult, LootboxRewardResult, OpenLootboxOptions } from "./lootbox.types.js";

/**
 * Registry of the lootboxes (mystery pouches) of a world, and the way to open them.
 *
 * Built on the generic {@link Registry}: lootboxes are never hard-coded, the official ones are a content pack
 * and third parties register theirs the same way (`register`, `bulkRegister`, `{ override: true }`...).
 */
export default class LootboxManager extends Registry<LootboxDefinition> {
    /**
     * Creates an empty lootbox registry.
     *
     * @param items The item registry the drops are resolved against (a drop must reference a registered item).
     * @returns void
     */
    public constructor(private readonly items: ItemRegistry) {
        super({
            kind: "lootbox",
            idOf: (definition) => definition.id,
            validate: (definition) => LootboxManager.validate(definition, items)
        });
    }

    /**
     * Computes the probability of every drop of a lootbox.
     *
     * @param lootboxId The lootbox identifier.
     * @param luckPercent The luck in percent (boosts the rare drops).
     * @returns The drops with their probability for one roll; they sum to 1.
     * @throws {UnknownRegistryEntryError} If the lootbox is not registered.
     */
    public getDropChances(lootboxId: string, luckPercent = 0): LootboxDropChance[] {
        return computeDropChances(this.require(lootboxId).drops, luckPercent, (drop) => this.rarityOf(drop));
    }

    /**
     * Opens a lootbox for a player: rolls the loot table and grants the rewards (gold to the wallet, items to the inventory).
     * It does not take anything from the player: to consume a lootbox item, use `player.inventory.use(itemId)`.
     *
     * @param player The player receiving the rewards.
     * @param lootboxId The lootbox identifier.
     * @param options The opening options.
     * @returns The rewards obtained.
     * @throws {UnknownRegistryEntryError} If the lootbox (or one of its items) is not registered.
     * @throws {PlayerDeadError} If the player is dead.
     */
    public async open(player: PlayerEntity, lootboxId: string, options: OpenLootboxOptions = {}): Promise<LootboxOpenResult> {
        player.assertCanAct("lootbox.open");
        const lootbox = this.require(lootboxId);
        const random = options.random ?? Math.random;
        const luckPercent = options.luckPercent ?? (await player.getModifiers()).luckPercent;

        const rewards: LootboxRewardResult[] = [];
        for (let roll = 0; roll < (lootbox.rolls ?? 1); roll++) {
            const drop = pickDrop(lootbox.drops, luckPercent, (candidate) => this.rarityOf(candidate), random);
            if (drop) rewards.push(await this.grant(player, drop, random));
        }

        const gold = rewards.reduce((sum, reward) => sum + (reward.kind === "gold" ? reward.amount : 0), 0);
        const result: LootboxOpenResult = { lootboxId, rarity: lootbox.rarity, rewards, gold, luckPercent };
        await player.worldInstance.events.emitAsync("lootboxOpen", { playerId: player.id, player, result });
        return result;
    }

    private async grant(player: PlayerEntity, drop: LootboxDrop, random: () => number): Promise<LootboxRewardResult> {
        if (drop.kind === "gold") {
            const amount = rollInRange(drop.minAmount, drop.maxAmount, random);
            player.gold += amount;
            return { kind: "gold", amount };
        }

        const item = this.items.require(drop.itemId);
        const quantity = rollInRange(drop.minQuantity, drop.maxQuantity, random);
        await player.inventory.add(item, quantity, drop.nbt ?? null);
        return { kind: "item", item, quantity };
    }

    private rarityOf(drop: LootboxDrop): ItemRarity {
        if (drop.rarity !== undefined) return drop.rarity;
        return drop.kind === "item" ? (this.items.get(drop.itemId)?.rarity ?? ItemRarity.Common) : ItemRarity.Common;
    }

    private static validate(definition: LootboxDefinition, items: ItemRegistry): void {
        const fail = (reason: string): never => {
            throw new InvalidRegistryEntryError("lootbox", `"${definition.id}": ${reason}`);
        };
        if (definition.id.trim() === "") throw new InvalidRegistryEntryError("lootbox", "the identifier must not be empty.");
        if (definition.name.trim() === "") fail("a name is required.");
        if (!isItemRarity(definition.rarity)) fail(`unknown rarity "${String(definition.rarity)}".`);
        if (definition.rolls !== undefined && (!Number.isInteger(definition.rolls) || definition.rolls < 1)) fail("rolls must be a positive integer.");
        if (definition.drops.length === 0) fail("at least one drop is required.");

        for (const drop of definition.drops) {
            if (!(Number.isFinite(drop.weight) && drop.weight > 0)) fail("every drop needs a positive weight.");
            if (drop.rarity !== undefined && !isItemRarity(drop.rarity)) fail(`unknown drop rarity "${String(drop.rarity)}".`);

            if (drop.kind === "gold") {
                if (!Number.isInteger(drop.minAmount) || !Number.isInteger(drop.maxAmount) || drop.minAmount < 1 || drop.maxAmount < drop.minAmount) {
                    fail("a gold drop needs integer amounts with 1 <= minAmount <= maxAmount.");
                }
            } else if (drop.kind === "item") {
                if (!Number.isInteger(drop.minQuantity) || !Number.isInteger(drop.maxQuantity) || drop.minQuantity < 1 || drop.maxQuantity < drop.minQuantity) {
                    fail(`the drop of "${drop.itemId}" needs integer quantities with 1 <= minQuantity <= maxQuantity.`);
                }
                if (!items.has(drop.itemId)) fail(`the drop references the unregistered item "${drop.itemId}" (register the item first, in the same pack or a dependency).`);
            } else {
                fail(`unknown drop kind "${String((drop as { kind?: unknown }).kind)}".`);
            }
        }
    }
}
