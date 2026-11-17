import { ENCHANTING_JOB, OFFICIAL_ENCHANTMENTS } from "../../enchanting/official-enchantments.js";
import { FARMING_JOB_ID, type CropDefinition } from "../../farming/crop.types.js";
import type { Item } from "../../inventory/inventory.interface.js";
import { ItemCategory, ItemRarity } from "../../inventory/item.enum.js";
import type { JobDefinition } from "../../jobs/job.types.js";
import { item } from "../../jobs/official/official-items.js";
import type { RecipeDefinition } from "../recipe.types.js";

export const BLACKSMITHING_JOB_ID = "blacksmithing";

// ── Items ───────────────────────────────────────────────────────────────────
const copperIngot = item("copper_ingot", "Copper Ingot", ItemCategory.Materials, ItemRarity.Common, 64, "A bar of smelted copper.");
const ironIngot = item("iron_ingot", "Iron Ingot", ItemCategory.Materials, ItemRarity.Uncommon, 64, "A bar of smelted iron.");
const steelIngot = item("steel_ingot", "Steel Ingot", ItemCategory.Materials, ItemRarity.Rare, 64, "Iron hardened with coal.");

const copperSword: Item = { itemId: "copper_sword", name: "Copper Sword", category: ItemCategory.Weapons, rarity: ItemRarity.Common, maxStack: 1, description: "A soft but serviceable blade.", defaultNbt: { damageBonus: 4, durability: 80 } };
const ironSword: Item = { itemId: "iron_sword", name: "Iron Sword", category: ItemCategory.Weapons, rarity: ItemRarity.Uncommon, maxStack: 1, description: "A reliable iron blade.", defaultNbt: { damageBonus: 6, durability: 100, requirements: { intelligence: 10 } } };
const steelSword: Item = { itemId: "steel_sword", name: "Steel Sword", category: ItemCategory.Weapons, rarity: ItemRarity.Rare, maxStack: 1, description: "A well-balanced steel blade.", defaultNbt: { damageBonus: 12, durability: 150, requirements: { intelligence: 15 } } };
const ironHelmet: Item = { itemId: "iron_helmet", name: "Iron Helmet", category: ItemCategory.Armor, rarity: ItemRarity.Uncommon, maxStack: 1, description: "Protects the head.", defaultNbt: { defenseBonus: 3, durability: 100 } };
const ironChestplate: Item = { itemId: "iron_chestplate", name: "Iron Chestplate", category: ItemCategory.Armor, rarity: ItemRarity.Uncommon, maxStack: 1, description: "Heavy but sturdy.", defaultNbt: { defenseBonus: 6, durability: 120 } };

const seeds = {
    wheat: item("wheat_seeds", "Wheat Seeds", ItemCategory.Materials, ItemRarity.Common, 64),
    carrot: item("carrot_seeds", "Carrot Seeds", ItemCategory.Materials, ItemRarity.Common, 64),
    herb: item("herb_seeds", "Healing Herb Seeds", ItemCategory.Materials, ItemRarity.Uncommon, 64),
    pumpkin: item("pumpkin_seeds", "Pumpkin Seeds", ItemCategory.Materials, ItemRarity.Uncommon, 64)
};
const wheat = item("wheat", "Wheat", ItemCategory.Materials, ItemRarity.Common, 64, "An ingredient for baking.");
const healingHerb = item("healing_herb", "Healing Herb", ItemCategory.Materials, ItemRarity.Uncommon, 64, "An ingredient for alchemy.");
const carrot: Item = { ...item("carrot", "Carrot", ItemCategory.Consumables, ItemRarity.Common, 32, "Restores 15 health points."), use: { heal: 15 } };
const pumpkin: Item = { ...item("pumpkin", "Pumpkin", ItemCategory.Consumables, ItemRarity.Uncommon, 32, "Restores 40 health points."), use: { heal: 40 } };
const bread: Item = { ...item("bread", "Bread", ItemCategory.Consumables, ItemRarity.Common, 32, "Restores 25 health points."), use: { heal: 25 } };
const herbalTonic: Item = { ...item("herbal_tonic", "Herbal Tonic", ItemCategory.Consumables, ItemRarity.Uncommon, 16, "Heals over time."), use: { effects: ["regeneration"] } };

/**
 * New items of the crafting pack (the iron and steel swords already belong to the official items).
 */
export const CRAFTING_ITEMS: readonly Item[] = [
    copperIngot, ironIngot, steelIngot, copperSword, ironHelmet, ironChestplate,
    ...Object.values(seeds), wheat, healingHerb, carrot, pumpkin, bread, herbalTonic
];

// ── Jobs ────────────────────────────────────────────────────────────────────
/**
 * The farmer: forage seeds, plant them in the fields and harvest them (see `world.farming`).
 */
export const FARMING_JOB: JobDefinition = {
    id: FARMING_JOB_ID,
    name: "Farmer",
    description: "Forage seeds, grow crops and bake what you harvest.",
    actions: [
        {
            id: "forage_seeds",
            name: "Forage seeds",
            description: "Search the hedgerows for seeds to plant.",
            cooldownMs: 20_000,
            xp: 3,
            loot: [
                { item: seeds.wheat, weight: 45, minQuantity: 1, maxQuantity: 3 },
                { item: seeds.carrot, weight: 35, minQuantity: 1, maxQuantity: 2 },
                { item: seeds.herb, weight: 14, minQuantity: 1, maxQuantity: 2, minLevel: 3 },
                { item: seeds.pumpkin, weight: 6, minQuantity: 1, maxQuantity: 1, minLevel: 5 }
            ]
        }
    ]
};

