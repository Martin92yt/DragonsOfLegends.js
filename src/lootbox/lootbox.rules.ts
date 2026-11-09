import { ItemRarity } from "../inventory/item.enum.js";
import { RARITY_LUCK_FACTORS } from "../jobs/job.rules.js";
import type { LootboxDrop, LootboxDropChance } from "./lootbox.types.js";

/**
 * Resolves the rarity that luck uses to boost a drop.
 */
export type DropRarityResolver = (drop: LootboxDrop) => ItemRarity;

/**
 * Computes the effective weight of every drop: luck boosts the weight of rare drops only
 * (`luck / 100 * RARITY_LUCK_FACTORS[rarity]`, the same curve as the job loot), so common drops are never boosted.
 *
 * @param drops The loot table.
 * @param luckPercent The luck in percent (negative values are ignored).
 * @param rarityOf Resolves the rarity of a drop.
 * @returns The effective weights, in the order of the drops.
 */
export function computeDropWeights(drops: readonly LootboxDrop[], luckPercent: number, rarityOf: DropRarityResolver): number[] {
    const luck = Math.max(luckPercent, 0);
    return drops.map((drop) => drop.weight * (1 + (luck / 100) * RARITY_LUCK_FACTORS[rarityOf(drop)]));
}

/**
 * Computes the probability of every drop of a loot table.
 *
 * @param drops The loot table.
 * @param luckPercent The luck in percent.
 * @param rarityOf Resolves the rarity of a drop.
 * @returns The probabilities, in the order of the drops; they sum to 1.
 */
export function computeDropChances(drops: readonly LootboxDrop[], luckPercent: number, rarityOf: DropRarityResolver): LootboxDropChance[] {
    const weights = computeDropWeights(drops, luckPercent, rarityOf);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return drops.map((drop, index) => ({ drop, chance: total > 0 ? (weights[index] ?? 0) / total : 0 }));
}

/**
 * Picks one drop by weighted random, boosted by luck.
 *
 * @param drops The loot table.
 * @param luckPercent The luck in percent.
 * @param rarityOf Resolves the rarity of a drop.
 * @param random A random source in [0, 1).
 * @returns The picked drop, or undefined if the table is empty.
 */
export function pickDrop(drops: readonly LootboxDrop[], luckPercent: number, rarityOf: DropRarityResolver, random: () => number = Math.random): LootboxDrop | undefined {
    const weights = computeDropWeights(drops, luckPercent, rarityOf);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return undefined;

    let threshold = random() * total;
    for (const [index, drop] of drops.entries()) {
        threshold -= weights[index] ?? 0;
        if (threshold < 0) return drop;
    }
    return drops[drops.length - 1];
}

/**
 * Rolls an integer between two bounds (inclusive).
 *
 * @param minimum The lower bound.
 * @param maximum The upper bound (>= minimum).
 * @param random A random source in [0, 1).
 * @returns An integer between `minimum` and `maximum`.
 */
export function rollInRange(minimum: number, maximum: number, random: () => number = Math.random): number {
    return minimum + Math.floor(random() * (maximum - minimum + 1));
}
