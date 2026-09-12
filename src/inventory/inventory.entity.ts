import InventoryDatabase from "./inventory.database.js";
import { ItemNBT, InventoryItemRecord, EquipmentRecord } from "./inventory.interface.js";
import { Logger } from "../utils/logger.js";
import { EquipmentSlot, ItemCategory, ItemRarity } from "./item.enum.js";
import PlayerEntity from "../player/player.entity.js";

export class InventoryEntity {
    private readonly logger = new Logger({ context: "InventoryEntity" });
    private static readonly inventoryDb = new InventoryDatabase();
    public identifier: string;
    private playerRef?: PlayerEntity;

    constructor(identifier: string, playerRef?: PlayerEntity) {
        this.identifier = identifier;
        this.playerRef = playerRef;
    }

    public setPlayer(player: PlayerEntity): void {
        this.playerRef = player;
    }

    public load(): InventoryItemRecord[] {
        return InventoryEntity.inventoryDb.getPlayerInventory(this.identifier);
    }

    public getItems(): InventoryItemRecord[] {
        return this.load();
    }

    public getEquipment(): EquipmentRecord {
        return InventoryEntity.inventoryDb.getPlayerEquipment(this.identifier);
    }

    public add(itemInput: any, quantity = 1, data: ItemNBT | null = null): void {
        const items = this.load();
        const itemId = typeof itemInput === "string" ? itemInput : itemInput.itemId;
        if (!itemId) return;

        const existing = items.find(i => 
            i.itemId === itemId && 
            !i.isEquipped && 
            JSON.stringify(i.data ?? null) === JSON.stringify(data || itemInput.data || null)
        );

        if (existing && !data && (!itemInput.data || Object.keys(itemInput.data).length === 0)) {
            existing.quantity += quantity;
            this.logger.debug(`.player_green received ${quantity}x ${existing.name}.`);
        } else {
            const itemName = itemInput.name ?? "Unknown Item";
            items.push({
                playerId: this.identifier,
                itemId,
                quantity,
                data: data || itemInput.data || null,
                name: itemName,
                category: itemInput.category ?? ItemCategory.Valuables,
                rarity: itemInput.rarity ?? ItemRarity.Common,
                maxStack: itemInput.maxStack ?? 64,
                description: itemInput.description,
                isEquipped: false,
                equipmentSlot: null,
            });
            this.logger.debug(`.player_green received ${quantity}x ${itemName}.`);
        }

        InventoryEntity.inventoryDb.savePlayerInventory(this.identifier, items);
    }

    public remove(itemInput: string | { itemId: string }, quantity = 1): boolean {
        const itemId = typeof itemInput === "string" ? itemInput : itemInput.itemId;
        const items = this.load();
        const item = items.find(i => i.itemId === itemId && !i.isEquipped);

        if (!item || item.quantity < quantity) return false;

        item.quantity -= quantity;
        const filteredItems = items.filter(i => i.quantity > 0);

        InventoryEntity.inventoryDb.savePlayerInventory(this.identifier, filteredItems);
        return true;
    }

    public equip(slot: EquipmentSlot, itemId: string): boolean {
        const items = this.load();
        const targetItem = items.find(i => i.itemId === itemId && !i.isEquipped);

        if (!targetItem) return false;

        const slotCategories: Record<EquipmentSlot, ItemCategory[]> = {
            helmet: [ItemCategory.Armor],
            chest: [ItemCategory.Armor],
            leggings: [ItemCategory.Armor],
            boots: [ItemCategory.Armor],
            sword: [ItemCategory.Tool, ItemCategory.Weapons],
            shield: [ItemCategory.Tool, ItemCategory.Armor],
            amulet1: [ItemCategory.Amulet, ItemCategory.Valuables],
            amulet2: [ItemCategory.Amulet, ItemCategory.Valuables],
            amulet3: [ItemCategory.Amulet, ItemCategory.Valuables],
        };

        const allowed = slotCategories[slot] || [];
        if (allowed.length > 0 && !allowed.includes(targetItem.category)) return false;

        const currentEquipped = items.find(i => i.isEquipped && i.equipmentSlot === slot);
        if (currentEquipped) {
            currentEquipped.isEquipped = false;
            currentEquipped.equipmentSlot = null;
        }

        if (targetItem.quantity > 1) {
            targetItem.quantity -= 1;
            items.push({
                ...targetItem,
                quantity: 1,
                isEquipped: true,
                equipmentSlot: slot,
            });
        } else {
            targetItem.isEquipped = true;
            targetItem.equipmentSlot = slot;
        }
this.logger.info(`.player_green equipped a ${targetItem.name} in ${slot}.`);
        InventoryEntity.inventoryDb.savePlayerInventory(this.identifier, items);

        if (this.playerRef && typeof this.playerRef.updateMaxHealth === "function") {
            this.playerRef.updateMaxHealth();
        }

        return true;
    }

    public unequip(slot: EquipmentSlot): boolean {
        const items = this.load();
        const equippedItem = items.find(i => i.isEquipped && i.equipmentSlot === slot);

        if (!equippedItem) return false;

        equippedItem.isEquipped = false;
        equippedItem.equipmentSlot = null;
        
this.logger.info(`.player_green unequipped their ${equippedItem.name} from ${slot}.`);
        InventoryEntity.inventoryDb.savePlayerInventory(this.identifier, items);

        if (this.playerRef && typeof this.playerRef.updateMaxHealth === "function") {
            this.playerRef.updateMaxHealth();
        }

        return true;
    }

    public clear(): boolean {
        return InventoryEntity.inventoryDb.clearInventory(this.identifier);
    }

    /**
     * Sauvegarde et ferme proprement la base de données globale de l'inventaire (ex: lors d'un CTRL + C).
     */
    public static save(): void {
        const logger = new Logger({ context: "InventoryEntity" });
        try {
            // Comme la db est static, on accède directement à l'instance partagée
            if (InventoryEntity.inventoryDb) {
                // Si ton instance better-sqlite3 possède une méthode close ou un accès direct
                // (Assure-toi d'avoir une méthode close() dans ton InventoryDatabase)
                InventoryEntity.inventoryDb.saveAndClose(); 
                logger.info("Inventory database successfully saved and closed.");
            }
        } catch (error) {
            logger.error("Error while saving and closing inventory database:", error);
        }
    }
    public getEquippedInSlot(slot: EquipmentSlot): InventoryItemRecord | undefined {
        const items = this.load();
        return items.find(i => i.isEquipped && i.equipmentSlot === slot);
    }

    public use(itemInput: string | { itemId: string }, quantity = 1): boolean {
        // TODO: Implémenter la logique d'utilisation d'objet
        this.logger.debug(`.player_green used ${quantity}x item.`);
        return false;
    }
}