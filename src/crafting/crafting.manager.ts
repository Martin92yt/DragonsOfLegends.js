import { MAX_DURABILITY_NBT_KEY } from "../enchanting/enchantment.types.js";
import type { ItemNBT } from "../inventory/inventory.interface.js";
import { countAvailable } from "../inventory/item-stacks.js";
import type PlayerEntity from "../player/player.entity.js";
import { MissingIngredientsError, RecipeLevelTooLowError, UnknownRecipeError } from "../types/error.js";
import AsyncQueue from "../utils/async-queue.js";
import type World from "../world.js";
import RecipeRegistry from "./recipe.registry.js";
import type { CraftResult, RecipeDefinition, RecipeResult } from "./recipe.types.js";
import { createLogger } from "../utils/logger.js";
const log = createLogger("crafting");


/**
 * Computes the item data of a crafted item: the numeric values listed in `scaling` grow with the job level.
 * Durability is mirrored in `maxDurability` so repairs know the ceiling.
 *
 * @param result The recipe result.
 * @param jobLevel The level of the job when crafting.
 * @param requiredLevel The level required by the recipe.
 * @returns The item data, or undefined when the result carries none.
 */
export function scaleResultNbt(result: RecipeResult, jobLevel: number, requiredLevel: number): ItemNBT | undefined {
    if (!result.nbt && !result.item.defaultNbt) return undefined;
    const nbt: ItemNBT = { ...(result.item.defaultNbt ?? {}), ...(result.nbt ?? {}) };
    const bonusLevels = Math.max(0, jobLevel - requiredLevel);
    for (const [key, percentPerLevel] of Object.entries(result.scaling ?? {})) {
        const base = nbt[key];
        if (typeof base === "number") nbt[key] = Math.round(base * (1 + (percentPerLevel * bonusLevels) / 100) * 100) / 100;
    }
    if (typeof nbt.durability === "number") nbt.durability = Math.floor(nbt.durability);
    if (typeof nbt.durability === "number" && nbt[MAX_DURABILITY_NBT_KEY] === undefined) nbt[MAX_DURABILITY_NBT_KEY] = nbt.durability;
    return nbt;
}

/**
 * Generic crafting engine: any job can own recipes. A craft checks the job level, consumes the ingredients, produces
 * items whose stats scale with the job level and grants job experience. Crafts of one player are serialized.
 */
export default class CraftingManager extends RecipeRegistry {
    private readonly queues = new Map<string, AsyncQueue>();

    /**
     * Creates the crafting engine.
     *
     * @param world The world.
     */
    public constructor(private readonly world: World) {
        super();
    }

    /**
     * Lists the recipes of a job the player can already craft (level requirement met).
     *
     * @param player The player.
     * @param jobId The job identifier.
     * @returns The unlocked recipes.
     */
    public listUnlocked(player: PlayerEntity, jobId: string): Array<Readonly<RecipeDefinition>> {
        const level = player.jobs.getLevel(jobId);
        return this.forJob(jobId).filter((recipe) => (recipe.requiredLevel ?? 1) <= level);
    }

    /**
     * Crafts a recipe.
     *
     * @param player The crafting player.
     * @param recipeId The recipe identifier.
     * @param quantity The number of crafts (a positive integer). @defaultValue 1
     * @returns The craft result; `crafted` is `false` when a listener cancelled the `itemCraft` event.
     * @throws {UnknownRecipeError} If the recipe is not registered.
     * @throws {RecipeLevelTooLowError} If the job level is too low.
     * @throws {MissingIngredientsError} If the inventory lacks ingredients.
     * @throws {PlayerDeadError} If the player is dead.
     */
    public async craft(player: PlayerEntity, recipeId: string, quantity = 1): Promise<CraftResult> {
        player.assertCanAct("crafting.craft");
        const recipe = this.get(recipeId);
        if (!recipe) throw new UnknownRecipeError(recipeId);
        if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError("The craft quantity must be a positive integer.");

        let queue = this.queues.get(player.id);
        if (!queue) this.queues.set(player.id, (queue = new AsyncQueue()));
        const outcome = await queue.run(() => this.execute(player, recipe, quantity));
        if (outcome.crafted) {
            const progress = await player.jobs.addExperience(recipe.jobId, (recipe.xp ?? 0) * quantity);
            return { ...outcome, xpGained: progress.xpGained, level: progress.level };
        }
        return outcome;
    }

    private async execute(player: PlayerEntity, recipe: Readonly<RecipeDefinition>, quantity: number): Promise<CraftResult> {
        player.assertCanAct("crafting.craft");
        const required = recipe.requiredLevel ?? 1;
        const jobLevel = player.jobs.getLevel(recipe.jobId);
        if (jobLevel < required) throw new RecipeLevelTooLowError(recipe.id, required, jobLevel);

        const records = await player.inventory.getItems();
        const missing = recipe.ingredients
            .map((ingredient) => ({ itemId: ingredient.itemId, required: ingredient.quantity * quantity, available: countAvailable(records, ingredient.itemId) }))
            .filter((entry) => entry.available < entry.required);
        if (missing.length > 0) throw new MissingIngredientsError(missing);

        const results = recipe.results.map((result) => ({ result, nbt: scaleResultNbt(result, jobLevel, required) }));
        const event = await this.world.events.emitCancellable("itemCraft", {
            playerId: player.id,
            player,
            recipeId: recipe.id,
            jobId: recipe.jobId,
            quantity,
            jobLevel,
            results: results.map(({ result }) => ({ itemId: result.item.itemId, quantity: result.quantity * quantity }))
        });
        const base = { recipeId: recipe.id, quantity, jobLevel, produced: [], xpGained: 0, level: jobLevel };
        if (event.isCancelled) {
            return { crafted: false, ...(event.cancelReason !== undefined ? { cancelReason: event.cancelReason } : {}), ...base };
        }

        const consumed: Array<{ itemId: string; quantity: number }> = [];
        try {
            for (const ingredient of recipe.ingredients) {
                if (!(await player.inventory.remove(ingredient.itemId, ingredient.quantity * quantity))) {
                    throw new MissingIngredientsError([{ itemId: ingredient.itemId, required: ingredient.quantity * quantity, available: 0 }]);
                }
                consumed.push({ itemId: ingredient.itemId, quantity: ingredient.quantity * quantity });
            }
            const produced: Array<{ itemId: string; quantity: number; nbt?: ItemNBT }> = [];
            for (const { result, nbt } of results) {
                if (nbt) {
                    // Items with data never stack: one record per unit.
                    for (let unit = 0; unit < result.quantity * quantity; unit++) await player.inventory.add(result.item, 1, nbt);
                } else {
                    await player.inventory.add(result.item, result.quantity * quantity);
                }
                produced.push({ itemId: result.item.itemId, quantity: result.quantity * quantity, ...(nbt ? { nbt } : {}) });
            }
            log.success(`${player.name} crafted ${quantity}x ${recipe.id}.`);
            return { crafted: true, recipeId: recipe.id, quantity, jobLevel, produced, xpGained: 0, level: jobLevel };
        } catch (error) {
            // Gives the consumed ingredients back so a failed craft costs nothing.
            for (const entry of consumed) await player.inventory.add(entry.itemId, entry.quantity).catch(() => undefined);
            throw error;
        }
    }
}
