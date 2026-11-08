import type { InventoryItemRecord } from "../inventory/inventory.interface.js";
import { ItemRarity } from "../inventory/item.enum.js";
import {
    DEFAULT_JOB_MAX_LEVEL,
    DEFAULT_JOB_XP_CURVE,
    JOB_TOOL_NBT_KEYS,
    JobActionDefinition,
    JobDefinition,
    JobLootEntry,
    MAX_COOLDOWN_REDUCTION_PERCENT,
    ToolModifiers
} from "./job.types.js";

/**
 * How much luck boosts the weight of loot, by rarity (multiplied by `luck / 100`).
 */
// Rationale: luck must favour *better* catches, so common loot is never boosted while each rarity
// tier is boosted more than the previous one (Luck +10% makes a rare entry 20% more likely, a legendary 40%).
export const RARITY_LUCK_FACTORS: Readonly<Record<ItemRarity, number>> = {
    [ItemRarity.Common]: 0,
    [ItemRarity.Uncommon]: 1,
    [ItemRarity.Rare]: 2,
    [ItemRarity.Epic]: 3,
    [ItemRarity.Legendary]: 4
};

/** Modifiers of a player without tool. */
export const NO_TOOL_MODIFIERS: ToolModifiers = { luck: 0, xpBonus: 0, cooldownReduction: 0, yieldBonus: 0 };

/**
 * Gets the maximum level of a job.
 *
 * @param job The job definition.
 * @returns The maximum level.
 */
export function getMaxLevel(job: JobDefinition): number {
    return job.maxLevel ?? DEFAULT_JOB_MAX_LEVEL;
}

/**
 * Computes the experience required to leave a level.
 *
 * @param job The job definition.
 * @param level The current level (>= 1).
 * @returns The experience required to reach `level + 1`.
 */
export function xpRequiredForLevel(job: JobDefinition, level: number): number {
    const { base, growth } = job.xpCurve ?? DEFAULT_JOB_XP_CURVE;
    return Math.max(1, Math.floor(base * growth ** (level - 1)));
}

/**
 * Computes the effective cooldown of an action.
 *
 * @param action The action definition.
 * @param modifiers The tool modifiers.
 * @returns The cooldown in milliseconds.
 */
export function effectiveCooldownMs(action: JobActionDefinition, modifiers: ToolModifiers): number {
    const reduction = Math.min(Math.max(modifiers.cooldownReduction, 0), MAX_COOLDOWN_REDUCTION_PERCENT);
    // Integer percent arithmetic avoids floating-point drift (10000 * (1 - 0.9) = 999.99…).
    return Math.floor((action.cooldownMs * (100 - reduction)) / 100);
}

/**
 * Reads the modifiers of a tool record, ignoring malformed values.
 *
 * @param record The tool record, or undefined.
 * @returns The tool modifiers (all zero without tool).
 */
export function readToolModifiers(record: InventoryItemRecord | undefined): ToolModifiers {
    const nbt = record?.itemNbtData;
    if (!nbt) return NO_TOOL_MODIFIERS;

    const read = (key: string): number => {
        const value: unknown = nbt[key];
        return typeof value === "number" && Number.isFinite(value) ? value : 0;
    };
    return {
        luck: read(JOB_TOOL_NBT_KEYS.luck),
        xpBonus: read(JOB_TOOL_NBT_KEYS.xpBonus),
        cooldownReduction: read(JOB_TOOL_NBT_KEYS.cooldownReduction),
        yieldBonus: read(JOB_TOOL_NBT_KEYS.yieldBonus)
    };
}

/**
 * Picks one loot entry by weighted random, boosted by luck.
 *
 * @param entries The eligible entries.
 * @param luck The luck modifier in percent.
 * @param random A random source in [0, 1).
 * @returns The picked entry, or undefined if there is none.
 */
export function pickLootEntry(entries: readonly JobLootEntry[], luck: number, random: () => number = Math.random): JobLootEntry | undefined {
    const weights = entries.map((entry) => entry.weight * (1 + (Math.max(luck, 0) / 100) * RARITY_LUCK_FACTORS[entry.item.rarity]));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return undefined;

    let threshold = random() * total;
    for (const [index, entry] of entries.entries()) {
        threshold -= weights[index] ?? 0;
        if (threshold < 0) return entry;
    }
    return entries[entries.length - 1];
}

/**
 * Rolls a quantity between the bounds of an entry.
 *
 * @param entry The loot entry.
 * @param random A random source in [0, 1).
 * @returns An integer between `minQuantity` and `maxQuantity` (inclusive).
 */
export function rollQuantity(entry: JobLootEntry, random: () => number = Math.random): number {
    return entry.minQuantity + Math.floor(random() * (entry.maxQuantity - entry.minQuantity + 1));
}

/**
 * Applies a tool yield bonus to a rolled quantity.
 * The fractional part of the boosted quantity is resolved by chance, so a +25% yield on 1 item
 * gives 1 item 75% of the time and 2 items 25% of the time (25% more items on average).
 *
 * @param quantity The rolled quantity (>= 0).
 * @param yieldBonus The yield bonus in percent (negative values are ignored).
 * @param random A random source in [0, 1).
 * @returns The boosted integer quantity.
 */
export function applyYield(quantity: number, yieldBonus: number, random: () => number = Math.random): number {
    if (yieldBonus <= 0) return quantity;
    const boosted = quantity * (1 + yieldBonus / 100);
    const whole = Math.floor(boosted);
    return whole + (random() < boosted - whole ? 1 : 0);
}
