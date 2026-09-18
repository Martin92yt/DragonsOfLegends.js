export enum ItemCategory {
    Weapons = "weapons",
    Armor = "armor",
    Consumables = "consumables",
    Materials = "materials",
    Valuables = "valuables",
    Amulet = "amulet",
    Tool = "tool"
}

export enum ItemRarity {
    Common = "common",
    Uncommon = "uncommon",
    Rare = "rare",
    Epic = "epic",
    Legendary = "legendary"
}

export const VALID_EQUIPMENT_SLOTS = [
    "helmet",
    "chest",
    "leggings",
    "boots",
    "sword",
    "shield",
    "amulet1",
    "amulet2",
    "amulet3"
] as const;

export type EquipmentSlot = typeof VALID_EQUIPMENT_SLOTS[number];

const VALID_ITEM_CATEGORIES: ReadonlySet<unknown> = new Set(Object.values(ItemCategory));
const VALID_ITEM_RARITIES: ReadonlySet<unknown> = new Set(Object.values(ItemRarity));
const VALID_EQUIPMENT_SLOTS_SET: ReadonlySet<unknown> = new Set(VALID_EQUIPMENT_SLOTS);

/**
 * Checks whether an unknown value is a valid item category.
 *
 * @param potentialItemCategory The value to check.
 * @returns True if the value is a valid ItemCategory, false otherwise.
 */
export const isItemCategory = (potentialItemCategory: unknown): potentialItemCategory is ItemCategory =>
    VALID_ITEM_CATEGORIES.has(potentialItemCategory);

/**
 * Checks whether an unknown value is a valid item rarity.
 *
 * @param potentialItemRarity The value to check.
 * @returns True if the value is a valid ItemRarity, false otherwise.
 */
export const isItemRarity = (potentialItemRarity: unknown): potentialItemRarity is ItemRarity =>
    VALID_ITEM_RARITIES.has(potentialItemRarity);

/**
 * Checks whether an unknown value is a valid equipment slot.
 *
 * @param potentialEquipmentSlot The value to check.
 * @returns True if the value is a valid EquipmentSlot, false otherwise.
 */
export const isEquipmentSlot = (potentialEquipmentSlot: unknown): potentialEquipmentSlot is EquipmentSlot =>
    VALID_EQUIPMENT_SLOTS_SET.has(potentialEquipmentSlot);