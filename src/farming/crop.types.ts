import type { Item } from "../inventory/inventory.interface.js";

/**
 * What a harvest yields for one item: a quantity between `minQuantity` and `maxQuantity`.
 */
export interface CropYield {
    readonly item: Item;
    readonly minQuantity: number;
    readonly maxQuantity: number;
}

/**
 * Definition of a crop of the farming job. Register it with `world.farming.register(...)` or through a content pack (`crops`).
 */
export interface CropDefinition {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    /** The seed consumed to plant the crop. */
    readonly seed: Item;
    /** Base growth time in milliseconds (> 0). Each farmer level above the required one shortens it, see {@link GROWTH_REDUCTION_PER_LEVEL_PERCENT}. */
    readonly growTimeMs: number;
    /** Level of the farming job required to plant the crop. @defaultValue 1 */
    readonly requiredLevel?: number;
    /** Farming experience granted per harvest. @defaultValue 0 */
    readonly xp?: number;
    /** Everything the harvest gives: consumables (healing) and/or ingredients (alchemy, crafting). */
    readonly yields: readonly CropYield[];
    /** Seeds given back by the harvest, so a farm can sustain itself. */
    readonly seedReturn?: { readonly minQuantity: number; readonly maxQuantity: number };
}

/** Identifier of the farming job. */
export const FARMING_JOB_ID = "farming";

/** Growth time reduction per farmer level above the level required by the crop, in percent. */
export const GROWTH_REDUCTION_PER_LEVEL_PERCENT = 2;

/** Maximum growth time reduction, in percent. */
export const MAX_GROWTH_REDUCTION_PERCENT = 50;

/** Number of plots of a new farm. */
export const BASE_FARM_PLOTS = 3;

/** One extra plot is unlocked every this many farming levels. */
export const LEVELS_PER_EXTRA_PLOT = 5;

/** Maximum number of plots. */
export const MAX_FARM_PLOTS = 12;

/**
 * A planted plot.
 */
export interface PlotState {
    readonly cropId: string;
    readonly plantedAt: number;
    readonly readyAt: number;
}

/**
 * Persistent farm of a player: the planted plots by index.
 */
export type PlayerFarmState = Record<string, PlotState>;

/**
 * Display view of a plot.
 */
export interface PlotView {
    readonly plot: number;
    readonly cropId: string | null;
    readonly readyAt: number | null;
    readonly ready: boolean;
}

/**
 * Result of a harvest.
 */
export interface HarvestResult {
    /** `false` when a `cropHarvest` listener cancelled the harvest (the crop stays planted). */
    readonly harvested: boolean;
    readonly cancelReason?: string;
    readonly cropId: string;
    readonly plot: number;
    readonly harvest: ReadonlyArray<{ readonly itemId: string; readonly quantity: number }>;
    readonly xpGained: number;
    readonly level: number;
}

/**
 * Result of a planting.
 */
export interface PlantResult {
    /** `false` when a `cropPlant` listener cancelled the planting (the seed is kept). */
    readonly planted: boolean;
    readonly cancelReason?: string;
    readonly cropId: string;
    readonly plot: number;
    readonly readyAt: number;
}
