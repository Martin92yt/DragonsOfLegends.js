import type { ClassStats } from "./player.interface.js";

/**
 * Attribute used as the base of the attack of a class.
 */
export type AttackStat = keyof ClassStats;

/**
 * Definition of a player class. Register it with `world.classes.register(...)`.
 */
export interface PlayerClassDefinition {
    /** Unique identifier of the class (e.g. `"warrior"`, `"mypack:necromancer"`). */
    readonly id: string;
    /** Display name. */
    readonly name: string;
    /** Description shown by character creation screens. */
    readonly description?: string;
    /** Average base attributes of a new player of the class (randomised by ±10% at creation). */
    readonly baseStats: Readonly<ClassStats>;
    /**
     * Attribute that drives the attack of the class.
     * @defaultValue "strength"
     */
    readonly attackStat?: AttackStat;
}
