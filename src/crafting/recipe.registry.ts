import Registry from "../registry/registry.js";
import { InvalidRegistryEntryError } from "../types/error.js";
import type { RecipeDefinition } from "./recipe.types.js";

/**
 * Registry of the recipes of a world (built on the generic {@link Registry}).
 */
export default class RecipeRegistry extends Registry<RecipeDefinition> {
    /**
     * Creates an empty recipe registry.
     *
     * @returns void
     */
    public constructor() {
        super({ kind: "recipe", idOf: (recipe) => recipe.id, validate: (recipe) => RecipeRegistry.validate(recipe) });
    }

    /**
     * Lists the recipes of a job, easiest first.
     *
     * @param jobId The job identifier.
     * @returns The recipes of the job sorted by required level.
     */
    public forJob(jobId: string): Array<Readonly<RecipeDefinition>> {
        return this.filter((recipe) => recipe.jobId === jobId).sort((a, b) => (a.requiredLevel ?? 1) - (b.requiredLevel ?? 1));
    }

    private static validate(recipe: RecipeDefinition): void {
        const fail = (reason: string): never => {
            throw new InvalidRegistryEntryError("recipe", `"${recipe.id}": ${reason}`);
        };
        if (recipe.id.trim() === "") throw new InvalidRegistryEntryError("recipe", "the identifier must not be empty.");
        if (recipe.name.trim() === "") fail("a name is required.");
        if (recipe.jobId.trim() === "") fail("a jobId is required.");
        if (recipe.requiredLevel !== undefined && (!Number.isInteger(recipe.requiredLevel) || recipe.requiredLevel < 1)) fail("requiredLevel must be a positive integer.");
        if (recipe.xp !== undefined && !(recipe.xp >= 0)) fail("xp must be >= 0.");
        if (recipe.ingredients.length === 0) fail("at least one ingredient is required.");
        if (recipe.results.length === 0) fail("at least one result is required.");
        for (const ingredient of recipe.ingredients) {
            if (!Number.isInteger(ingredient.quantity) || ingredient.quantity < 1) fail(`invalid quantity for ingredient "${ingredient.itemId}".`);
        }
        for (const result of recipe.results) {
            if (!Number.isInteger(result.quantity) || result.quantity < 1) fail(`invalid quantity for result "${result.item.itemId}".`);
            for (const [key, percent] of Object.entries(result.scaling ?? {})) {
                if (!(percent >= 0)) fail(`scaling "${key}" must be >= 0.`);
            }
        }
    }
}
