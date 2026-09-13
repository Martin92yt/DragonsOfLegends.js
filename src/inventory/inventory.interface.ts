import { EquipmentSlot, ItemCategory, ItemRarity } from "./item.enum.js";

export interface ItemNBT {
    damageBonus?: number;
    healthBonus?: number;
    defenseBonus?: number;
    critRateBonus?: number;
    durability?: number;
    [key: string]: unknown;
}

export interface Item {
    itemId: string;
    name: string;
    category: ItemCategory;
    rarity: ItemRarity;
    maxStack?: number;
    description?: string;
}

export type ItemDefinition = Item;

export interface AddItemParameters {
    type: string;
    number: number;
    data?: ItemNBT;
}

export interface RemoveItemParameters {
    type: string;
    number: number;
}

export interface InventoryItemRecord extends Item {
    playerId: string;
    quantity: number;
    data?: ItemNBT | null;
    isEquipped?: boolean;
    equipmentSlot?: EquipmentSlot | null;
}

export interface EquipmentRecord {
    playerId: string;
    helmet: string | null;
    chest: string | null;
    leggings: string | null;
    boots: string | null;
    sword: string | null;
    shield: string | null;
    amulet1: string | null;
    amulet2: string | null;
    amulet3: string | null;
}
