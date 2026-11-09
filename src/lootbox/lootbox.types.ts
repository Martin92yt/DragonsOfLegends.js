import type { Item, ItemNBT } from "../inventory/inventory.interface.js";
import type { ItemRarity } from "../inventory/item.enum.js";

/**
 * A drop of a lootbox granting gold.
 */
export interface LootboxGoldDrop {
    readonly kind: "gold";
    /** Relative weight (> 0): higher means more frequent. */
    readonly weight: number;
    /** Minimum amount of gold (integer >= 1). */
    readonly minAmount: number;
    /** Maximum amount of gold (integer >= minAmount). */
    readonly maxAmount: number;
    /** Rarity used by luck to boost the drop. @defaultValue `common` (never boosted) */
    readonly rarity?: ItemRarity;
}

/**
 * A drop of a lootbox granting items (equipment, amulets, consumables...).
 */
export interface LootboxItemDrop {
    readonly kind: "item";
    /** Identifier of an item of the item registry. */
    readonly itemId: string;
    /** Relative weight (> 0): higher means more frequent. */
    readonly weight: number;
    /** Minimum quantity (integer >= 1). */
    readonly minQuantity: number;
    /** Maximum quantity (integer >= minQuantity). */
    readonly maxQuantity: number;
    /** Item data attached to the granted item (defaults to the `defaultNbt` of the item). */
    readonly nbt?: ItemNBT;
    /** Rarity used by luck to boost the drop. @defaultValue the rarity of the item */
    readonly rarity?: ItemRarity;
}

/**
 * An entry of the weighted loot table of a lootbox.
 */
export type LootboxDrop = LootboxGoldDrop | LootboxItemDrop;

/**
 * Definition of a lootbox (mystery pouch), fully configurable by the game developer.
 *
 * Open it with `world.lootboxes.open(player, id)`, or give the player an item whose `use.lootbox` is its identifier.
 */
export interface LootboxDefinition {
    /** Unique identifier (e.g. `"common"`, `"mypack:dragon_hoard"`). */
    readonly id: string;
    /** Display name. */
    readonly name: string;
    readonly description?: string;
    /** Rarity tier of the lootbox (`common`, `uncommon`, `rare`, `epic`, `legendary`). */
    readonly rarity: ItemRarity;
    /** Number of rolls in the loot table per opening. @defaultValue 1 */
    readonly rolls?: number;
    /** The weighted loot table (at least one drop). */
    readonly drops: readonly LootboxDrop[];
}

/**
 * A reward obtained by a lootbox roll.
 */
export type LootboxRewardResult =
    | { readonly kind: "gold"; readonly amount: number }
    | { readonly kind: "item"; readonly item: Item; readonly quantity: number };

/**
 * Result of the opening of a lootbox.
 */
export interface LootboxOpenResult {
    readonly lootboxId: string;
    readonly rarity: ItemRarity;
    readonly rewards: readonly LootboxRewardResult[];
    /** Total gold granted by the rewards. */
    readonly gold: number;
    /** The luck (in percent) that was applied to the loot table. */
    readonly luckPercent: number;
}

/**
 * Probability of a drop of a loot table.
 */
export interface LootboxDropChance {
    readonly drop: LootboxDrop;
    /** Probability of the drop for one roll, between 0 and 1 (the chances of a table sum to 1). */
    readonly chance: number;
}

/**
 * Options of `LootboxManager.open`.
 */
export interface OpenLootboxOptions {
    /** Random source in [0, 1) (defaults to `Math.random`); handy for deterministic tests. */
    readonly random?: () => number;
    /** Overrides the luck of the player (in percent), `0` to ignore it. @defaultValue the luck of the player */
    readonly luckPercent?: number;
}
