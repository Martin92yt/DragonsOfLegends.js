import Registry from "../registry/registry.js";
import { InvalidRegistryEntryError } from "../types/error.js";
import { MAX_EFFECT_TICKS, MIN_EFFECT_TICK_INTERVAL_MS, type EffectDefinition } from "./effect.types.js";

/**
 * Registry of the temporary effects of a world.
 *
 * Built on the generic {@link Registry}: the official effects are a content pack and third parties
 * register theirs the same way (`register`, `bulkRegister`, `{ override: true }`...).
 */
export default class EffectRegistry extends Registry<EffectDefinition> {
    /**
     * Creates an empty effect registry.
     *
     * @returns void
     */
    public constructor() {
        super({
            kind: "effect",
            idOf: (definition) => definition.id,
            validate: (definition) => EffectRegistry.validate(definition)
        });
    }

    private static validate(definition: EffectDefinition): void {
        const fail = (reason: string): never => {
            throw new InvalidRegistryEntryError("effect", `"${definition.id}": ${reason}`);
        };
        if (definition.id.trim() === "") throw new InvalidRegistryEntryError("effect", "the identifier must not be empty.");
        if (definition.name.trim() === "") fail("a name is required.");
        if (!Number.isFinite(definition.durationMs) || definition.durationMs <= 0) fail("durationMs must be a positive number.");
        if (definition.stacking !== undefined && definition.stacking !== "refresh" && definition.stacking !== "extend") fail(`unknown stacking "${String(definition.stacking)}".`);

        const { modifiers, tick } = definition;
        if (modifiers) {
            const { xpMultiplier, luckPercent, critRateBonus } = modifiers;
            if (xpMultiplier !== undefined && !(Number.isFinite(xpMultiplier) && xpMultiplier > 0)) fail("modifiers.xpMultiplier must be a positive number.");
            if (luckPercent !== undefined && !Number.isFinite(luckPercent)) fail("modifiers.luckPercent must be a finite number.");
            if (critRateBonus !== undefined && !Number.isFinite(critRateBonus)) fail("modifiers.critRateBonus must be a finite number.");
        }
        if (tick) {
            if (!Number.isFinite(tick.intervalMs) || tick.intervalMs < MIN_EFFECT_TICK_INTERVAL_MS) fail(`tick.intervalMs must be at least ${MIN_EFFECT_TICK_INTERVAL_MS} ms.`);
            if (tick.heal === undefined && tick.run === undefined) fail("a tick needs a heal amount or a run hook.");
            if (tick.heal !== undefined && !(Number.isFinite(tick.heal) && tick.heal > 0)) fail("tick.heal must be a positive number.");
            if (Math.floor(definition.durationMs / tick.intervalMs) > MAX_EFFECT_TICKS) fail(`the effect would tick more than ${MAX_EFFECT_TICKS} times; raise intervalMs or lower durationMs.`);
        }
    }
}
