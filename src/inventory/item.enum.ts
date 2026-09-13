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