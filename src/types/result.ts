import EnemyEntity from "../enemy/enemy.entity.js";

export interface CombatResult {
    playerDamage: number;
    enemyDamage: number;
    enemyHealth: number;
    victory: boolean;
    defeat: boolean;
    enemy: EnemyEntity;
}

export interface ExplorationResult {
    arrived: boolean;
    attacked: boolean;
    travelTimeMs: number;
    locationId: string;
    enemy?: EnemyEntity;
}

export interface GainExperienceResult {
    amount: number;
    total: number;
    leveledUp: boolean;
    level: number;
}

export interface DamageResult {
    reducedDamage: number;
    currentHealth: number;
    rawDamage: number;
}
