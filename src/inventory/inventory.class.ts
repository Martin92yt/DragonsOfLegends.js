import InventoryDatabase from "./inventory.database.js";
import { ItemNBT, InventoryItemRecord, EquipmentRecord } from "./inventory.interface.js";
import { consola } from "consola";
import { EquipmentSlot, ItemCategory, ItemRarity } from "./item.enum.js";
import PlayerEntity from "../player/player.entity.js";
import { Item } from "./inventory.interface.js";

type ItemInput = string | (Item & { data?: ItemNBT | null });

export class InventoryEntity {
    public readonly inventoryDatabaseInstance: InventoryDatabase;
    
    private static readonly EQUIPMENT_CATEGORIES: Readonly<Record<EquipmentSlot, readonly ItemCategory[]>> = {
        helmet: [ItemCategory.Armor],
        chest: [ItemCategory.Armor],
        leggings: [ItemCategory.Armor],
        boots: [ItemCategory.Armor],
        sword: [ItemCategory.Weapons, ItemCategory.Tool],
        shield: [ItemCategory.Armor, ItemCategory.Tool],
        amulet1: [ItemCategory.Amulet, ItemCategory.Valuables],
        amulet2: [ItemCategory.Amulet, ItemCategory.Valuables],
        amulet3: [ItemCategory.Amulet, ItemCategory.Valuables]
    };

    private static readonly RARITY_SELL_MULTIPLIERS: Readonly<Record<ItemRarity, number>> = {
        [ItemRarity.Common]: 1,
        [ItemRarity.Uncommon]: 2,
        [ItemRarity.Rare]: 5,
        [ItemRarity.Epic]: 15,
        [ItemRarity.Legendary]: 50
    };

    private static readonly CATEGORY_SELL_MULTIPLIERS: Readonly<Partial<Record<ItemCategory, number>>> = {
        [ItemCategory.Materials]: 1,
        [ItemCategory.Valuables]: 2,
        [ItemCategory.Consumables]: 1.5,
        [ItemCategory.Weapons]: 4,
        [ItemCategory.Armor]: 3
    };

    public readonly playerIdIdentifier: string;
    public playerEntityReference: PlayerEntity;

    /**
     * Creates an inventory entity.
     *
     * @param playerIdIdentifier The player identifier.
     * @param playerEntityReference The optional player reference.
     * @returns void
     */
    public constructor(playerIdIdentifier: string, playerEntityReference: PlayerEntity) {
        this.playerIdIdentifier = playerIdIdentifier;
        this.playerEntityReference = playerEntityReference;
        this.inventoryDatabaseInstance = new InventoryDatabase(this);
    }

    /**
     * Sets the associated player.
     *
     * @param playerEntity The player entity.
     * @returns void
     */
    public setPlayer(playerEntity: PlayerEntity): void {
        this.playerEntityReference = playerEntity;
    }

    /**
     * Resolves and returns the player display name or identifier.
     */
    private getOwnerName(): string {
        return this.playerEntityReference?.name ?? this.playerIdIdentifier;
    }

    /**
     * Loads the player's inventory.
     *
     * @returns An array of the player's inventory items.
     */
    public load(): InventoryItemRecord[] {
        return this.inventoryDatabaseInstance.getPlayerInventory(this.playerIdIdentifier);
    }

    /**
     * Returns the player's inventory items.
     *
     * @returns An array of the player's inventory items.
     */
    public getItems(): InventoryItemRecord[] {
        return this.load();
    }

    /**
     * Returns the player's equipment.
     *
     * @returns The player's equipment record.
     */
    public getEquipment(): EquipmentRecord {
        return this.inventoryDatabaseInstance.getPlayerEquipment(this.playerIdIdentifier);
    }

    /**
     * Adds an item to the inventory.
     *
     * @param itemInput The item identifier or item definition.
     * @param itemQuantity The amount to add.
     * @param itemNbtData The optional item data.
     * @returns void
     */
    public add(itemInput: ItemInput, itemQuantity = 1, itemNbtData: ItemNBT | null = null): void {
        if (itemQuantity <= 0) {
            return;
        }

        const extractedItemId = typeof itemInput === "string" ? itemInput : itemInput.itemId;
        if (!extractedItemId) {
            consola.warn(`Attempt to add item with empty identifier for player ${this.getOwnerName()}.`);
            return;
        }

        const inputItemNbtData = typeof itemInput === "string" ? null : itemInput.data ?? null;
        const resolvedItemData = itemNbtData ?? inputItemNbtData;
        const inventoryItems = this.load();
        const existingInventoryItem = inventoryItems.find(
            itemRecord => itemRecord.itemId === extractedItemId && !itemRecord.isEquipped && JSON.stringify(itemRecord.itemNbtData ?? null) === JSON.stringify(resolvedItemData)
        );

        if (existingInventoryItem && !resolvedItemData) {
            existingInventoryItem.quantity += itemQuantity;
            consola.success(`Added ${itemQuantity}x ${existingInventoryItem.name} to inventory for ${this.getOwnerName()}.`);
        } else if (typeof itemInput !== "string") {
            inventoryItems.push({
                ...itemInput,
                playerId: this.playerIdIdentifier,
                quantity: itemQuantity,
                itemNbtData: resolvedItemData,
                maxStack: itemInput.maxStack ?? 64,
                isEquipped: false,
                equipmentSlot: null
            });
            consola.success(`Added ${itemQuantity}x ${itemInput.name} to inventory for ${this.getOwnerName()}.`);
        } else {
            consola.warn(`Failed to add item ${extractedItemId} to inventory: missing item definition.`);
            return;
        }

        this.inventoryDatabaseInstance.savePlayerInventory(this.playerIdIdentifier, inventoryItems);
    }

