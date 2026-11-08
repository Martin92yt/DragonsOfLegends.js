import InventoryDatabase from "./inventory.database.js";
import { ItemNBT, InventoryItemRecord, EquipmentRecord } from "./inventory.interface.js";
import { consola } from "consola";
import { EquipmentSlot, ItemCategory, ItemRarity } from "./item.enum.js";
import PlayerEntity from "../player/player.entity.js";
import { Item } from "./inventory.interface.js";
import AsyncQueue from "../utils/async-queue.js";
import type { LootboxOpenResult } from "../lootbox/lootbox.types.js";

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

    private readonly useQueue = new AsyncQueue();

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
    public async load(): Promise<InventoryItemRecord[]> {
        const result = this.inventoryDatabaseInstance.getPlayerInventory(this.playerIdIdentifier);
        return result instanceof Promise ? await result : result;
    }

    /**
     * Returns the player's inventory items.
     *
     * @returns An array of the player's inventory items.
     */
    public async getItems(): Promise<InventoryItemRecord[]> {
        return await this.load();
    }

    /**
     * Returns the player's equipment.
     *
     * @returns The player's equipment record.
     */
    public async getEquipment(): Promise<EquipmentRecord> {
        const result = this.inventoryDatabaseInstance.getPlayerEquipment(this.playerIdIdentifier);
        return result instanceof Promise ? await result : result;
    }

    /**
     * Adds an item to the inventory.
     *
     * @param itemInput The item identifier or item definition.
     * @param itemQuantity The amount to add.
     * @param itemNbtData The optional item data.
     * @returns void
     */
    public async add(itemInput: ItemInput, itemQuantity = 1, itemNbtData: ItemNBT | null = null): Promise<void> {
        if (itemQuantity <= 0) {
            return;
        }

        const extractedItemId = typeof itemInput === "string" ? itemInput : itemInput.itemId;
        if (!extractedItemId) {
            consola.warn(`Attempt to add item with empty identifier for player ${this.getOwnerName()}.`);
            return;
        }

        const inputItemNbtData = typeof itemInput === "string" ? null : itemInput.data ?? null;
        // Rationale: an item added without explicit data gets the default data of its definition (e.g. the modifiers of an amulet).
        const defaultItemData = typeof itemInput === "string" ? null : (itemInput.defaultNbt ? { ...itemInput.defaultNbt } : null);
        const resolvedItemData = itemNbtData ?? inputItemNbtData ?? defaultItemData;
        const inventoryItems = await this.load();
        let addedItemName: string;
        const existingInventoryItem = inventoryItems.find(
            itemRecord => itemRecord.itemId === extractedItemId && !itemRecord.isEquipped && JSON.stringify(itemRecord.itemNbtData ?? null) === JSON.stringify(resolvedItemData)
        );

        if (existingInventoryItem && !resolvedItemData) {
            existingInventoryItem.quantity += itemQuantity;
            // Rationale: the definition passed by the caller is the reliable display name (stored names can be the item id).
            addedItemName = typeof itemInput === "string" ? existingInventoryItem.name : itemInput.name;
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
            addedItemName = itemInput.name;
            consola.success(`Added ${itemQuantity}x ${itemInput.name} to inventory for ${this.getOwnerName()}.`);
        } else {
            consola.warn(`Failed to add item ${extractedItemId} to inventory: missing item definition.`);
            return;
        }

        const saveResult = this.inventoryDatabaseInstance.savePlayerInventory(this.playerIdIdentifier, inventoryItems);
        if (saveResult instanceof Promise) await saveResult;

        await this.playerEntityReference.worldInstance.events.emitAsync("itemAdd", {
            playerId: this.playerIdIdentifier,
            player: this.playerEntityReference,
            itemId: extractedItemId,
            name: addedItemName,
            quantity: itemQuantity
        });
    }

    /**
     * Removes an item from the inventory.
     *
     * @param itemInput The item identifier or item reference.
     * @param itemQuantity The amount to remove.
     * @returns True if the item was successfully removed, false otherwise.
     */
    public async remove(itemInput: string | Pick<Item, "itemId">, itemQuantity = 1): Promise<boolean> {
        this.playerEntityReference.assertCanAct("inventory.remove");
        if (itemQuantity <= 0) {
            return false;
        }

        const extractedItemId = typeof itemInput === "string" ? itemInput : itemInput.itemId;
        const inventoryItems = await this.load();
        const inventoryItemRecord = inventoryItems.find(inventoryItem => inventoryItem.itemId === extractedItemId && !inventoryItem.isEquipped);

        if (!inventoryItemRecord || inventoryItemRecord.quantity < itemQuantity) {
            consola.warn(`Failed to remove ${itemQuantity}x ${extractedItemId} from inventory for ${this.getOwnerName()}: insufficient quantity.`);
            return false;
        }

        inventoryItemRecord.quantity -= itemQuantity;
        const saveResult = this.inventoryDatabaseInstance.savePlayerInventory(
            this.playerIdIdentifier,
            inventoryItems.filter(inventoryItem => inventoryItem.quantity > 0)
        );
        if (saveResult instanceof Promise) await saveResult;

        consola.success(`Removed ${itemQuantity}x ${extractedItemId} from inventory for ${this.getOwnerName()}.`);
        await this.playerEntityReference.worldInstance.events.emitAsync("itemRemove", {
            playerId: this.playerIdIdentifier,
            player: this.playerEntityReference,
            itemId: extractedItemId,
            quantity: itemQuantity
        });
        return true;
    }

    /**
     * Equips an item in the specified slot.
     *
     * @param equipmentSlot The equipment slot.
     * @param itemId The item identifier.
     * @returns True if the item was successfully equipped, false otherwise.
     */
    public async equip(equipmentSlot: EquipmentSlot, itemId: string): Promise<boolean> {
        this.playerEntityReference.assertCanAct("inventory.equip");
        const inventoryItems = await this.load();
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

        const replacedItemId = inventoryItems.find(itemRecord => itemRecord.isEquipped && itemRecord.equipmentSlot === equipmentSlot)?.itemId;
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

        const saveResult = this.inventoryDatabaseInstance.savePlayerInventory(this.playerIdIdentifier, inventoryItems);
        if (saveResult instanceof Promise) await saveResult;

        this.playerEntityReference?.updateMaxHealth();
        consola.success(`${this.getOwnerName()} equipped ${targetInventoryItem.name} to ${equipmentSlot}.`);

        const { events } = this.playerEntityReference.worldInstance;
        if (replacedItemId !== undefined) {
            await events.emitAsync("itemUnequip", { playerId: this.playerIdIdentifier, player: this.playerEntityReference, itemId: replacedItemId, slot: equipmentSlot });
        }
        await events.emitAsync("itemEquip", { playerId: this.playerIdIdentifier, player: this.playerEntityReference, itemId, slot: equipmentSlot });
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
    public async unequip(equipmentSlot: EquipmentSlot): Promise<boolean> {
        this.playerEntityReference.assertCanAct("inventory.unequip");
        const inventoryItems = await this.load();
        const equippedItemRecord = inventoryItems.find(itemRecord => itemRecord.isEquipped && itemRecord.equipmentSlot === equipmentSlot);

        if (!equippedItemRecord) {
            consola.warn(`Failed to unequip slot ${equipmentSlot} for ${this.getOwnerName()}: no item equipped.`);
            return false;
        }

        equippedItemRecord.isEquipped = false;
        equippedItemRecord.equipmentSlot = null;

        const saveResult = this.inventoryDatabaseInstance.savePlayerInventory(this.playerIdIdentifier, inventoryItems);
        if (saveResult instanceof Promise) await saveResult;

        this.playerEntityReference?.updateMaxHealth();
        consola.success(`${this.getOwnerName()} unequipped ${equippedItemRecord.name} from ${equipmentSlot}.`);
        await this.playerEntityReference.worldInstance.events.emitAsync("itemUnequip", {
            playerId: this.playerIdIdentifier,
            player: this.playerEntityReference,
            itemId: equippedItemRecord.itemId,
            slot: equipmentSlot
        });
        return true;
    }

    /**
     * Clears the player's inventory.
     *
     * @returns True if the inventory was successfully cleared, false otherwise.
     */
    public async clear(): Promise<boolean> {
        const clearResult = this.inventoryDatabaseInstance.clearInventory(this.playerIdIdentifier);
        const isInventoryCleared = clearResult instanceof Promise ? await clearResult : clearResult;
        
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
    public async save(itemsToSave?: InventoryItemRecord[]): Promise<void> {
        const itemsList = itemsToSave ?? (await this.load());
        const saveResult = this.inventoryDatabaseInstance.savePlayerInventory(this.playerIdIdentifier, itemsList);
        if (saveResult instanceof Promise) await saveResult;

        const dbSaveResult = this.inventoryDatabaseInstance.save();
        if (dbSaveResult instanceof Promise) await dbSaveResult;
    }

    /**
     * Returns the equipped item in a slot.
     *
     * @param equipmentSlot The equipment slot.
     * @returns The equipped item record or undefined.
     */
    public async getEquippedInSlot(equipmentSlot: EquipmentSlot): Promise<InventoryItemRecord | undefined> {
        const items = await this.load();
        return items.find(itemRecord => itemRecord.isEquipped && itemRecord.equipmentSlot === equipmentSlot);
    }

    /**
     * Uses consumable items: one unit is consumed per use, then its behaviour runs (instant heal, temporary effects,
     * lootbox, see {@link Item.use}). Consumables without behaviour are simply consumed.
     * Uses are serialized per inventory, so the same item cannot be spent twice by concurrent calls.
     *
     * @param itemInput The item identifier or item reference.
     * @param itemQuantity The number of units to use (a positive integer).
     * @returns True if the item was used, false if it is not an unequipped consumable the player owns in that quantity.
     * @throws {PlayerDeadError} If the player is dead (thrown synchronously).
     */
    public use(itemInput: string | Pick<Item, "itemId">, itemQuantity = 1): Promise<boolean> {
        this.playerEntityReference.assertCanAct("inventory.use");
        if (!Number.isInteger(itemQuantity) || itemQuantity <= 0) {
            return Promise.resolve(false);
        }

        const itemId = typeof itemInput === "string" ? itemInput : itemInput.itemId;
        return this.useQueue.run(() => this.consume(itemId, itemQuantity));
    }

    private async consume(itemId: string, quantity: number): Promise<boolean> {
        const player = this.playerEntityReference;
        player.assertCanAct("inventory.use"); // re-checked: the player may have died while queued

        const owned = (await this.load())
            .filter((record) => record.itemId === itemId && !record.isEquipped)
            .reduce((sum, record) => sum + record.quantity, 0);
        const record = (await this.load()).find((candidate) => candidate.itemId === itemId && !candidate.isEquipped);
        if (!record || record.category !== ItemCategory.Consumables || owned < quantity) {
            return false;
        }
        if (!(await this.removeUnequipped(itemId, quantity))) {
            return false;
        }

        const behaviour = player.worldInstance.items.get(itemId)?.use;
        let healed = 0;
        const effects: string[] = [];
        const lootboxes: LootboxOpenResult[] = [];
        for (let unit = 0; unit < quantity; unit++) {
            if (behaviour?.heal) healed += player.heal(behaviour.heal, `item:${itemId}`);
            for (const effectId of behaviour?.effects ?? []) {
                await player.effects.apply(effectId);
                effects.push(effectId);
            }
            if (behaviour?.lootbox) lootboxes.push(await player.worldInstance.lootboxes.open(player, behaviour.lootbox));
        }

        consola.success(`Used ${quantity}x ${itemId} for ${this.getOwnerName()}.`);
        await player.worldInstance.events.emitAsync("itemUse", { playerId: player.id, player, itemId, quantity, healed, effects, lootboxes });
        return true;
    }

    /**
     * Removes a quantity that may span several stacks (the same item with different item data).
     */
    private async removeUnequipped(itemId: string, quantity: number): Promise<boolean> {
        let remaining = quantity;
        while (remaining > 0) {
            const stack = (await this.load()).find((record) => record.itemId === itemId && !record.isEquipped);
            if (!stack) return false;
            const taken = Math.min(stack.quantity, remaining);
            if (!(await this.remove(itemId, taken))) return false;
            remaining -= taken;
        }
        return true;
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
    public async sellItem(itemId: string, itemQuantity = 1): Promise<number> {
        this.playerEntityReference.assertCanAct("inventory.sell");
        if (itemQuantity <= 0) {
            return 0;
        }

        const inventoryItems = await this.load();
        const inventoryItemRecord = inventoryItems.find(itemRecord => itemRecord.itemId === itemId && !itemRecord.isEquipped);

        if (!inventoryItemRecord || inventoryItemRecord.quantity < itemQuantity) {
            consola.warn(`Failed to sell ${itemQuantity}x ${itemId} for ${this.getOwnerName()}: insufficient quantity.`);
            return 0;
        }

        const calculatedGoldAmount = this.calculateSellValue(inventoryItemRecord, itemQuantity);

        const removeResult = await this.remove(itemId, itemQuantity);
        if (!removeResult) {
            return 0;
        }

        if (this.playerEntityReference) {
            this.playerEntityReference.gold += calculatedGoldAmount;
        }

        consola.success(`${this.getOwnerName()} sold ${itemQuantity}x ${inventoryItemRecord.name} for ${calculatedGoldAmount} gold.`);
        await this.playerEntityReference.worldInstance.events.emitAsync("itemSell", {
            playerId: this.playerIdIdentifier,
            player: this.playerEntityReference,
            itemId,
            quantity: itemQuantity,
            gold: calculatedGoldAmount
        });
        return calculatedGoldAmount;
    }
}