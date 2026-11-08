import { TitleDefinition, TitleRarity } from "./title.types.js";
import type TitleManager from "./title.manager.js";

/**
 * Titles shipped with the library (loaded when the `premadeTitles` world option is enabled).
 */
export const OFFICIAL_TITLES: readonly TitleDefinition[] = [
    { id: "novice_adventurer", name: "Novice Adventurer", description: "Every legend starts somewhere.", rarity: TitleRarity.Common },
    { id: "slime_slayer", name: "Slime Slayer", description: "Defeat a great number of slimes.", rarity: TitleRarity.Uncommon },
    { id: "goblin_hunter", name: "Goblin Hunter", description: "Defeat a great number of goblins.", rarity: TitleRarity.Uncommon },
    { id: "bandit_bane", name: "Bandit's Bane", description: "Rid the roads of bandits.", rarity: TitleRarity.Uncommon },
    { id: "seasoned_traveller", name: "Seasoned Traveller", description: "Cross the world, road after road.", rarity: TitleRarity.Rare },
    { id: "gilded_purse", name: "Gilded Purse", description: "Amass a fortune.", rarity: TitleRarity.Rare },
    { id: "dragon_slayer", name: "Dragon Slayer", description: "Defeat an Ancient Dragon.", rarity: TitleRarity.Epic },
    { id: "demon_bane", name: "Demon Bane", description: "Defeat a Demon Lord.", rarity: TitleRarity.Epic },
    { id: "eternal_champion", name: "Eternal Champion", description: "Reach the top of the legend.", rarity: TitleRarity.Legendary }
];

/**
 * Registers the official titles in a title registry.
 *
 * @param registry The registry to fill.
 * @returns void
 */
export function registerOfficialTitles(registry: TitleManager): void {
    registry.bulkRegister(OFFICIAL_TITLES);
}
