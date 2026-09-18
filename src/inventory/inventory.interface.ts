import { EquipmentSlot, ItemCategory, ItemRarity } from "./item.enum.js";

/**
 * Represents custom metadata, modifiers, or stats attached to an item instance.
 */
export interface ItemNBT {
    experienceBonus?: number;
    damageBonus?: number;
    healthBonus?: number;
    defenseBonus?: number;
    criticalHitRateBonus?: number;
    durability?: number;
    [key: string]: unknown;
}

/**
 * Represents the core definition and static properties of an item.
 */
export interface Item {
    readonly itemId: string;
    readonly name: string;
    readonly category: ItemCategory;
    readonly rarity: ItemRarity;
    readonly maxStack?: number;
    readonly description?: string;
}

/**
 * Alias representing a static item definition template.
 */
export type ItemDefinition = Item;

/**
 * Parameters required to add an item to an inventory or collection.
 */
export interface AddItemParameters {
    readonly itemId: string;
    readonly quantity: number;
    readonly itemNbtData?: ItemNBT;
}

/**
 * Parameters required to remove an item from an inventory or collection.
 */
export interface RemoveItemParameters {
    readonly itemId: string;
    readonly quantity: number;
}

/**
 * Represents an individual item instance record stored within a player's inventory.
 */
export interface InventoryItemRecord extends Item {
    readonly playerId: string;
    quantity: number;
    itemNbtData?: ItemNBT | null;
    isEquipped?: boolean;
    equipmentSlot?: EquipmentSlot | null;
}

/**
 * Represents the active equipment configuration slots mapped to a player.
 */
export interface EquipmentRecord {
    playerId: string;
    helmetItemId: string | null;
    chestItemId: string | null;
    leggingsItemId: string | null;
    bootsItemId: string | null;
    swordItemId: string | null;
    shieldItemId: string | null;
    amuletOneItemId: string | null;
    amuletTwoItemId: string | null;
    amuletThreeItemId: string | null;
}