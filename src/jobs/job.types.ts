import type { InventoryItemRecord, Item, ItemNBT } from "../inventory/inventory.interface.js";

/**
 * Default maximum level of a job.
 */
export const DEFAULT_JOB_MAX_LEVEL = 50;

/**
 * Experience curve of a job: the experience required to leave level `n` is `floor(base * growth^(n - 1))`.
 */
export interface JobXpCurve {
    readonly base: number;
    readonly growth: number;
}

/**
 * Default experience curve.
 */
// Rationale: 100 XP for the first level then +25% per level keeps early levels quick (a handful of
// actions) while the late game requires a real commitment (level 20 needs ~7,000 XP for one level).
export const DEFAULT_JOB_XP_CURVE: JobXpCurve = { base: 100, growth: 1.25 };

/**
 * A loot entry of a job action.
 */
export interface JobLootEntry {
    /** The item granted. Its rarity drives how much luck boosts the entry. */
    readonly item: Item;
    /** Relative weight (> 0): higher means more frequent. */
    readonly weight: number;
    /** Minimum quantity (integer >= 1). */
    readonly minQuantity: number;
    /** Maximum quantity (integer >= minQuantity). */
    readonly maxQuantity: number;
    /** Minimum job level to obtain this entry. @defaultValue 1 */
    readonly minLevel?: number;
    /** Item data attached to the granted item. */
    readonly nbt?: ItemNBT;
}

/**
 * A reward granted when a job level is reached.
 */
export type JobReward =
    | { readonly kind: "gold"; readonly amount: number }
    | { readonly kind: "item"; readonly item: Item; readonly quantity: number; readonly nbt?: ItemNBT };

/**
 * Rewards granted when a given level is reached.
 */
export interface JobLevelReward {
    /** The level (2 to the job maximum level). */
    readonly level: number;
    readonly rewards: readonly JobReward[];
}

/**
 * An action a player can perform for a job (e.g. `fish`).
 */
export interface JobActionDefinition {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    /** Base cooldown in milliseconds (>= 0). */
    readonly cooldownMs: number;
    /** Base experience granted per action (>= 0). */
    readonly xp: number;
    /** Minimum job level to perform the action. @defaultValue 1 */
    readonly requiredLevel?: number;
    /** Requires an equipped tool. @defaultValue false */
    readonly requiresTool?: boolean;
    /** Number of loot rolls per action. @defaultValue 1 */
    readonly rolls?: number;
    readonly loot: readonly JobLootEntry[];
}

/**
 * Definition of a job, fully configurable by the game developer.
 */
export interface JobDefinition {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    /** @defaultValue {@link DEFAULT_JOB_MAX_LEVEL} */
    readonly maxLevel?: number;
    /** @defaultValue {@link DEFAULT_JOB_XP_CURVE} */
    readonly xpCurve?: JobXpCurve;
    readonly actions: readonly JobActionDefinition[];
    readonly levelRewards?: readonly JobLevelReward[];
}

/**
 * Stat modifiers of a job tool, in percent.
 */
export interface ToolModifiers {
    /** Boosts the weight of rare loot (`Luck +10%`). */
    readonly luck: number;
    /** Bonus experience. */
    readonly xpBonus: number;
    /** Cooldown reduction (capped, see {@link MAX_COOLDOWN_REDUCTION_PERCENT}). */
    readonly cooldownReduction: number;
    /** Extra quantity on every loot roll (`Yield +25%`); fractions are resolved by chance. */
    readonly yieldBonus: number;
}

/**
 * Keys used in the item data of a job tool.
 */
export const JOB_TOOL_NBT_KEYS = {
    jobId: "toolJobId",
    luck: "luckBonus",
    xpBonus: "xpBonusPercent",
    cooldownReduction: "cooldownReductionPercent",
    yieldBonus: "yieldBonusPercent"
} as const;

/**
 * Maximum cooldown reduction a tool can grant, in percent.
 */
// Rationale: capping at 90% prevents stacked bonuses from removing the cooldown entirely.
export const MAX_COOLDOWN_REDUCTION_PERCENT = 90;

/**
 * Persistent progress of a player in a job.
 */
export interface JobProgressState {
    level: number;
    xp: number;
    /** Identifier of the equipped tool item, or an empty string. */
    equippedToolItemId: string;
    /** Timestamp (ms) of the last execution of each action. */
    lastActionAt: Record<string, number>;
}

/**
 * Persistent jobs of a player, keyed by job identifier.
 */
export type PlayerJobsState = Record<string, JobProgressState>;

/**
 * Display view of the progress in a job.
 */
export interface JobProgressView {
    readonly jobId: string;
    readonly name: string;
    readonly level: number;
    readonly maxLevel: number;
    readonly xp: number;
    /** Experience required to reach the next level; 0 at the maximum level. */
    readonly xpToNextLevel: number;
    /** Progress towards the next level, 0 to 100 (100 at the maximum level). */
    readonly percent: number;
    readonly equippedToolItemId: string;
}

/**
 * An item obtained by a job action.
 */
export interface JobLootResult {
    readonly item: Item;
    readonly quantity: number;
}

/**
 * Result of a job action.
 */
export interface JobActionResult {
    readonly jobId: string;
    readonly actionId: string;
    readonly loot: readonly JobLootResult[];
    readonly xpGained: number;
    readonly previousLevel: number;
    readonly level: number;
    /** Rewards granted for the levels reached by this action. */
    readonly rewards: readonly JobReward[];
    /** The effective cooldown applied (after tool reductions), in milliseconds. */
    readonly cooldownMs: number;
    /** Timestamp (ms) from which the action can be performed again. */
    readonly nextAvailableAt: number;
    readonly toolModifiers: ToolModifiers;
}

/**
 * Builds the item data of a job tool.
 *
 * @param jobId The job the tool belongs to.
 * @param modifiers The stat modifiers of the tool, in percent.
 * @returns Item data to attach to a tool item (category `tool`).
 */
export function createJobToolNbt(jobId: string, modifiers: Partial<ToolModifiers> = {}): ItemNBT {
    return {
        [JOB_TOOL_NBT_KEYS.jobId]: jobId,
        [JOB_TOOL_NBT_KEYS.luck]: modifiers.luck ?? 0,
        [JOB_TOOL_NBT_KEYS.xpBonus]: modifiers.xpBonus ?? 0,
        [JOB_TOOL_NBT_KEYS.cooldownReduction]: modifiers.cooldownReduction ?? 0,
        [JOB_TOOL_NBT_KEYS.yieldBonus]: modifiers.yieldBonus ?? 0
    };
}

/**
 * Narrows an inventory record into a tool of a job.
 *
 * @param record The inventory record.
 * @param jobId The job identifier.
 * @returns True if the record is a tool of this job.
 */
export function isToolOfJob(record: InventoryItemRecord, jobId: string): boolean {
    return record.category === "tool" && record.itemNbtData?.[JOB_TOOL_NBT_KEYS.jobId] === jobId;
}
