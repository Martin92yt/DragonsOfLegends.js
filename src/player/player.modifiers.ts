import type { ResolvedEffectModifiers } from "../effects/effect.types.js";
import type { AmuletModifiers } from "../inventory/amulet.js";

/**
 * The passive modifiers of a player, combining worn amulets and active effects.
 */
export interface PlayerModifiers {
    /** Multiplier applied to every experience gain (`1` = none, `2` = double). */
    readonly xpMultiplier: number;
    /** Loot luck in percent: boosts enemy drop rates, job loot and lootboxes. */
    readonly luckPercent: number;
    /** Absolute critical-hit chance added in combat (`0.05` = +5 points). */
    readonly critRateBonus: number;
}

/**
 * Combines the amulet modifiers and the effect modifiers.
 * The experience bonus of amulets is additive (`+10% +10%` = `+20%`), then multiplied by the effects (`x2`).
 *
 * @param amulets The modifiers of the worn amulets.
 * @param effects The combined modifiers of the active effects.
 * @returns The modifiers of the player (never negative).
 */
export function resolvePlayerModifiers(amulets: AmuletModifiers, effects: ResolvedEffectModifiers): PlayerModifiers {
    return {
        xpMultiplier: Math.max(0, ((100 + amulets.xpPercent) / 100) * effects.xpMultiplier),
        luckPercent: Math.max(0, amulets.luckPercent + effects.luckPercent),
        critRateBonus: Math.max(0, amulets.critRateBonus + effects.critRateBonus)
    };
}

/**
 * Applies an experience multiplier to a base amount, rounded down.
 *
 * @param amount The base experience.
 * @param multiplier The experience multiplier (see {@link PlayerModifiers.xpMultiplier}).
 * @returns The experience actually gained.
 */
export function scaleExperience(amount: number, multiplier: number): number {
    // Rationale: the epsilon absorbs floating-point drift (20 * 1.15 is 22.999999999999996, the intent is 23).
    return multiplier === 1 ? Math.floor(amount) : Math.floor(amount * multiplier + 1e-9);
}
