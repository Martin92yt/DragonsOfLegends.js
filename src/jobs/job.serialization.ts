import type { JobProgressState, PlayerJobsState } from "./job.types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates an unknown value (database, JSON) into a jobs state; invalid jobs are dropped and
 * invalid fields are replaced by safe defaults.
 *
 * @param raw The value to validate.
 * @returns A clean jobs state.
 */
export function parsePlayerJobsState(raw: unknown): PlayerJobsState {
    const state: PlayerJobsState = {};
    if (!isRecord(raw)) return state;

    for (const [jobId, entry] of Object.entries(raw)) {
        if (!isRecord(entry)) continue;
        const { level, xp, equippedToolItemId, lastActionAt } = entry;

        const parsed: JobProgressState = {
            level: typeof level === "number" && Number.isInteger(level) && level >= 1 ? level : 1,
            xp: typeof xp === "number" && Number.isFinite(xp) && xp >= 0 ? xp : 0,
            equippedToolItemId: typeof equippedToolItemId === "string" ? equippedToolItemId : "",
            lastActionAt: {}
        };
        if (isRecord(lastActionAt)) {
            for (const [actionId, timestamp] of Object.entries(lastActionAt)) {
                if (typeof timestamp === "number" && Number.isFinite(timestamp)) parsed.lastActionAt[actionId] = timestamp;
            }
        }
        state[jobId] = parsed;
    }
    return state;
}
