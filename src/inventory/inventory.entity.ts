import InventoryDatabase from "./inventory.database.js";
import { ItemNBT, InventoryItemRecord } from "./inventory.interface.js";
import { Logger } from "../utils/logger.js";

export class InventoryEntity {
    private readonly logger = new Logger({ context: "InventoryEntity" });
    private static readonly inventoryDb = new InventoryDatabase();
    public identifier: string;

    constructor(identifier: string) {
        this.identifier = identifier;
    }

    /**
     * Charge et retourne l'inventaire actuel depuis la base de données.
     */
    public load(items?: InventoryItemRecord[]): InventoryItemRecord[] {
        if (items) {
            this.logger.debug(`Loading inventory for player ${this.identifier} with provided items.`);
        }
        return InventoryEntity.inventoryDb.getPlayerInventory(this.identifier);
    }

    public getItems(): InventoryItemRecord[] {
        return this.load();
    }

    public add(itemId: string, quantity = 1, data: ItemNBT | null = null): void {
        const items = this.getItems();
        const existing = items.find(i => i.itemId === itemId);

        if (existing) {
            existing.quantity += quantity;
            if (data) existing.data = { ...(existing.data || {}), ...data };
            this.logger.debug(`Updated stack for item ${itemId} (+${quantity}) in inventory of player ${this.identifier}.`);
        } else {
            items.push({
                playerId: this.identifier,
                itemId: itemId,
                quantity: quantity,
                data: data || null
            });
            this.logger.debug(`Added new item ${itemId} (x${quantity}) to inventory of player ${this.identifier}.`);
        }

        InventoryEntity.inventoryDb.savePlayerInventory(this.identifier, items);
    }

    public remove(itemId: string, quantity = 1): boolean {
        const items = this.getItems();
        const index = items.findIndex(i => i.itemId === itemId);

        if (index === -1) {
            this.logger.debug(`Failed to remove item ${itemId}: not found in inventory of player ${this.identifier}.`);
            return false;
        }

        const item = items[index];
        if (item.quantity < quantity) {
            this.logger.debug(`Failed to remove item ${itemId}: requested quantity (${quantity}) exceeds current stack (${item.quantity}).`);
            return false;
        }

        item.quantity -= quantity;
        if (item.quantity <= 0) {
            items.splice(index, 1);
            this.logger.debug(`Item ${itemId} completely depleted and removed from inventory of player ${this.identifier}.`);
        } else {
            this.logger.debug(`Removed ${quantity} of item ${itemId} from inventory of player ${this.identifier}.`);
        }

        InventoryEntity.inventoryDb.savePlayerInventory(this.identifier, items);
        return true;
    }
}