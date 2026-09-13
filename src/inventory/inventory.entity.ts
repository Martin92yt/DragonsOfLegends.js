import InventoryDatabase from "./inventory.database.js";
import { ItemNBT, InventoryItemRecord, EquipmentRecord } from "./inventory.interface.js";
import { Logger } from "../utils/logger.js";
import { EquipmentSlot, ItemCategory, ItemRarity } from "./item.enum.js";
import PlayerEntity from "../player/player.entity.js";
import { Item } from "./inventory.interface.js";

type ItemInput = string | (Item & { data?: ItemNBT | null });

export class InventoryEntity {
    private static readonly inventoryDb = new InventoryDatabase();
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
    readonly #logger = new Logger({ context: "InventoryEntity" });
    public readonly identifier: string;
    private playerRef?: PlayerEntity;

    /**
     * Creates an inventory entity.
     *
     * @param identifier Player identifier.
     * @param playerRef Optional player reference.
     */
    public constructor(identifier: string, playerRef?: PlayerEntity) {
        this.identifier = identifier;
        this.playerRef = playerRef;
    }

    /**
     * Sets the associated player.
     *
     * @param player Player entity.
     */
    public setPlayer(player: PlayerEntity): void {
        this.playerRef = player;
    }

    /**
     * Loads the player's inventory.
     *
     * @returns The player's inventory items.
     */
    public load(): InventoryItemRecord[] {
        return InventoryEntity.inventoryDb.getPlayerInventory(this.identifier);
    }

    /**
     * Returns the player's inventory items.
     *
     * @returns The player's inventory items.
     */
    public getItems(): InventoryItemRecord[] {
        return this.load();
    }

    /**
     * Returns the player's equipment.
     *
     * @returns The player's equipment.
     */
    public getEquipment(): EquipmentRecord {
        return InventoryEntity.inventoryDb.getPlayerEquipment(this.identifier);
    }

    /**
     * Adds an item to the inventory.
     *
     * @param itemInput Item identifier or item definition.
     * @param quantity Amount to add.
     * @param data Optional item data.
     */
    public add(itemInput: ItemInput, quantity = 1, data: ItemNBT | null = null): void {
        if (quantity <= 0) {
            return;
        }

        const itemId = typeof itemInput === "string" ? itemInput : itemInput.itemId;
        if (!itemId) {
            return;
        }

        const inputData = typeof itemInput === "string" ? null : itemInput.data ?? null;
        const itemData = data ?? inputData;
        const items = this.load();
        const existingItem = items.find((item) => item.itemId === itemId && !item.isEquipped && JSON.stringify(item.data ?? null) === JSON.stringify(itemData));

        if (existingItem && !itemData) {
            existingItem.quantity += quantity;
            this.#logger.debug(`${this.playerRef?.name ?? this.identifier} received ${quantity}x ${existingItem.name}.`);
        } else if (typeof itemInput !== "string") {
            items.push({
                ...itemInput,
                playerId: this.identifier,
                quantity,
                data: itemData,
                maxStack: itemInput.maxStack ?? 64,
                isEquipped: false,
                equipmentSlot: null
            });
            this.#logger.debug(`${this.playerRef?.name ?? this.identifier} received ${quantity}x ${itemInput.name}.`);
        } else {
            return;
        }

        InventoryEntity.inventoryDb.savePlayerInventory(this.identifier, items);
    }

    /**
     * Removes an item from the inventory.
     *
     * @param itemInput Item identifier or item reference.
     * @param quantity Amount to remove.
     * @returns Whether the item was successfully removed.
     */
    public remove(itemInput: string | Pick<Item, "itemId">, quantity = 1): boolean {
        if (quantity <= 0) {
            return false;
        }

        const itemId = typeof itemInput === "string" ? itemInput : itemInput.itemId;
        const items = this.load();
        const item = items.find((inventoryItem) => inventoryItem.itemId === itemId && !inventoryItem.isEquipped);

        if (!item || item.quantity < quantity) {
            return false;
        }

        item.quantity -= quantity;
        InventoryEntity.inventoryDb.savePlayerInventory(this.identifier, items.filter((inventoryItem) => inventoryItem.quantity > 0));
        return true;
    }

