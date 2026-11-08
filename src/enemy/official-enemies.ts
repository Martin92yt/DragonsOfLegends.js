import { ItemCategory, ItemRarity } from "../inventory/item.enum.js";
import type { EnemyDefinition } from "./enemy.definition.js";
import EnemyRegistry from "./enemy.registry.js";

/**
 * Enemies shipped with the library.
 *
 * Nothing here is special: they are plain {@link EnemyDefinition}s registered through the same API
 * as third-party enemies, and are only loaded when the `premadeEnemies` world option is enabled.
 * The registration order matters: it drives the order of the spawn pools.
 */
// Rationale: loot rates and stack sizes are tuned to prevent economic imbalance and material oversaturation.
export const OFFICIAL_ENEMIES: readonly EnemyDefinition[] = [
    {
        id: "goblin",
        name: "Goblin",
        tier: "beginner",
        health: 50,
        strength: 6,
        defense: 2,
        experience: 25,
        gold: 8,
        discoveryGold: 15,
        bestiary: { name: "Goblin", description: "A scrawny, cunning raider that ambushes travellers in packs." },
        ambush: { land: { order: 1 } },
        loot: [
            { itemId: "dague_rouillee", name: "Rusty Dagger", category: ItemCategory.Weapons, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 15 },
            { itemId: "oreille_gobelin", name: "Goblin Ear", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 35 },
            { itemId: "bourse_de_trous", name: "Pouch of Holes", category: ItemCategory.Valuables, rarity: ItemRarity.Uncommon, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 }
        ]
    },
    {
        id: "wolf",
        name: "Wild Wolf",
        tier: "beginner",
        health: 40,
        strength: 8,
        defense: 2,
        experience: 30,
        gold: 10,
        discoveryGold: 15,
        bestiary: { name: "Wolf", description: "A fast predator that hunts along forest roads." },
        ambush: { land: { order: 2 } },
        loot: [
            { itemId: "fourrure_loup", name: "Wolf Fur", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 40 },
            { itemId: "croc_de_loup", name: "Wolf Fang", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 30 },
            { itemId: "viande_crue", name: "Raw Meat", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 50 }
        ]
    },
    {
        id: "slime",
        name: "Gooey Slime",
        tier: "beginner",
        health: 35,
        strength: 4,
        defense: 1,
        experience: 15,
        gold: 4,
        discoveryGold: 10,
        bestiary: { name: "Slime", description: "A harmless-looking blob that dissolves whatever it touches." },
        ambush: { land: { order: 0 } },
        loot: [
            { itemId: "bave_de_slime", name: "Slime Ooze", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 35 },
            { itemId: "noyau_gelatineux", name: "Gelatinous Core", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 1, dropRate: 4 }
        ]
    },
    {
        id: "bandit",
        name: "Highway Bandit",
        tier: "intermediate",
        health: 65,
        strength: 9,
        defense: 4,
        experience: 45,
        gold: 20,
        discoveryGold: 20,
        bestiary: { name: "Bandit", description: "An outlaw who robs merchants and adventurers alike." },
        ambush: { land: { order: 3 } },
        loot: [
            { itemId: "piece_or", name: "Gold Coin", category: ItemCategory.Valuables, rarity: ItemRarity.Common, maxStack: 999, minQuantity: 1, maxQuantity: 5, dropRate: 60 },
            { itemId: "dague_rouillee", name: "Rusty Dagger", category: ItemCategory.Weapons, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 12 },
            { itemId: "chapeau_dechire", name: "Torn Hat", category: ItemCategory.Armor, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 }
        ]
    },
    {
        id: "giant_rat",
        name: "Giant Rat",
        tier: "beginner",
        health: 30,
        strength: 5,
        defense: 1,
        experience: 10,
        gold: 3,
        discoveryGold: 10,
        bestiary: { name: "Giant Rat", description: "An oversized scavenger that thrives in cellars and sewers." },
        ambush: { water: { order: 1 } },
        loot: [
            { itemId: "queue_de_rat", name: "Rat Tail", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 45 },
            { itemId: "viande_crue", name: "Raw Meat", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 25 }
        ]
    },
    {
        id: "wild_boar",
        name: "Furious Boar",
        tier: "beginner",
        health: 55,
        strength: 10,
        defense: 3,
        experience: 35,
        gold: 12,
        discoveryGold: 20,
        bestiary: { name: "Wild Boar", description: "A stubborn beast that charges at anything entering its territory." },
        ambush: { land: { order: 4 } },
        loot: [
            { itemId: "viande_crue", name: "Raw Meat", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 60 },
            { itemId: "defense_sanglier", name: "Boar Tusk", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 25 },
            { itemId: "cuir_epais", name: "Thick Leather", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 20 }
        ]
    },
    {
        id: "skeleton",
        name: "Warrior Skeleton",
        tier: "intermediate",
        health: 60,
        strength: 7,
        defense: 5,
        experience: 40,
        gold: 16,
        discoveryGold: 25,
        bestiary: { name: "Skeleton", description: "Restless bones animated by an old curse." },
        ambush: { land: { order: 5 } },
        loot: [
            { itemId: "os", name: "Bone", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 45 },
            { itemId: "crane_fissure", name: "Cracked Skull", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 12 },
            { itemId: "arc_ancien", name: "Ancient Bow", category: ItemCategory.Weapons, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 6 }
        ]
    },
    {
        id: "spider",
        name: "Giant Spider",
        tier: "intermediate",
        health: 45,
        strength: 11,
        defense: 3,
        experience: 45,
        gold: 15,
        discoveryGold: 25,
        bestiary: { name: "Spider", description: "A venomous weaver lurking in dark caves." },
        loot: [
            { itemId: "venin_araignee", name: "Spider Venom", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 16, minQuantity: 1, maxQuantity: 1, dropRate: 30 },
            { itemId: "soie_araignee", name: "Spider Silk", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 45 }
        ]
    },
    {
        id: "orc",
        name: "Brutal Orc",
        tier: "intermediate",
        health: 90,
        strength: 14,
        defense: 6,
        experience: 75,
        gold: 35,
        discoveryGold: 40,
        bestiary: { name: "Orc", description: "A brutal warrior with a taste for open battle." },
        loot: [
            { itemId: "hache_orc", name: "Orc Axe", category: ItemCategory.Weapons, rarity: ItemRarity.Uncommon, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10 },
            { itemId: "dent_orque", name: "Orc Tooth", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 35 },
            { itemId: "viande_crue", name: "Raw Meat", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 40 }
        ]
    },
    {
        id: "ghost",
        name: "Wandering Specter",
        tier: "intermediate",
        health: 50,
        strength: 12,
        defense: 8,
        experience: 65,
        gold: 28,
        discoveryGold: 45,
        bestiary: { name: "Ghost", description: "A wandering spirit that chills the air around it." },
        loot: [
            { itemId: "ectoplasme", name: "Ectoplasm", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 35 },
            { itemId: "poussiere_spectrale", name: "Spectral Dust", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 15 }
        ]
    },
    {
        id: "zombie",
        name: "Rotten Zombie",
        tier: "intermediate",
        health: 80,
        strength: 10,
        defense: 4,
        experience: 50,
        gold: 18,
        discoveryGold: 40,
        bestiary: { name: "Zombie", description: "A slow but relentless corpse driven by hunger." },
        loot: [
            { itemId: "chair_putrefiee", name: "Rotten Flesh", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 50 },
            { itemId: "os", name: "Bone", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 25 },
            { itemId: "chapeau_dechire", name: "Torn Hat", category: ItemCategory.Armor, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 }
        ]
    },
    {
        id: "dark_cultist",
        name: "Shadow Cultist",
        tier: "advanced",
        health: 70,
        strength: 16,
        defense: 3,
        experience: 85,
        gold: 48,
        discoveryGold: 60,
        bestiary: { name: "Dark Cultist", description: "A fanatic who bargains with forbidden powers." },
        loot: [
            { itemId: "robe_sombre", name: "Dark Robe", category: ItemCategory.Armor, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 12 },
            { itemId: "grimoire_maudit", name: "Cursed Grimoire", category: ItemCategory.Valuables, rarity: ItemRarity.Epic, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 6 },
            { itemId: "bougie_noire", name: "Black Candle", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 40 }
        ]
    },
    {
        id: "troll",
        name: "Cave Troll",
        tier: "advanced",
        health: 150,
        strength: 20,
        defense: 10,
        experience: 150,
        gold: 95,
        discoveryGold: 80,
        bestiary: { name: "Troll", description: "A towering brute that regenerates from wounds." },
        loot: [
            { itemId: "masse_en_pierre", name: "Stone Mace", category: ItemCategory.Weapons, rarity: ItemRarity.Uncommon, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 12 },
            { itemId: "sang_de_troll", name: "Troll Blood", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 40 },
            { itemId: "pepite_pierre", name: "Stone Nugget", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 3, dropRate: 50 }
        ]
    },
    {
        id: "minotaur",
        name: "Enraged Minotaur",
        tier: "advanced",
        health: 180,
        strength: 25,
        defense: 12,
        experience: 200,
        gold: 130,
        discoveryGold: 100,
        bestiary: { name: "Minotaur", description: "A horned guardian of labyrinths." },
        loot: [
            { itemId: "hache_minotaure", name: "Minotaur Axe", category: ItemCategory.Weapons, rarity: ItemRarity.Epic, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 },
            { itemId: "corne_minotaure", name: "Minotaur Horn", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 30 },
            { itemId: "cuir_epais", name: "Thick Leather", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 3, dropRate: 50 }
        ]
    },
    {
        id: "vampire",
        name: "Vampire Lord",
        tier: "advanced",
        health: 130,
        strength: 22,
        defense: 9,
        experience: 220,
        gold: 160,
        discoveryGold: 120,
        bestiary: { name: "Vampire", description: "An immortal noble feeding on the living." },
        loot: [
            { itemId: "cape_satin_noir", name: "Black Satin Cape", category: ItemCategory.Armor, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 12 },
            { itemId: "crocs_vampire", name: "Vampire Fangs", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 28 },
            { itemId: "fiole_sang_pur", name: "Pure Blood Vial", category: ItemCategory.Consumables, rarity: ItemRarity.Epic, maxStack: 8, minQuantity: 1, maxQuantity: 1, dropRate: 18 }
        ]
    },
    {
        id: "witch",
        name: "Swamp Witch",
        tier: "advanced",
        health: 90,
        strength: 28,
        defense: 5,
        experience: 180,
        gold: 120,
        discoveryGold: 90,
        bestiary: { name: "Witch", description: "A hexcaster brewing curses in secluded hovels." },
        loot: [
            { itemId: "potion_magique", name: "Magic Potion", category: ItemCategory.Consumables, rarity: ItemRarity.Uncommon, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 35 },
            { itemId: "plante_veneneuse", name: "Poisonous Plant", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 40 },
            { itemId: "chapeau_sorciere", name: "Witch Hat", category: ItemCategory.Armor, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 }
        ]
    },
    {
        id: "stone_golem",
        name: "Stone Golem",
        tier: "advanced",
        health: 250,
        strength: 18,
        defense: 25,
        experience: 250,
        gold: 180,
        discoveryGold: 110,
        bestiary: { name: "Stone Golem", description: "An ancient construct carved from living rock." },
        loot: [
            { itemId: "pierre_magique", name: "Magic Stone", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 50 },
            { itemId: "fragment_golem", name: "Golem Fragment", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 30 },
            { itemId: "noyau_elementaire", name: "Elemental Core", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 4, minQuantity: 1, maxQuantity: 1, dropRate: 4 }
        ]
    },
    {
        id: "lich",
        name: "Supreme Lich",
        tier: "boss",
        health: 300,
        strength: 35,
        defense: 15,
        experience: 500,
        gold: 400,
        discoveryGold: 300,
        bestiary: { name: "Lich", description: "A sorcerer who traded its life for undying power." },
        loot: [
            { itemId: "phylactere_brise", name: "Broken Phylactery", category: ItemCategory.Valuables, rarity: ItemRarity.Legendary, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 4 },
            { itemId: "baton_sombre", name: "Dark Staff", category: ItemCategory.Weapons, rarity: ItemRarity.Epic, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 },
            { itemId: "poussiere_detite", name: "Stardust", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 64, minQuantity: 1, maxQuantity: 3, dropRate: 65 }
        ]
    },
    {
        id: "demon_lord",
        name: "Demon Lord",
        tier: "boss",
        health: 450,
        strength: 45,
        defense: 20,
        experience: 800,
        gold: 680,
        discoveryGold: 500,
        bestiary: { name: "Demon Lord", description: "A ruler of the infernal planes." },
        loot: [
            { itemId: "coeur_demon", name: "Demon Heart", category: ItemCategory.Materials, rarity: ItemRarity.Legendary, maxStack: 4, minQuantity: 1, maxQuantity: 1, dropRate: 18 },
            { itemId: "epee_demoniaque", name: "Demonic Sword", category: ItemCategory.Weapons, rarity: ItemRarity.Legendary, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 },
            { itemId: "fragment_infernal", name: "Infernal Fragment", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 32, minQuantity: 1, maxQuantity: 4, dropRate: 75 }
        ]
    },
    {
        id: "ancient_dragon",
        name: "Ancient Dragon",
        tier: "boss",
        health: 700,
        strength: 60,
        defense: 30,
        experience: 1500,
        gold: 1500,
        discoveryGold: 1000,
        bestiary: { name: "Ancient Dragon", description: "A millennia-old wyrm whose breath melts armies." },
        loot: [
            { itemId: "ecailles_dragon", name: "Dragon Scales", category: ItemCategory.Materials, rarity: ItemRarity.Legendary, maxStack: 64, minQuantity: 2, maxQuantity: 5, dropRate: 85 },
            { itemId: "griffe_dragon", name: "Dragon Claw", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 40 },
            { itemId: "orbe_draconique", name: "Draconic Orb", category: ItemCategory.Valuables, rarity: ItemRarity.Legendary, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10 }
        ]
    },
    {
        id: "hydra",
        name: "Seven-Headed Hydra",
        tier: "boss",
        health: 600,
        strength: 50,
        defense: 22,
        experience: 1200,
        gold: 1250,
        discoveryGold: 750,
        bestiary: { name: "Hydra", description: "A many-headed beast that regrows what is severed." },
        ambush: { water: { order: 0 } },
        loot: [
            { itemId: "ecaille_hydre", name: "Hydra Scale", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 32, minQuantity: 1, maxQuantity: 3, dropRate: 65 },
            { itemId: "venin_mortel", name: "Deadly Venom", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 45 },
            { itemId: "dent_hydre", name: "Hydra Tooth", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 30 }
        ]
    }
];

/**
 * Registers the official enemies in an enemy registry.
 *
 * @param registry The registry to fill.
 * @returns void
 * @throws {DuplicateRegistryEntryError} If one of the official identifiers is already registered.
 */
export function registerOfficialEnemies(registry: EnemyRegistry): void {
    registry.bulkRegister(OFFICIAL_ENEMIES);
}

let officialRegistry: EnemyRegistry | undefined;

/**
 * Gets a shared, lazily created registry holding only the official enemies.
 * Used as a read-only default by standalone components (e.g. a `PlayerBestiary` built without a world).
 *
 * @returns The shared official enemy registry.
 */
export function getOfficialEnemyRegistry(): EnemyRegistry {
    if (!officialRegistry) {
        officialRegistry = new EnemyRegistry();
        registerOfficialEnemies(officialRegistry);
        officialRegistry.lock();
    }
    return officialRegistry;
}
