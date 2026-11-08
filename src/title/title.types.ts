/**
 * Rarity categories of a title.
 */
export enum TitleRarity {
    Common = "common",
    Uncommon = "uncommon",
    Rare = "rare",
    Epic = "epic",
    Legendary = "legendary"
}

/**
 * Sort weight of each rarity (higher = more prestigious).
 */
// Rationale: explicit weights let profiles list the most prestigious titles first,
// independently of the declaration order of the enum.
export const TITLE_RARITY_WEIGHTS: Readonly<Record<TitleRarity, number>> = {
    [TitleRarity.Common]: 0,
    [TitleRarity.Uncommon]: 1,
    [TitleRarity.Rare]: 2,
    [TitleRarity.Epic]: 3,
    [TitleRarity.Legendary]: 4
};

/**
 * Definition of a title, fully configurable by the game developer.
 */
export interface TitleDefinition {
    /** Unique identifier (e.g. `slime_slayer`). */
    readonly id: string;
    /** Display name shown on the player profile (e.g. `Slime Slayer`). */
    readonly name: string;
    /** Optional description (how the title is earned, lore). */
    readonly description?: string;
    /** Rarity category of the title. */
    readonly rarity: TitleRarity;
}