    /**
     * Removes an item from the inventory.
     *
     * @param itemInput The item identifier or item reference.
     * @param itemQuantity The amount to remove.
     * @returns True if the item was successfully removed, false otherwise.
     */
    public remove(itemInput: string | Pick<Item, "itemId">, itemQuantity = 1): boolean {
        if (itemQuantity <= 0) {
            return false;
        }

        const extractedItemId = typeof itemInput === "string" ? itemInput : itemInput.itemId;
        const inventoryItems = this.load();
        const inventoryItemRecord = inventoryItems.find(inventoryItem => inventoryItem.itemId === extractedItemId && !inventoryItem.isEquipped);

        if (!inventoryItemRecord || inventoryItemRecord.quantity < itemQuantity) {
            consola.warn(`Failed to remove ${itemQuantity}x ${extractedItemId} from inventory for ${this.getOwnerName()}: insufficient quantity.`);
            return false;
        }

        inventoryItemRecord.quantity -= itemQuantity;
        this.inventoryDatabaseInstance.savePlayerInventory(
            this.playerIdIdentifier,
            inventoryItems.filter(inventoryItem => inventoryItem.quantity > 0)
        );
        consola.success(`Removed ${itemQuantity}x ${extractedItemId} from inventory for ${this.getOwnerName()}.`);
        return true;
    }

    /**
     * Equips an item in the specified slot.
     *
     * @param equipmentSlot The equipment slot.
     * @param itemId The item identifier.
     * @returns True if the item was successfully equipped, false otherwise.
     */
    public equip(equipmentSlot: EquipmentSlot, itemId: string): boolean {
        const inventoryItems = this.load();
        const targetInventoryItem = inventoryItems.find(itemRecord => itemRecord.itemId === itemId && !itemRecord.isEquipped);

        if (!targetInventoryItem) {
            consola.warn(`Failed to equip ${itemId} for ${this.getOwnerName()}: item not found in inventory.`);
            return false;
        }

        const permittedCategories = InventoryEntity.EQUIPMENT_CATEGORIES[equipmentSlot];
        if (!permittedCategories.includes(targetInventoryItem.category)) {
            consola.warn(`Failed to equip ${itemId} to ${equipmentSlot}: category ${targetInventoryItem.category} is not permitted.`);
            return false;
        }

        this.unequipSlotIfExists(inventoryItems, equipmentSlot);

        if (targetInventoryItem.quantity > 1) {
            targetInventoryItem.quantity--;
            inventoryItems.push({
                ...targetInventoryItem,
                quantity: 1,
                isEquipped: true,
                equipmentSlot
            });
        } else {
            targetInventoryItem.isEquipped = true;
            targetInventoryItem.equipmentSlot = equipmentSlot;
        }

        this.inventoryDatabaseInstance.savePlayerInventory(this.playerIdIdentifier, inventoryItems);
        this.playerEntityReference?.updateMaxHealth();
        consola.success(`${this.getOwnerName()} equipped ${targetInventoryItem.name} to ${equipmentSlot}.`);
        return true;
    }

    /**
     * Unequips the item currently present in a given slot if it exists.
     */
    private unequipSlotIfExists(inventoryItems: InventoryItemRecord[], equipmentSlot: EquipmentSlot): void {
        const currentlyEquippedItem = inventoryItems.find(itemRecord => itemRecord.isEquipped && itemRecord.equipmentSlot === equipmentSlot);
        if (currentlyEquippedItem) {
            currentlyEquippedItem.isEquipped = false;
            currentlyEquippedItem.equipmentSlot = null;
        }
    }

