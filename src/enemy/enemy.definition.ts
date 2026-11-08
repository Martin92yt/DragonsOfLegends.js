import type { LootItem } from "./enemy.js";

/**
 * Zone in which an enemy can ambush a travelling player.
 */
export type AmbushZone = "land" | "water";

/**
 * How an enemy takes part in the ambushes of a zone.
 */
export interface EnemyAmbushSpec {
    /**
     * Position in the ambush pool of the zone (lower first, ties keep the registration order).
     * @defaultValue 0
     */
    readonly order?: number;
    /**
     * Relative probability of being picked in the zone.
     * @defaultValue 1
     */
    readonly weight?: number;
}

/**
 * Text and reward shown by the bestiary.
 */
export interface EnemyBestiaryEntry {
    /** Display name once discovered (defaults to the enemy name). */
    readonly name?: string;
    /** Description shown once discovered. */
    readonly description: string;
}

/**
 * Definition of an enemy species. Register it with `world.enemies.register(...)`.
 */
export interface EnemyDefinition {
    /** Unique identifier of the species (e.g. `"goblin"`, `"mypack:fire_imp"`). */
    readonly id: string;
    /** Display name. */
    readonly name: string;
    /**
     * Difficulty tier. The spawn rules (see {@link EnemySpawnRule}) pick a tier from the player level;
     * the official tiers are `beginner`, `intermediate`, `advanced` and `boss`, but any tier name can be used.
     */
    readonly tier: string;
    /** Base health at player level 1. */
    readonly health: number;
    /** Base strength at player level 1. */
    readonly strength: number;
    /** Base defense at player level 1. */
    readonly defense: number;
    /** Base experience reward at player level 1. */
    readonly experience: number;
    /** Base gold reward at player level 1. */
    readonly gold: number;
    /** Loot table rolled when the enemy dies. */
    readonly loot?: readonly LootItem[];
    /** Bestiary text. Without it the enemy is listed with its name and an empty description. */
    readonly bestiary?: EnemyBestiaryEntry;
    /** Gold granted the first time a player defeats the species (see the bestiary options). */
    readonly discoveryGold?: number;
    /** Zones in which the enemy can ambush travellers. */
    readonly ambush?: Readonly<Partial<Record<AmbushZone, EnemyAmbushSpec>>>;
}

/**
 * Rule choosing the difficulty tier of a spawned enemy from the player level.
 * Rules are evaluated in order; the first one whose `belowLevel` is greater than the player level applies.
 */
export interface EnemySpawnRule {
    /** Exclusive upper bound of the player levels the rule applies to (`Infinity` for the last rule). */
    readonly belowLevel: number;
    /** Relative weight of every tier (e.g. `{ beginner: 85, intermediate: 15 }`). */
    readonly tiers: Readonly<Record<string, number>>;
}

/**
 * Default spawn rules, used when the world does not provide its own.
 */
// Rationale: low-level players mostly meet beginner enemies; a rising share of the next tier keeps encounters
// progressive, with a 10% chance of a boss only once players reach level 6.
export const DEFAULT_ENEMY_SPAWN_RULES: readonly EnemySpawnRule[] = [
    { belowLevel: 3, tiers: { beginner: 85, intermediate: 15 } },
    { belowLevel: 6, tiers: { intermediate: 75, advanced: 25 } },
    { belowLevel: Number.POSITIVE_INFINITY, tiers: { advanced: 90, boss: 10 } }
];
