import type { Item, ItemNBT } from "../inventory/inventory.interface.js";

/**
 * An amount of one item consumed by a recipe.
 */
export interface RecipeIngredient {
    readonly itemId: string;
    /** Positive integer. */
    readonly quantity: number;
}

/**
 * What a recipe produces.
 */
export interface RecipeResult {
    /** The produced item. */
    readonly item: Item;
    /** Positive integer, per craft. */
    readonly quantity: number;
    /** Item data of the produced item (damage, defense, durability...). Items with data never stack. */
    readonly nbt?: ItemNBT;
    /**
     * Scaling of the numeric item data with the level of the job: `{ damageBonus: 4 }` adds 4% of the base value per
     * job level above the level required by the recipe (so the same sword is stronger when forged by a better smith).
     */
    readonly scaling?: Readonly<Record<string, number>>;
}

/**
 * A recipe of the crafting engine. Register it with `world.crafting.register(...)` or through a content pack (`recipes`).
 */
export interface RecipeDefinition {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    /** The job that crafts the recipe and gains experience. */
    readonly jobId: string;
    /** Level of the job that unlocks the recipe. @defaultValue 1 */
    readonly requiredLevel?: number;
    readonly ingredients: readonly RecipeIngredient[];
    readonly results: readonly RecipeResult[];
    /** Job experience granted per craft. @defaultValue 0 */
    readonly xp?: number;
}

/**
 * Result of a craft.
 */
export interface CraftResult {
    /** `false` when an `itemCraft` listener cancelled the craft (nothing was consumed or produced). */
    readonly crafted: boolean;
    readonly cancelReason?: string;
    readonly recipeId: string;
    readonly quantity: number;
    readonly jobLevel: number;
    /** What was produced, with the final (scaled) item data. */
    readonly produced: ReadonlyArray<{ readonly itemId: string; readonly quantity: number; readonly nbt?: ItemNBT }>;
    readonly xpGained: number;
    /** Level of the job after the craft. */
    readonly level: number;
}
