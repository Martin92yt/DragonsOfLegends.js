import { InvalidRegistryEntryError } from "../types/error.js";
import Registry from "../registry/registry.js";
import type { AmbushZone, EnemyDefinition } from "./enemy.definition.js";

const isNonNegative = (value: number): boolean => Number.isFinite(value) && value >= 0;

/**
 * Registry of every enemy species available in a world.
 *
 * The official enemies are a plain content set (see `registerOfficialEnemies`); third parties add theirs with
 * {@link Registry.register} and can even replace an official one with `{ override: true }`.
 */
export default class EnemyRegistry extends Registry<EnemyDefinition> {
    /**
     * Creates an empty enemy registry.
     *
     * @returns void
     */
    public constructor() {
        super({
            kind: "enemy",
            idOf: (definition) => definition.id,
            validate: (definition) => EnemyRegistry.validate(definition)
        });
    }

    /**
     * Lists the enemies of a tier, in registration order.
     *
     * @param tier The tier name.
     * @returns The matching definitions.
     */
    public listByTier(tier: string): Array<Readonly<EnemyDefinition>> {
        return this.filter((definition) => definition.tier === tier);
    }

    /**
     * Lists the tiers in use, in first-registration order.
     *
     * @returns The tier names.
     */
    public tiers(): string[] {
        return [...new Set(this.list().map((definition) => definition.tier))];
    }

    /**
     * Lists the enemies able to ambush in a zone, ordered by their ambush `order`.
     *
     * @param zone The zone.
     * @returns The matching definitions (stable sort: ties keep the registration order).
     */
    public listAmbushers(zone: AmbushZone): Array<Readonly<EnemyDefinition>> {
        return this.filter((definition) => definition.ambush?.[zone] !== undefined)
            .sort((first, second) => (first.ambush?.[zone]?.order ?? 0) - (second.ambush?.[zone]?.order ?? 0));
    }

    private static validate(definition: EnemyDefinition): void {
        const fail = (reason: string): never => {
            throw new InvalidRegistryEntryError("enemy", `"${definition.id}": ${reason}`);
        };
        if (definition.id.trim() === "") throw new InvalidRegistryEntryError("enemy", "the identifier must not be empty.");
        if (definition.name.trim() === "") fail("a name is required.");
        if (definition.tier.trim() === "") fail("a tier is required.");
        if (!(definition.health > 0)) fail("health must be greater than 0.");
        if (!isNonNegative(definition.strength) || !isNonNegative(definition.defense)) fail("strength and defense must be >= 0.");
        if (!isNonNegative(definition.experience) || !isNonNegative(definition.gold)) fail("experience and gold must be >= 0.");
        if (definition.discoveryGold !== undefined && !isNonNegative(definition.discoveryGold)) fail("discoveryGold must be >= 0.");

        for (const loot of definition.loot ?? []) {
            const validQuantities = Number.isInteger(loot.minQuantity) && Number.isInteger(loot.maxQuantity) && loot.minQuantity >= 1 && loot.maxQuantity >= loot.minQuantity;
            if (!validQuantities || !(loot.dropRate >= 0 && loot.dropRate <= 100)) fail(`invalid loot entry "${loot.itemId}" (quantities >= 1, dropRate in [0, 100]).`);
        }
        for (const spec of Object.values(definition.ambush ?? {})) {
            if (spec.weight !== undefined && !(spec.weight > 0)) fail("an ambush weight must be greater than 0.");
        }
    }
}
