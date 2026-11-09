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
 * What happens when a consumable item is used (see `InventoryEntity.use`).
 * At least one field is required; every field can be combined.
 */
export interface ItemUse {
    /** Instant healing, in health points (capped at the maximum health). */
    readonly heal?: number;
    /** Identifiers of the effects (see `EffectDefinition`) applied to the player, in order. */
    readonly effects?: readonly string[];
    /** Identifier of the lootbox (see `LootboxDefinition`) opened by the item. */
    readonly lootbox?: string;
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
    /**
     * Item data given to every new instance that is added without explicit data
     * (e.g. the damage and durability of a weapon, the modifiers of an amulet).
     */
    readonly defaultNbt?: ItemNBT;
    /** Built-in behaviour of a consumable (heal, effects, lootbox). Resolved from the item registry when the item is used. */
    readonly use?: ItemUse;
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

/**
 * Field of {@link EquipmentRecord} that holds the item worn in each equipment slot.
 */
export const EQUIPMENT_RECORD_KEYS: Readonly<Record<EquipmentSlot, Exclude<keyof EquipmentRecord, "playerId">>> = {
    helmet: "helmetItemId",
    chest: "chestItemId",
    leggings: "leggingsItemId",
    boots: "bootsItemId",
    sword: "swordItemId",
    shield: "shieldItemId",
    amulet1: "amuletOneItemId",
    amulet2: "amuletTwoItemId",
    amulet3: "amuletThreeItemId"
};
