import type EnemyRegistry from "../enemy/enemy.registry.js";
import { getOfficialEnemyRegistry } from "../enemy/official-enemies.js";
import {
    BESTIARY_UNKNOWN_LABEL,
    BestiaryEntryState,
    BestiaryEntryView,
    BestiaryProgress,
    BestiaryState,
    parseBestiaryState
} from "../bestiary/bestiary.types.js";

/**
 * Monsters discovered by a player.
 *
 * Undiscovered species are displayed as `Unknown`; details appear once the species has been defeated.
 * Species are described by the enemy registry, so enemies added by content packs are supported.
 */
export default class PlayerBestiary {
    private readonly entries = new Map<string, BestiaryEntryState>();

    /**
     * Creates the bestiary of a player.
     *
     * @param state The saved bestiary state (validated; invalid entries are dropped).
     * @param enemies The enemy registry describing the species. Defaults to a registry holding the official enemies.
     * @returns void
     */
    public constructor(state: unknown = {}, private readonly enemies: EnemyRegistry = getOfficialEnemyRegistry()) {
        for (const [speciesId, entry] of Object.entries(parseBestiaryState(state))) {
            this.entries.set(speciesId, { ...entry });
        }
    }

    /**
     * Registers a defeat.
     *
     * @param enemyType The defeated species identifier.
     * @param now The defeat timestamp in milliseconds.
     * @returns True if this is the first defeat of the species (a discovery).
     */
    public record(enemyType: string, now: number = Date.now()): boolean {
        const existing = this.entries.get(enemyType);
        if (existing) {
            existing.kills += 1;
            return false;
        }

        this.entries.set(enemyType, { kills: 1, firstDefeatedAt: now });
        return true;
    }

    /**
     * Checks whether a species has been discovered.
     *
     * @param enemyType The species identifier.
     * @returns True if discovered.
     */
    public isDiscovered(enemyType: string): boolean {
        return this.entries.has(enemyType);
    }

    /**
     * Gets the display view of a species: full details if discovered, `Unknown` otherwise.
     *
     * @param enemyType The species identifier.
     * @returns The display view.
     */
    public getEntry(enemyType: string): BestiaryEntryView {
        const entry = this.entries.get(enemyType);
        if (!entry) {
            return { discovered: false, type: enemyType, name: BESTIARY_UNKNOWN_LABEL, description: BESTIARY_UNKNOWN_LABEL, kills: 0 };
        }

        const definition = this.enemies.get(enemyType);
        return {
            discovered: true,
            type: enemyType,
            name: definition?.bestiary?.name ?? definition?.name ?? enemyType,
            description: definition?.bestiary?.description ?? "",
            kills: entry.kills,
            firstDefeatedAt: entry.firstDefeatedAt
        };
    }

    /**
     * Lists every registered species, in registration order.
     *
     * @returns The display views.
     */
    public list(): BestiaryEntryView[] {
        return this.enemies.ids().map((enemyType) => this.getEntry(enemyType));
    }

    /**
     * Gets the discovery progress, counting only the species currently registered.
     *
     * @returns Discovered count, total count and percentage.
     */
    public getProgress(): BestiaryProgress {
        const total = this.enemies.size;
        const discovered = this.enemies.ids().filter((enemyType) => this.entries.has(enemyType)).length;
        return { discovered, total, percent: total === 0 ? 0 : Math.floor((discovered / total) * 100) };
    }

    /**
     * Exports the state for persistence (species of disabled packs are kept, so they are not lost).
     *
     * @returns A copy of the bestiary state.
     */
    public toState(): BestiaryState {
        const state: BestiaryState = {};
        for (const [enemyType, entry] of this.entries) {
            state[enemyType] = { ...entry };
        }
        return state;
    }
}
