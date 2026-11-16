import { InvalidBankUpgradeConfigError } from "../types/error.js";

/**
 * Configuration of the bank upgrades (`bankUpgrades` world option). Each upgrade raises the gold ceiling and/or the
 * number of item slots of the bank, and costs more than the previous one.
 */
export interface BankUpgradeOptions {
    /** Gold price of the first upgrade. @defaultValue 5000 */
    readonly baseCost?: number;
    /** Multiplier applied to the price at each upgrade (`cost = baseCost * costGrowth ** level`). @defaultValue 1.5 */
    readonly costGrowth?: number;
    /** Gold ceiling added by each upgrade (ignored when the gold limit is unlimited). @defaultValue 250000 */
    readonly goldLimitPerLevel?: number;
    /** Item slots added by each upgrade. @defaultValue 10 */
    readonly slotsPerLevel?: number;
    /** Maximum number of upgrades. @defaultValue 10 */
    readonly maxLevel?: number;
}

/**
 * Bank upgrade configuration with every default applied.
 */
export type ResolvedBankUpgradeConfig = Required<BankUpgradeOptions>;

export const DEFAULT_BANK_UPGRADES: ResolvedBankUpgradeConfig = {
    baseCost: 5000,
    costGrowth: 1.5,
    goldLimitPerLevel: 250000,
    slotsPerLevel: 10,
    maxLevel: 10
};

/**
 * Validates and completes the bank upgrade configuration.
 *
 * @param options The configured options.
 * @returns The configuration to use.
 * @throws {InvalidBankUpgradeConfigError} If a value is out of range.
 */
export function resolveBankUpgradeConfig(options: BankUpgradeOptions | undefined): ResolvedBankUpgradeConfig {
    const config = { ...DEFAULT_BANK_UPGRADES, ...options };
    if (!Number.isFinite(config.baseCost) || config.baseCost < 0) throw new InvalidBankUpgradeConfigError("baseCost must be >= 0");
    if (!Number.isFinite(config.costGrowth) || config.costGrowth < 1) throw new InvalidBankUpgradeConfigError("costGrowth must be >= 1");
    if (!Number.isInteger(config.goldLimitPerLevel) || config.goldLimitPerLevel < 0) throw new InvalidBankUpgradeConfigError("goldLimitPerLevel must be an integer >= 0");
    if (!Number.isInteger(config.slotsPerLevel) || config.slotsPerLevel < 0) throw new InvalidBankUpgradeConfigError("slotsPerLevel must be an integer >= 0");
    if (!Number.isInteger(config.maxLevel) || config.maxLevel < 0) throw new InvalidBankUpgradeConfigError("maxLevel must be an integer >= 0");
    return config;
}

/**
 * Price of the next upgrade.
 *
 * @param config The upgrade configuration.
 * @param level The current bank level (number of upgrades bought).
 * @returns The gold price, rounded up.
 */
export function bankUpgradeCost(config: ResolvedBankUpgradeConfig, level: number): number {
    return Math.ceil(config.baseCost * config.costGrowth ** level);
}
