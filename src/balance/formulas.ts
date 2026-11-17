import type { BalanceConfig } from "./balance.js";

/** Kind of damage. `physical` is reduced by defense; every other type is reduced by resistances. */
export type DamageType = string;

/** The physical damage type. */
export const PHYSICAL: DamageType = "physical";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * Critical-hit chance of the player.
 * `min(maxRate, baseRate + agility * ratePerAgility + items + class + effects)`
 *
 * @param balance The balance.
 * @param agility The agility attribute.
 * @param bonuses Absolute bonuses (items, class passives, effects).
 * @returns The chance in [0, maxRate].
 */
export function criticalRate(balance: BalanceConfig, agility: number, bonuses: number): number {
    const { baseRate, ratePerAgility, maxRate } = balance.critical;
    return clamp(baseRate + Math.max(0, agility) * ratePerAgility + bonuses, 0, maxRate);
}

/**
 * Damage multiplier of a critical hit: `min(maxMultiplier, baseMultiplier + class + items)`.
 *
 * @param balance The balance.
 * @param bonus Added to the base multiplier (class passive, `critDamageBonus` of the items).
 * @returns The multiplier.
 */
export function criticalMultiplier(balance: BalanceConfig, bonus: number): number {
    return Math.min(balance.critical.maxMultiplier, balance.critical.baseMultiplier + bonus);
}

/**
 * Share of the damage that survives a defense: `1 - min(maxMitigation, 1 - 100 / (100 + defense * constant))`.
 * Defense has diminishing returns and can never absorb more than `maxMitigation` of a blow.
 *
 * @param balance The balance.
 * @param defense The effective defense (>= 0).
 * @param constant The curve constant (player or enemy).
 * @returns A factor in [1 - maxMitigation, 1].
 */
export function defenseFactor(balance: BalanceConfig, defense: number, constant: number): number {
    const mitigation = 1 - 100 / (100 + Math.max(0, defense) * constant);
    return 1 - Math.min(balance.defense.maxMitigation, mitigation);
}

/**
 * Defense left after an armor penetration: `defense * (1 - penetration / 100)`.
 *
 * @param balance The balance.
 * @param defense The defense.
 * @param penetrationPercent The penetration in percent (capped by the balance).
 * @returns The reduced defense.
 */
export function penetrate(balance: BalanceConfig, defense: number, penetrationPercent: number): number {
    return Math.max(0, defense) * (1 - clamp(penetrationPercent, 0, balance.defense.maxPenetrationPercent) / 100);
}

/**
 * Damage multiplier of a resistance (a weakness when negative): `1 - clamp(resistance, min, max) / 100`.
 *
 * @param balance The balance.
 * @param resistancePercent The resistance in percent.
 * @returns A multiplier (1.5 for a -50% weakness, 0.25 for a 75% resistance).
 */
export function resistanceFactor(balance: BalanceConfig, resistancePercent: number): number {
    return 1 - clamp(resistancePercent, balance.resistance.minPercent, balance.resistance.maxPercent) / 100;
}

/**
 * Natural resistance to non-physical damage given by intelligence.
 *
 * @param balance The balance.
 * @param intelligence The intelligence attribute.
 * @returns The resistance in percent.
 */
export function intelligenceResistance(balance: BalanceConfig, intelligence: number): number {
    return Math.max(0, intelligence) * balance.resistance.percentPerIntelligence;
}

/**
 * Dodge chance of the player: `min(maxRate, agility * ratePerAgility + bonus)`.
 *
 * @param balance The balance.
 * @param agility The agility attribute.
 * @param bonus Absolute bonus (items).
 * @returns The chance in [0, maxRate].
 */
export function dodgeRate(balance: BalanceConfig, agility: number, bonus: number): number {
    return clamp(Math.max(0, agility) * balance.dodge.ratePerAgility + bonus, 0, balance.dodge.maxRate);
}

/**
 * Experience needed to leave a level: `round(xpBase * level ** xpExponent)`.
 *
 * @param balance The balance.
 * @param level The current level (>= 1).
 * @returns The experience points.
 */
export function experienceRequired(balance: BalanceConfig, level: number): number {
    const { xpBase, xpExponent } = balance.progression;
    return Math.max(1, Math.round(xpBase * Math.max(1, level) ** xpExponent));
}

/**
 * Maximum health gained when reaching a level: `healthPerLevel + (level % 10 === 0 ? healthPerTenLevels : 0)`.
 *
 * @param balance The balance.
 * @param newLevel The level reached.
 * @returns The health points.
 */
export function healthGainForLevel(balance: BalanceConfig, newLevel: number): number {
    const { healthPerLevel, healthPerTenLevels } = balance.progression;
    return healthPerLevel + (newLevel % 10 === 0 ? healthPerTenLevels : 0);
}

/**
 * Stat multiplier of the enemies for a player level: `1 + linear * (L - 1) + quadratic * (L - 1) ** 2`.
 *
 * @param balance The balance.
 * @param playerLevel The player level.
 * @returns The multiplier for health, strength and rewards.
 */
export function enemyScale(balance: BalanceConfig, playerLevel: number): number {
    const gap = Math.max(0, playerLevel - 1);
    return 1 + balance.enemyScaling.linear * gap + balance.enemyScaling.quadratic * gap * gap;
}

/**
 * Defense multiplier of the enemies for a player level: `1 + defenseLinear * (L - 1)`.
 *
 * @param balance The balance.
 * @param playerLevel The player level.
 * @returns The multiplier for the enemy defense.
 */
export function enemyDefenseScale(balance: BalanceConfig, playerLevel: number): number {
    return 1 + balance.enemyScaling.defenseLinear * Math.max(0, playerLevel - 1);
}

/**
 * Random multiplier of a blow: `varianceMin + random * (varianceMax - varianceMin)`.
 *
 * @param min The lower bound.
 * @param max The upper bound.
 * @param random A random source in [0, 1).
 * @returns The multiplier.
 */
export function variance(min: number, max: number, random: () => number = Math.random): number {
    return min + random() * (max - min);
}
