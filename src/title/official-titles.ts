import { TitleDefinition, TitleRarity } from "./title.types.js";
import type TitleManager from "./title.manager.js";

/**
 * Titles shipped with the library (loaded when the `premadeTitles` world option is enabled).
 */
export const OFFICIAL_TITLES: readonly TitleDefinition[] = [
    // Common: the first steps.
    { id: "novice_adventurer", name: "Novice Adventurer", description: "Every legend starts somewhere.", rarity: TitleRarity.Common },
    { id: "first_blood", name: "First Blood", description: "Defeat your first monster.", rarity: TitleRarity.Common },
    { id: "pouch_opener", name: "Pouch Opener", description: "Open your first mystery pouch.", rarity: TitleRarity.Common },
    { id: "apprentice", name: "Apprentice", description: "Reach level 5.", rarity: TitleRarity.Common },
    // Uncommon: dedicated hunters and shoppers.
    { id: "slime_slayer", name: "Slime Slayer", description: "Defeat a great number of slimes.", rarity: TitleRarity.Uncommon },
    { id: "goblin_hunter", name: "Goblin Hunter", description: "Defeat a great number of goblins.", rarity: TitleRarity.Uncommon },
    { id: "bandit_bane", name: "Bandit's Bane", description: "Rid the roads of bandits.", rarity: TitleRarity.Uncommon },
    { id: "savvy_shopper", name: "Savvy Shopper", description: "Make plenty of purchases in the shops.", rarity: TitleRarity.Uncommon },
    { id: "potion_enthusiast", name: "Potion Enthusiast", description: "Drink a lot of potions.", rarity: TitleRarity.Uncommon },
    { id: "lucky_one", name: "Lucky One", description: "Open ten mystery pouches.", rarity: TitleRarity.Uncommon },
    // Rare: long-term goals.
    { id: "seasoned_traveller", name: "Seasoned Traveller", description: "Cross the world, road after road.", rarity: TitleRarity.Rare },
    { id: "gilded_purse", name: "Gilded Purse", description: "Amass a fortune.", rarity: TitleRarity.Rare },
    { id: "veteran", name: "Veteran", description: "Reach level 20.", rarity: TitleRarity.Rare },
    { id: "monster_hunter", name: "Monster Hunter", description: "Defeat two hundred monsters.", rarity: TitleRarity.Rare },
    { id: "treasure_hunter", name: "Treasure Hunter", description: "Open fifty mystery pouches.", rarity: TitleRarity.Rare },
    // Epic: feats against the great threats.
    { id: "dragon_slayer", name: "Dragon Slayer", description: "Defeat an Ancient Dragon.", rarity: TitleRarity.Epic },
    { id: "demon_bane", name: "Demon Bane", description: "Defeat a Demon Lord.", rarity: TitleRarity.Epic },
    { id: "lich_breaker", name: "Lichbreaker", description: "Defeat a Supreme Lich.", rarity: TitleRarity.Epic },
    { id: "boss_hunter", name: "Boss Hunter", description: "Defeat twenty-five bosses.", rarity: TitleRarity.Epic },
    { id: "master", name: "Master", description: "Reach level 40.", rarity: TitleRarity.Epic },
    // Legendary: the extreme end of the ladder.
    { id: "realm_legend", name: "Legend of the Realm", description: "Reach level 50.", rarity: TitleRarity.Legendary },
    { id: "apex_predator", name: "Apex Predator", description: "Defeat a thousand monsters.", rarity: TitleRarity.Legendary },
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
