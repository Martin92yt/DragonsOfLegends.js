import EnemyEntity from "../enemy/enemy.class.js";

/**
 * Represents the outcome of a combat turn or encounter.
 */
export interface CombatResult {
    /** The amount of damage dealt by the player. */
    playerDamage: number;
    /** The amount of damage dealt by the enemy. */
    enemyDamage: number;
    /** The remaining health of the enemy. */
    enemyHealth: number;
    /** Indicates whether the player has won the combat. */
    victory: boolean;
    /** Indicates whether the player has been defeated. */
    defeat: boolean;
    /** The enemy entity involved in the combat. */
    enemy: EnemyEntity;
}

/**
 * Represents the result of an exploration action.
 */
export interface ExplorationResult {
    /** Indicates whether the destination was successfully reached. */
    arrived: boolean;
    /** Indicates whether combat was triggered during exploration. */
    attacked: boolean;
    /** The duration of the travel in milliseconds. */
    travelDurationMs: number;
    /** The unique identifier of the target location. */
    locationId: string;
    /** Optional enemy encountered during exploration. */
    enemy?: EnemyEntity;
}

/**
 * Represents the outcome of a player gaining experience points.
 */
export interface GainExperienceResult {
    /** The amount of experience gained. */
    gainedAmount: number;
    /** The new total experience points. */
    totalExperience: number;
    /** Indicates whether the experience gain triggered a level-up. */
    isLeveledUp: boolean;
    /** The current player level after experience distribution. */
    currentLevel: number;
}

/**
 * Represents the calculated details of damage taken by an entity.
 */
export interface DamageResult {
    /** The final damage taken after reductions (e.g., armor/defense). */
    reducedDamage: number;
    /** The entity's health remaining after taking damage. */
    currentHealth: number;
    /** The initial unmitigated damage value. */
    rawDamage: number;
}

/**
 * Represents the result of a bank transaction or balance query.
 */
export interface BankResult {
    /** The current balance in the bank account. */
    balance: number;
    /** Indicates whether the banking operation was successful. */
    success: boolean;
}