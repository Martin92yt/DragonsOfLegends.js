import { InvalidRegistryEntryError, UnknownPlayerClassError } from "../types/error.js";
import Registry from "../registry/registry.js";
import type { PlayerClassDefinition } from "./player-class.definition.js";

const STAT_KEYS = ["strength", "agility", "intelligence", "defense"] as const;

/**
 * Registry of the player classes of a world.
 *
 * `require` throws the historical {@link UnknownPlayerClassError} for unknown identifiers.
 */
export default class PlayerClassRegistry extends Registry<PlayerClassDefinition> {
    /**
     * Creates an empty class registry.
     *
     * @returns void
     */
    public constructor() {
        super({
            kind: "player class",
            idOf: (definition) => definition.id,
            validate: (definition) => PlayerClassRegistry.validate(definition),
            errors: { unknown: (id) => new UnknownPlayerClassError(id) }
        });
    }

    private static validate(definition: PlayerClassDefinition): void {
        const fail = (reason: string): never => {
            throw new InvalidRegistryEntryError("player class", `"${definition.id}": ${reason}`);
        };
        if (definition.id.trim() === "") throw new InvalidRegistryEntryError("player class", "the identifier must not be empty.");
        if (definition.name.trim() === "") fail("a name is required.");
        for (const key of STAT_KEYS) {
            if (!(definition.baseStats[key] > 0)) fail(`baseStats.${key} must be greater than 0.`);
        }
        if (definition.attackStat !== undefined && !STAT_KEYS.includes(definition.attackStat)) fail(`unknown attackStat "${String(definition.attackStat)}".`);
    }
}
