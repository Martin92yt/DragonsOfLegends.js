/**
 * Label displayed for undiscovered species.
 */
export const BESTIARY_UNKNOWN_LABEL = "Unknown";

/**
 * Discovery gold configuration:
 * - a number: the same reward for every species (fixed);
 * - a record: per-species rewards, overriding the `discoveryGold` of the enemy definitions;
 * - a function: a dynamic reward computed from the species identifier.
 *
 * Without configuration, the `discoveryGold` of each enemy definition applies (0 when absent).
 */
export type BestiaryDiscoveryGold = number | Readonly<Record<string, number>> | ((enemyType: string) => number);

/**
 * Bestiary world options (`bestiary` option of the world).
 */
export interface BestiaryOptions {
    /**
     * Enables the automatic registration of defeated monsters.
     * @defaultValue true
     */
    readonly enabled?: boolean;
    /** Gold granted on the first discovery of a species. Defaults to the `discoveryGold` of each enemy definition. */
    readonly discoveryGold?: BestiaryDiscoveryGold;
}

/**
 * Static description of a species.
 */
export interface BestiarySpeciesInfo {
    readonly name: string;
    readonly description: string;
}

/**
 * Persistent state of a discovered species.
 */
export interface BestiaryEntryState {
    /** Number of defeats of this species. */
    kills: number;
    /** Timestamp (ms) of the first defeat. */
    firstDefeatedAt: number;
}

/**
 * Persistent bestiary of a player, keyed by species identifier.
 */
export type BestiaryState = Record<string, BestiaryEntryState>;

/**
 * Display view of a discovered species.
 */
export interface DiscoveredBestiaryEntry {
    readonly discovered: true;
    readonly type: string;
    readonly name: string;
    readonly description: string;
    readonly kills: number;
    readonly firstDefeatedAt: number;
}

/**
 * Display view of an undiscovered species: details are hidden behind {@link BESTIARY_UNKNOWN_LABEL}.
 */
export interface UnknownBestiaryEntry {
    readonly discovered: false;
    readonly type: string;
    readonly name: typeof BESTIARY_UNKNOWN_LABEL;
    readonly description: typeof BESTIARY_UNKNOWN_LABEL;
    readonly kills: 0;
}

/**
 * Display view of a species.
 */
export type BestiaryEntryView = DiscoveredBestiaryEntry | UnknownBestiaryEntry;

/**
 * Discovery progress of a bestiary.
 */
export interface BestiaryProgress {
    readonly discovered: number;
    readonly total: number;
    /** Percentage between 0 and 100. */
    readonly percent: number;
}

/**
 * Validates an unknown value (database, JSON) into a bestiary state; invalid entries are dropped.
 *
 * @param raw The value to validate.
 * @returns A clean bestiary state.
 */
export function parseBestiaryState(raw: unknown): BestiaryState {
    const state: BestiaryState = {};
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return state;

    for (const [speciesId, entry] of Object.entries(raw)) {
        if (speciesId.trim() === "" || typeof entry !== "object" || entry === null) continue;
        const { kills, firstDefeatedAt } = entry as Record<string, unknown>;
        if (typeof kills !== "number" || !Number.isInteger(kills) || kills < 1) continue;
        if (typeof firstDefeatedAt !== "number" || !Number.isFinite(firstDefeatedAt)) continue;
        state[speciesId] = { kills, firstDefeatedAt };
    }
    return state;
}