    /**
     * Equips an item in the specified slot.
     *
     * @param slot Equipment slot.
     * @param itemId Item identifier.
     * @returns Whether the item was successfully equipped.
     */
    public equip(slot: EquipmentSlot, itemId: string): boolean {
        const items = this.load();
        const targetItem = items.find((item) => item.itemId === itemId && !item.isEquipped);

        if (!targetItem) {
            return false;
        }

        const allowedCategories = InventoryEntity.EQUIPMENT_CATEGORIES[slot];

        if (!allowedCategories.includes(targetItem.category)) {
            return false;
        }

        const currentEquipped = items.find((item) => item.isEquipped && item.equipmentSlot === slot);

        if (currentEquipped) {
            currentEquipped.isEquipped = false;
            currentEquipped.equipmentSlot = null;
        }

        if (targetItem.quantity > 1) {
            targetItem.quantity--;
            items.push({
                ...targetItem,
                quantity: 1,
                isEquipped: true,
                equipmentSlot: slot
            });
        } else {
            targetItem.isEquipped = true;
            targetItem.equipmentSlot = slot;
        }

        InventoryEntity.inventoryDb.savePlayerInventory(this.identifier, items);
        this.playerRef?.updateMaxHealth();
        this.#logger.info(`${this.playerRef?.name ?? this.identifier} equipped ${targetItem.name} in ${slot}.`);
        return true;
    }

    /**
     * Unequips the item in the specified slot.
     *
     * @param slot Equipment slot.
     * @returns Whether an item was unequipped.
     */
    public unequip(slot: EquipmentSlot): boolean {
        const items = this.load();
        const equippedItem = items.find((item) => item.isEquipped && item.equipmentSlot === slot);

        if (!equippedItem) {
            return false;
        }

        equippedItem.isEquipped = false;
        equippedItem.equipmentSlot = null;
        InventoryEntity.inventoryDb.savePlayerInventory(this.identifier, items);
        this.playerRef?.updateMaxHealth();
        this.#logger.info(`${this.playerRef?.name ?? this.identifier} unequipped ${equippedItem.name} from ${slot}.`);
        return true;
    }

    /**
     * Clears the player's inventory.
     *
     * @returns Whether the inventory was successfully cleared.
     */
    public clear(): boolean {
        return InventoryEntity.inventoryDb.clearInventory(this.identifier);
    }

    /**
     * Saves the player's inventory.
     *
     * @param itemsToSave Optional inventory items to save.
     */
    public save(itemsToSave?: InventoryItemRecord[]): void {
        const items = itemsToSave ?? this.load();
        InventoryEntity.inventoryDb.savePlayerInventory(this.identifier, items);
        InventoryEntity.inventoryDb.save();
    }

    /**
     * Returns the equipped item in a slot.
     *
     * @param slot Equipment slot.
     * @returns The equipped item or undefined.
     */
    public getEquippedInSlot(slot: EquipmentSlot): InventoryItemRecord | undefined {
        return this.load().find((item) => item.isEquipped && item.equipmentSlot === slot);
    }

    /**
     * Uses an inventory item.
     *
     * @param itemInput Item identifier or item reference.
     * @param quantity Amount to use.
     * @returns Whether the item was used.
     */
    public use(itemInput: string | Pick<Item, "itemId">, quantity = 1): boolean {
        if (quantity <= 0) {
            return false;
        }

        const itemId = typeof itemInput === "string" ? itemInput : itemInput.itemId;
        this.#logger.debug(`${this.playerRef?.name ?? this.identifier} attempted to use ${quantity}x ${itemId}.`);
        return false;
    }

    /**
     * Sells an inventory item.
     *
     * @param itemId Item identifier.
     * @param quantity Amount to sell.
     * @returns The amount of gold received.
     */
    public sellItem(itemId: string, quantity = 1): number {
        if (quantity <= 0) {
            return 0;
        }

        const items = this.load();
        const item = items.find((inventoryItem) => inventoryItem.itemId === itemId && !inventoryItem.isEquipped);

        if (!item || item.quantity < quantity) {
            return 0;
        }

        const rarityMultiplier = InventoryEntity.RARITY_SELL_MULTIPLIERS[item.rarity] ?? 1;
        const categoryMultiplier = InventoryEntity.CATEGORY_SELL_MULTIPLIERS[item.category] ?? 1;
        
        const durability = item.data?.durability ?? 100;
        const durabilityRatio = Math.max(0, Math.min(1, durability / 100));
        
        const calculatedGold = Math.max(1, Math.floor(10 * categoryMultiplier * rarityMultiplier * durabilityRatio * (quantity / 9)));

        if (!this.remove(itemId, quantity)) {
            return 0;
        }

        if (this.playerRef) {
            this.playerRef.gold += calculatedGold;
            this.#logger.info(`${this.playerRef.name} sold ${quantity}x ${item.name} for ${calculatedGold} gold.`);
        }

        return calculatedGold;
    }
}
