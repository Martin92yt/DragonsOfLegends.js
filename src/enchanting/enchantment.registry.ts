import Registry from "../registry/registry.js";
import { InvalidRegistryEntryError } from "../types/error.js";
import type { EnchantmentDefinition } from "./enchantment.types.js";

/**
 * Registry of the enchantments of a world (built on the generic {@link Registry}).
 */
export default class EnchantmentRegistry extends Registry<EnchantmentDefinition> {
    /**
     * Creates an empty enchantment registry.
     *
     * @returns void
     */
    public constructor() {
        super({ kind: "enchantment", idOf: (definition) => definition.id, validate: (definition) => EnchantmentRegistry.validate(definition) });
    }

    private static validate(definition: EnchantmentDefinition): void {
        const fail = (reason: string): never => {
            throw new InvalidRegistryEntryError("enchantment", `"${definition.id}": ${reason}`);
        };
        if (definition.id.trim() === "") throw new InvalidRegistryEntryError("enchantment", "the identifier must not be empty.");
        if (definition.name.trim() === "") fail("a name is required.");
        if (definition.levels.length === 0) fail("at least one level is required.");
        definition.levels.forEach((level, index) => {
            if (level.requiredJobLevel !== undefined && (!Number.isInteger(level.requiredJobLevel) || level.requiredJobLevel < 1)) fail(`level ${index + 1}: invalid requiredJobLevel.`);
            if (level.gold !== undefined && !(level.gold >= 0)) fail(`level ${index + 1}: gold must be >= 0.`);
            if (level.playerXp !== undefined && !(level.playerXp >= 0)) fail(`level ${index + 1}: playerXp must be >= 0.`);
            for (const material of level.materials ?? []) {
                if (!Number.isInteger(material.quantity) || material.quantity < 1) fail(`level ${index + 1}: invalid quantity for "${material.itemId}".`);
            }
        });
    }
}
