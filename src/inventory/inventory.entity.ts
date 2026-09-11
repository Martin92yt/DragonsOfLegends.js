import InventoryDatabase from "./inventory.repository.js";
import { ItemNBT, InventoryItemRecord } from "./inventory.interface.js";

const globalInventoryDb = new InventoryDatabase();

export class InventoryEntity {
    public identifier: string;

    constructor(identifier: string) {
        this.identifier = identifier;
    }

    public getItems(): InventoryItemRecord[] {
        return globalInventoryDb.getPlayerInventory(this.identifier);
    }

    public add(itemId: string, quantity = 1, data: ItemNBT | null = null): void {
        const items = this.getItems();
        const existing = items.find(i => i.itemId === itemId);

        if (existing) {
            existing.quantity += quantity;
            if (data) existing.data = { ...(existing.data || {}), ...data };
        } else {
            items.push({
                playerId: this.identifier,
                itemId: itemId,
                quantity: quantity,
                data: data || null
            });
        }

        globalInventoryDb.savePlayerInventory(this.identifier, items);
    }

    public remove(itemId: string, quantity = 1): boolean {
        const items = this.getItems();
        const index = items.findIndex(i => i.itemId === itemId);

        if (index === -1) return false;

        const item = items[index];
        if (item.quantity < quantity) return false;

        item.quantity -= quantity;
        if (item.quantity <= 0) {
            items.splice(index, 1);
        }

        globalInventoryDb.savePlayerInventory(this.identifier, items);
        return true;
    }
}