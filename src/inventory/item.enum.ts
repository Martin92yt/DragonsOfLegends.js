export enum ItemType {
    KnightSword = "knight_sword",
    HealthPotion = "health_potion",
    MagicStaff = "magic_staff",
    GoldCoin = "gold_coin",
}

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
    Legendary = "legendary",
}

export type EquipmentSlot = 
    | "helmet" 
    | "chest" 
    | "leggings" 
    | "boots" 
    | "sword" 
    | "shield" 
    | "amulet1" 
    | "amulet2" 
    | "amulet3";