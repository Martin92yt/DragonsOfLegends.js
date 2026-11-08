import type { ActiveEffectState, PlayerEffectsState } from "./effect.types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Validates an unknown value (database, JSON) into an effects state; invalid entries are dropped
 * and a missing `appliedAt` or `lastTickAt` falls back to a safe default.
 *
 * @param raw The value to validate.
 * @returns A clean effects state.
 */
export function parsePlayerEffectsState(raw: unknown): PlayerEffectsState {
    const state: PlayerEffectsState = {};
    if (!isRecord(raw)) return state;

    for (const [effectId, entry] of Object.entries(raw)) {
        if (!isRecord(entry) || !isTimestamp(entry["expiresAt"])) continue;
        const expiresAt = entry["expiresAt"];
        const appliedAt = isTimestamp(entry["appliedAt"]) ? Math.min(entry["appliedAt"], expiresAt) : expiresAt;
        const lastTickAt = isTimestamp(entry["lastTickAt"]) ? Math.min(Math.max(entry["lastTickAt"], appliedAt), expiresAt) : appliedAt;
        const parsed: ActiveEffectState = { appliedAt, expiresAt, lastTickAt };
        state[effectId] = parsed;
    }
    return state;
}