    /**
     * Unequips the item in the specified slot.
     *
     * @param equipmentSlot The equipment slot.
     * @returns True if an item was unequipped, false otherwise.
     */
    public unequip(equipmentSlot: EquipmentSlot): boolean {
        const inventoryItems = this.load();
        const equippedItemRecord = inventoryItems.find(itemRecord => itemRecord.isEquipped && itemRecord.equipmentSlot === equipmentSlot);

        if (!equippedItemRecord) {
            consola.warn(`Failed to unequip slot ${equipmentSlot} for ${this.getOwnerName()}: no item equipped.`);
            return false;
        }

        equippedItemRecord.isEquipped = false;
        equippedItemRecord.equipmentSlot = null;
        this.inventoryDatabaseInstance.savePlayerInventory(this.playerIdIdentifier, inventoryItems);
        this.playerEntityReference?.updateMaxHealth();
        consola.success(`${this.getOwnerName()} unequipped ${equippedItemRecord.name} from ${equipmentSlot}.`);
        return true;
    }

    /**
     * Clears the player's inventory.
     *
     * @returns True if the inventory was successfully cleared, false otherwise.
     */
    public clear(): boolean {
        const isInventoryCleared = this.inventoryDatabaseInstance.clearInventory(this.playerIdIdentifier);
        if (isInventoryCleared) {
            consola.success(`Cleared inventory for ${this.getOwnerName()}.`);
        }
        return isInventoryCleared;
    }

    /**
     * Saves the player's inventory.
     *
     * @param itemsToSave The optional inventory items to save.
     * @returns void
     */
    public save(itemsToSave?: InventoryItemRecord[]): void {
        const itemsList = itemsToSave ?? this.load();
        this.inventoryDatabaseInstance.savePlayerInventory(this.playerIdIdentifier, itemsList);
        this.inventoryDatabaseInstance.save();
        consola.success(`Saved inventory for ${this.getOwnerName()}.`);
    }

    /**
     * Returns the equipped item in a slot.
     *
     * @param equipmentSlot The equipment slot.
     * @returns The equipped item record or undefined.
     */
    public getEquippedInSlot(equipmentSlot: EquipmentSlot): InventoryItemRecord | undefined {
        return this.load().find(itemRecord => itemRecord.isEquipped && itemRecord.equipmentSlot === equipmentSlot);
    }

    /**
     * Uses an inventory item.
     *
     * @param itemInput The item identifier or item reference.
     * @param itemQuantity The amount to use.
     * @returns True if the item was used, false otherwise.
     */
    public use(itemInput: string | Pick<Item, "itemId">, itemQuantity = 1): boolean {
        if (itemQuantity <= 0) {
            return false;
        }

        const extractedItemId = typeof itemInput === "string" ? itemInput : itemInput.itemId;
        consola.success(`Used ${itemQuantity}x ${extractedItemId} for ${this.getOwnerName()}.`);
        return false;
    }

    /**
     * Calculates the gold value for selling a specific item.
     */
    private calculateSellValue(inventoryItem: InventoryItemRecord, itemQuantity: number): number {
        const rarityMultiplier = InventoryEntity.RARITY_SELL_MULTIPLIERS[inventoryItem.rarity] ?? 1;
        const categoryMultiplier = InventoryEntity.CATEGORY_SELL_MULTIPLIERS[inventoryItem.category] ?? 1;
        
        const itemDurability = inventoryItem.itemNbtData?.durability ?? 100;
        const durabilityRatio = Math.max(0, Math.min(1, itemDurability / 100));
        
        return Math.max(1, Math.floor(10 * categoryMultiplier * rarityMultiplier * durabilityRatio * (itemQuantity / 9)));
    }

    /**
     * Sells an inventory item.
     *
     * @param itemId The item identifier.
     * @param itemQuantity The amount to sell.
     * @returns The amount of gold received.
     */
    public sellItem(itemId: string, itemQuantity = 1): number {
        if (itemQuantity <= 0) {
            return 0;
        }

        const inventoryItems = this.load();
        const inventoryItemRecord = inventoryItems.find(itemRecord => itemRecord.itemId === itemId && !itemRecord.isEquipped);

        if (!inventoryItemRecord || inventoryItemRecord.quantity < itemQuantity) {
            consola.warn(`Failed to sell ${itemQuantity}x ${itemId} for ${this.getOwnerName()}: insufficient quantity.`);
            return 0;
        }

        const calculatedGoldAmount = this.calculateSellValue(inventoryItemRecord, itemQuantity);

        if (!this.remove(itemId, itemQuantity)) {
            return 0;
        }

        if (this.playerEntityReference) {
            this.playerEntityReference.gold += calculatedGoldAmount;
        }

        consola.success(`${this.getOwnerName()} sold ${itemQuantity}x ${inventoryItemRecord.name} for ${calculatedGoldAmount} gold.`);
        return calculatedGoldAmount;
    }
}