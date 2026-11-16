/**
 * Passive bonuses of a class. Every value is optional and defaults to "no bonus", so a class can use only what it needs.
 * Percentages are expressed in percent (`10` = +10%).
 */
export interface ClassPassives {
    /** Bonus to the damage dealt in combat, applied after the equipment. */
    readonly damagePercent?: number;
    /** Absolute critical-hit chance added in combat (`0.05` = +5 points). */
    readonly critRateBonus?: number;
    /** Added to the critical-hit damage multiplier (`0.2` turns x1.45 into x1.65). */
    readonly critMultiplierBonus?: number;
    /** Bonus to the total defense of the player. */
    readonly defensePercent?: number;
    /** Bonus to every experience gain of the player. */
    readonly xpPercent?: number;
    /** Loot luck added to the player's modifiers. */
    readonly luckPercent?: number;
    /** Bonus to the experience earned in a job, by job identifier (the affinities of the class with the trades). */
    readonly jobXpPercent?: Readonly<Record<string, number>>;
    /** Amplifies the bonuses of the worn equipment (the affinities of the class with weapons and armor). */
    readonly equipmentAffinity?: {
        /** Multiplies the damage, critical-rate bonuses of worn weapons. */
        readonly weaponPercent?: number;
        /** Multiplies the defense bonuses of worn armor pieces. */
        readonly armorPercent?: number;
    };
}

/**
 * Class passives with every default applied.
 */
export interface ResolvedClassPassives {
    readonly damagePercent: number;
    readonly critRateBonus: number;
    readonly critMultiplierBonus: number;
    readonly defensePercent: number;
    readonly xpPercent: number;
    readonly luckPercent: number;
    readonly jobXpPercent: Readonly<Record<string, number>>;
    readonly weaponAffinityPercent: number;
    readonly armorAffinityPercent: number;
}

export const NO_CLASS_PASSIVES: ResolvedClassPassives = {
    damagePercent: 0,
    critRateBonus: 0,
    critMultiplierBonus: 0,
    defensePercent: 0,
    xpPercent: 0,
    luckPercent: 0,
    jobXpPercent: {},
    weaponAffinityPercent: 0,
    armorAffinityPercent: 0
};

/**
 * Completes the passives of a class definition.
 *
 * @param passives The passives of the class, if any.
 * @returns The passives with every default applied.
 */
export function resolveClassPassives(passives: ClassPassives | undefined): ResolvedClassPassives {
    if (!passives) return NO_CLASS_PASSIVES;
    return {
        damagePercent: passives.damagePercent ?? 0,
        critRateBonus: passives.critRateBonus ?? 0,
        critMultiplierBonus: passives.critMultiplierBonus ?? 0,
        defensePercent: passives.defensePercent ?? 0,
        xpPercent: passives.xpPercent ?? 0,
        luckPercent: passives.luckPercent ?? 0,
        jobXpPercent: passives.jobXpPercent ?? {},
        weaponAffinityPercent: passives.equipmentAffinity?.weaponPercent ?? 0,
        armorAffinityPercent: passives.equipmentAffinity?.armorPercent ?? 0
    };
}
