/**
 * Balance factors of the combat and progression formulas. Every value can be overridden with the `balance` world
 * option (a partial object, merged with the defaults and validated), so a game rebalances without touching the engine.
 */
export interface BalanceConfig {
    readonly damage: {
        /** Lower bound of the random multiplier applied to every blow. */
        readonly varianceMin: number;
        /** Upper bound of the random multiplier applied to every blow. */
        readonly varianceMax: number;
    };
    readonly critical: {
        /** Critical chance of every attacker. */
        readonly baseRate: number;
        /** Critical chance added per agility point of the player. */
        readonly ratePerAgility: number;
        /** Maximum critical chance. */
        readonly maxRate: number;
        /** Damage multiplier of a critical hit. */
        readonly baseMultiplier: number;
        /** Maximum damage multiplier of a critical hit. */
        readonly maxMultiplier: number;
    };
    readonly defense: {
        /** Player: `factor = 100 / (100 + defense * playerConstant)`. */
        readonly playerConstant: number;
        /** Enemy: same curve with its own constant (enemy defense is smaller than the player's). */
        readonly enemyConstant: number;
        /** Maximum share of the damage that defense can absorb (0.85 = at least 15% always goes through). */
        readonly maxMitigation: number;
        /** Maximum armor penetration, in percent. */
        readonly maxPenetrationPercent: number;
    };
    readonly resistance: {
        /** Highest resistance, in percent. */
        readonly maxPercent: number;
        /** Lowest resistance (a weakness), in percent. */
        readonly minPercent: number;
        /** Resistance to non-physical damage given by each intelligence point, in percent. */
        readonly percentPerIntelligence: number;
    };
    readonly dodge: {
        /** Dodge chance per agility point of the player. */
        readonly ratePerAgility: number;
        /** Maximum dodge chance. */
        readonly maxRate: number;
    };
    readonly enemyAttack: {
        /** Lower bound of the random multiplier of an enemy attack. */
        readonly varianceMin: number;
        /** Upper bound of the random multiplier of an enemy attack. */
        readonly varianceMax: number;
        /** Critical chance of an enemy. */
        readonly criticalRate: number;
        /** Damage multiplier of an enemy critical hit. */
        readonly criticalMultiplier: number;
    };
    readonly progression: {
        /** Experience for level 1 -> 2; level `n` needs `round(xpBase * n ** xpExponent)`. */
        readonly xpBase: number;
        /** Growth of the experience curve (1 = linear). */
        readonly xpExponent: number;
        /** Maximum health gained per level. */
        readonly healthPerLevel: number;
        /** Extra maximum health gained at every level multiple of ten. */
        readonly healthPerTenLevels: number;
    };
    readonly enemyScaling: {
        /** Linear growth of the enemy health, strength and rewards per player level above 1. */
        readonly linear: number;
        /** Quadratic growth per squared player level above 1 (enemies catch up with the builds of high levels). */
        readonly quadratic: number;
        /** Growth of the enemy defense per player level above 1 (slower, defense is hyperbolic). */
        readonly defenseLinear: number;
    };
}

/** Recursive partial of {@link BalanceConfig}: what the `balance` world option accepts. */
export type BalanceOptions = { readonly [K in keyof BalanceConfig]?: Partial<BalanceConfig[K]> };

export const DEFAULT_BALANCE: BalanceConfig = {
    damage: { varianceMin: 0.92, varianceMax: 1.08 },
    critical: { baseRate: 0.1, ratePerAgility: 0.002, maxRate: 0.75, baseMultiplier: 1.45, maxMultiplier: 3 },
    defense: { playerConstant: 2.5, enemyConstant: 2, maxMitigation: 0.85, maxPenetrationPercent: 80 },
    resistance: { maxPercent: 75, minPercent: -100, percentPerIntelligence: 0.4 },
    dodge: { ratePerAgility: 0.003, maxRate: 0.3 },
    enemyAttack: { varianceMin: 0.9, varianceMax: 1.1, criticalRate: 0.05, criticalMultiplier: 1.5 },
    progression: { xpBase: 110, xpExponent: 1.15, healthPerLevel: 9, healthPerTenLevels: 5 },
    enemyScaling: { linear: 0.09, quadratic: 0.003, defenseLinear: 0.06 }
};

/**
 * Merges the `balance` option with the defaults and validates every value.
 *
 * @param options The configured overrides.
 * @returns The balance to use.
 * @throws {RangeError} If a value is not a finite number in its valid range.
 */
export function resolveBalance(options: BalanceOptions | undefined): BalanceConfig {
    const merged = {} as Record<string, Record<string, number>>;
    for (const group of Object.keys(DEFAULT_BALANCE) as Array<keyof BalanceConfig>) {
        merged[group] = { ...DEFAULT_BALANCE[group], ...(options?.[group] ?? {}) } as Record<string, number>;
    }
    const balance = merged as unknown as {
        -readonly [G in keyof BalanceConfig]: { -readonly [K in keyof BalanceConfig[G]]: number };
    };

    for (const [group, values] of Object.entries(merged)) {
        for (const [key, value] of Object.entries(values)) {
            if (!Number.isFinite(value)) throw new RangeError(`balance.${group}.${key} must be a finite number.`);
        }
    }
    const check = (condition: boolean, message: string): void => {
        if (!condition) throw new RangeError(`Invalid balance: ${message}.`);
    };
    const { damage, critical, defense, resistance, dodge, enemyAttack, progression, enemyScaling } = balance;
    check(damage.varianceMin > 0 && damage.varianceMin <= damage.varianceMax, "damage variance must satisfy 0 < min <= max");
    check(enemyAttack.varianceMin > 0 && enemyAttack.varianceMin <= enemyAttack.varianceMax, "enemyAttack variance must satisfy 0 < min <= max");
    check(critical.baseRate >= 0 && critical.ratePerAgility >= 0 && critical.maxRate >= 0 && critical.maxRate <= 1, "critical rates must be in [0, 1]");
    check(critical.baseMultiplier >= 1 && critical.maxMultiplier >= critical.baseMultiplier, "critical multipliers must satisfy 1 <= base <= max");
    check(enemyAttack.criticalRate >= 0 && enemyAttack.criticalRate <= 1 && enemyAttack.criticalMultiplier >= 1, "enemy critical values are out of range");
    check(defense.playerConstant > 0 && defense.enemyConstant > 0, "defense constants must be > 0");
    check(defense.maxMitigation >= 0 && defense.maxMitigation < 1, "defense.maxMitigation must be in [0, 1)");
    check(defense.maxPenetrationPercent >= 0 && defense.maxPenetrationPercent <= 100, "defense.maxPenetrationPercent must be in [0, 100]");
    check(resistance.maxPercent <= 100 && resistance.minPercent <= 0 && resistance.percentPerIntelligence >= 0, "resistance bounds are out of range");
    check(dodge.ratePerAgility >= 0 && dodge.maxRate >= 0 && dodge.maxRate <= 1, "dodge values must be in [0, 1]");
    check(progression.xpBase > 0 && progression.xpExponent >= 1, "progression.xpBase must be > 0 and xpExponent >= 1");
    check(progression.healthPerLevel >= 0 && progression.healthPerTenLevels >= 0, "health growth must be >= 0");
    check(enemyScaling.linear >= 0 && enemyScaling.quadratic >= 0 && enemyScaling.defenseLinear >= 0, "enemy scaling must be >= 0");
    return balance;
}