/**
 * The blacksmith: smelts ores and forges weapons and armor (see `world.crafting`).
 */
export const BLACKSMITHING_JOB: JobDefinition = {
    id: BLACKSMITHING_JOB_ID,
    name: "Blacksmith",
    description: "Smelt ores and forge weapons and armor. The higher your level, the stronger your work.",
    passive: true,
    actions: []
};

export const CRAFTING_JOBS: readonly JobDefinition[] = [FARMING_JOB, BLACKSMITHING_JOB, ENCHANTING_JOB];

// ── Crops ───────────────────────────────────────────────────────────────────
export const OFFICIAL_CROPS: readonly CropDefinition[] = [
    { id: "wheat", name: "Wheat", seed: seeds.wheat, growTimeMs: 60_000, xp: 10, yields: [{ item: wheat, minQuantity: 2, maxQuantity: 4 }], seedReturn: { minQuantity: 1, maxQuantity: 2 } },
    { id: "carrot", name: "Carrot", seed: seeds.carrot, growTimeMs: 90_000, xp: 12, yields: [{ item: carrot, minQuantity: 2, maxQuantity: 3 }], seedReturn: { minQuantity: 0, maxQuantity: 1 } },
    { id: "healing_herb", name: "Healing Herb", seed: seeds.herb, growTimeMs: 120_000, requiredLevel: 3, xp: 20, yields: [{ item: healingHerb, minQuantity: 1, maxQuantity: 3 }], seedReturn: { minQuantity: 0, maxQuantity: 1 } },
    { id: "pumpkin", name: "Pumpkin", seed: seeds.pumpkin, growTimeMs: 180_000, requiredLevel: 5, xp: 35, yields: [{ item: pumpkin, minQuantity: 1, maxQuantity: 2 }], seedReturn: { minQuantity: 1, maxQuantity: 2 } }
];

// ── Recipes ─────────────────────────────────────────────────────────────────
export const OFFICIAL_RECIPES: readonly RecipeDefinition[] = [
    // Farmer: cooking the harvest.
    { id: "bake_bread", name: "Bake bread", jobId: FARMING_JOB_ID, requiredLevel: 2, xp: 8, ingredients: [{ itemId: "wheat", quantity: 3 }], results: [{ item: bread, quantity: 2 }] },
    { id: "brew_herbal_tonic", name: "Brew herbal tonic", jobId: FARMING_JOB_ID, requiredLevel: 4, xp: 15, ingredients: [{ itemId: "healing_herb", quantity: 2 }], results: [{ item: herbalTonic, quantity: 1 }] },
    // Blacksmith: smelting.
    { id: "smelt_copper_ingot", name: "Smelt copper ingot", jobId: BLACKSMITHING_JOB_ID, requiredLevel: 1, xp: 6, ingredients: [{ itemId: "copper_ore", quantity: 2 }, { itemId: "coal", quantity: 1 }], results: [{ item: copperIngot, quantity: 1 }] },
    { id: "smelt_iron_ingot", name: "Smelt iron ingot", jobId: BLACKSMITHING_JOB_ID, requiredLevel: 3, xp: 12, ingredients: [{ itemId: "iron_ore", quantity: 2 }, { itemId: "coal", quantity: 1 }], results: [{ item: ironIngot, quantity: 1 }] },
    { id: "smelt_steel_ingot", name: "Smelt steel ingot", jobId: BLACKSMITHING_JOB_ID, requiredLevel: 8, xp: 30, ingredients: [{ itemId: "iron_ingot", quantity: 2 }, { itemId: "coal", quantity: 3 }], results: [{ item: steelIngot, quantity: 1 }] },
    // Blacksmith: forging. `scaling` is the percentage of the base stat gained per level above the required one.
    { id: "forge_copper_sword", name: "Forge copper sword", jobId: BLACKSMITHING_JOB_ID, requiredLevel: 1, xp: 15, ingredients: [{ itemId: "copper_ingot", quantity: 3 }, { itemId: "oak_log", quantity: 1 }], results: [{ item: copperSword, quantity: 1, scaling: { damageBonus: 5, durability: 5 } }] },
    { id: "forge_iron_sword", name: "Forge iron sword", jobId: BLACKSMITHING_JOB_ID, requiredLevel: 3, xp: 30, ingredients: [{ itemId: "iron_ingot", quantity: 3 }, { itemId: "oak_log", quantity: 1 }], results: [{ item: ironSword, quantity: 1, scaling: { damageBonus: 5, durability: 5 } }] },
    { id: "forge_iron_helmet", name: "Forge iron helmet", jobId: BLACKSMITHING_JOB_ID, requiredLevel: 4, xp: 30, ingredients: [{ itemId: "iron_ingot", quantity: 4 }], results: [{ item: ironHelmet, quantity: 1, scaling: { defenseBonus: 5, durability: 5 } }] },
    { id: "forge_iron_chestplate", name: "Forge iron chestplate", jobId: BLACKSMITHING_JOB_ID, requiredLevel: 5, xp: 45, ingredients: [{ itemId: "iron_ingot", quantity: 6 }], results: [{ item: ironChestplate, quantity: 1, scaling: { defenseBonus: 5, durability: 5 } }] },
    { id: "forge_steel_sword", name: "Forge steel sword", jobId: BLACKSMITHING_JOB_ID, requiredLevel: 8, xp: 80, ingredients: [{ itemId: "steel_ingot", quantity: 3 }, { itemId: "oak_log", quantity: 2 }], results: [{ item: steelSword, quantity: 1, scaling: { damageBonus: 4, durability: 4 } }] }
];

export { OFFICIAL_ENCHANTMENTS };
