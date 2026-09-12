import { ItemCategory, ItemRarity, ItemType } from "./item.enum.js";

export interface ItemNBT {
    damageBonus?: number;       // Ex: +0.1 (pour 0.1% ou 0.1 flat selon ton calcul)
    healthBonus?: number;       // Ex: +20 HP
    defenseBonus?: number;      // Ex: +5 de réduction de dégâts
    durability?: number;
    [key: string]: unknown;
}

/**
 * Définition complète d'un item (ses propriétés de base, son nom, sa rareté, etc.)
 */
export interface Item {
    itemId: ItemType | string;
    name: string;
    category: ItemCategory;
    rarity: ItemRarity;
    maxStack?: number;
    description?: string;
}

// Alias de rétrocompatibilité si d'autres fichiers utilisaient déjà ItemDefinition
export type ItemDefinition = Item;

export interface AddItemParameters {
    type: ItemType | string;
    number: number;
    data?: ItemNBT;
}

export interface RemoveItemParameters {
    type: ItemType | string;
    number: number;
}

export interface InventoryItemRecord extends Item {
    playerId: string;
    itemId: string;
    quantity: number;
    data?: ItemNBT | null;
    isEquipped?: boolean;
    equipmentSlot?: string | null;
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