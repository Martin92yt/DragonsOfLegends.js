import type PlayerEntity from "../player/player.entity.js";
import type World from "../world.js";

/**
 * Passive modifiers granted while an effect is active.
 */
export interface EffectModifiers {
    /** Multiplies the experience gained (`2` doubles it). Several effects multiply each other. @defaultValue 1 */
    readonly xpMultiplier?: number;
    /** Loot luck in percent (drop rates, weight of rare loot). Several effects add up. @defaultValue 0 */
    readonly luckPercent?: number;
    /** Absolute critical-hit chance added (`0.05` = +5 points). Several effects add up. @defaultValue 0 */
    readonly critRateBonus?: number;
}

/**
 * What a hook of an effect receives.
 */
export interface EffectContext {
    readonly world: World;
    readonly player: PlayerEntity;
    readonly effect: Readonly<EffectDefinition>;
    /** Time left before the effect ends, in milliseconds (0 once it has ended). */
    readonly remainingMs: number;
}

/**
 * Periodic part of an effect (heal over time, poison...).
 */
export interface EffectTick {
    /** Delay between two ticks, in milliseconds (at least {@link MIN_EFFECT_TICK_INTERVAL_MS}). */
    readonly intervalMs: number;
    /** Health points restored on every tick. A dead player is never healed. */
    readonly heal?: number;
    /**
     * Custom code run on every tick (e.g. `context.player.takeDamage(5)` for a poison).
     * Failures are logged and never stop the effect. Do not await another `player.effects` call of the same player from here.
     */
    readonly run?: (context: EffectContext) => void | Promise<void>;
}

/**
 * What happens when an effect is applied while it is already active.
 * - `refresh`: the duration restarts from now (the default, no unlimited stacking);
 * - `extend`: the duration is added to the time left.
 */
export type EffectStacking = "refresh" | "extend";

/**
 * Definition of a temporary effect (a status with a duration), fully configurable by the game developer.
 *
 * A potion is only an item whose `use.effects` lists effect identifiers: adding a new potion means
 * registering one effect and one item, nothing else.
 */
export interface EffectDefinition {
    /** Unique identifier (e.g. `"regeneration"`, `"mypack:poison"`). */
    readonly id: string;
    /** Display name. */
    readonly name: string;
    readonly description?: string;
    /** Duration in milliseconds (> 0). */
    readonly durationMs: number;
    /** @defaultValue `"refresh"` */
    readonly stacking?: EffectStacking;
    /** Passive modifiers granted while the effect is active. */
    readonly modifiers?: EffectModifiers;
    /** Periodic part of the effect. */
    readonly tick?: EffectTick;
    /** Runs once when the effect is applied (not when an active effect is refreshed). */
    readonly onApply?: (context: EffectContext) => void | Promise<void>;
    /** Runs once when the effect ends by timeout (not when it is removed with `remove` or `clear`). */
    readonly onExpire?: (context: EffectContext) => void | Promise<void>;
}

/**
 * Shortest accepted tick interval, in milliseconds.
 */
// Rationale: a 100 ms floor keeps a mistaken `intervalMs: 1` from flooding the event loop and the event engine.
export const MIN_EFFECT_TICK_INTERVAL_MS = 100;

/**
 * Largest number of ticks an effect may produce over its duration.
 */
// Rationale: ticks missed while a player was unloaded are replayed on load; this bounds that replay.
export const MAX_EFFECT_TICKS = 10_000;

/**
 * Persistent state of an active effect.
 */
export interface ActiveEffectState {
    /** Epoch ms at which the effect was first applied. */
    appliedAt: number;
    /** Epoch ms at which the effect ends. */
    expiresAt: number;
    /** Epoch ms of the last processed tick (or of the application when no tick ran yet). */
    lastTickAt: number;
}

/**
 * Persistent effects of a player, keyed by effect identifier.
 */
export type PlayerEffectsState = Record<string, ActiveEffectState>;

/**
 * Display view of an active effect.
 */
export interface ActiveEffectView {
    readonly effectId: string;
    readonly name: string;
    /** Epoch ms at which the effect ends. */
    readonly expiresAt: number;
    /** Time left, in milliseconds. */
    readonly remainingMs: number;
}

/**
 * Options of `PlayerEffects.apply`.
 */
export interface ApplyEffectOptions {
    /** Overrides the duration of the definition for this application, in milliseconds (> 0). */
    readonly durationMs?: number;
}

/**
 * Combined modifiers of the active effects of a player (neutral values when nothing is active).
 */
export interface ResolvedEffectModifiers {
    readonly xpMultiplier: number;
    readonly luckPercent: number;
    readonly critRateBonus: number;
}
