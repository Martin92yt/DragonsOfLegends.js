import { EquipmentRecord, InventoryItemRecord } from "./inventory.interface.js";
import { InventoryEntity } from "./inventory.class.js";
import SqliteInventoryAdapter from "../adapters/sqlite-inventory.adapter.js"; // Ajuste le chemin selon ton arborescence
import MongoInventoryAdapter from "../adapters/mongodb-inventory.adapter.js";   // Ajuste le chemin selon ton arborescence

export interface InventoryDatabaseInterface {
    getPlayerInventory(playerId: string): InventoryItemRecord[] | Promise<InventoryItemRecord[]>;
    savePlayerInventory(playerId: string, inventoryItems: InventoryItemRecord[]): void | Promise<void>;
    clearInventory(playerId: string): boolean | Promise<boolean>;
    getPlayerEquipment(playerId: string): EquipmentRecord | Promise<EquipmentRecord>;
    save(): void | Promise<void>;
    saveAndClose(): void | Promise<void>;
}

export default class InventoryDatabase implements InventoryDatabaseInterface {
    private readonly adapter: InventoryDatabaseInterface;

    public constructor(inventory: InventoryEntity) {
        const dbAdapterType: string = inventory.playerEntityReference.worldInstance.initializationOptions.database?.adapter || "file";

        if (dbAdapterType === "mongodb") {
            this.adapter = new MongoInventoryAdapter(inventory);
        } else {
            this.adapter = new SqliteInventoryAdapter(inventory);
        }
    }

    public getPlayerInventory(playerId: string): InventoryItemRecord[] | Promise<InventoryItemRecord[]> {
        return this.adapter.getPlayerInventory(playerId);
    }

    public savePlayerInventory(playerId: string, inventoryItems: InventoryItemRecord[]): void | Promise<void> {
        return this.adapter.savePlayerInventory(playerId, inventoryItems);
    }

    public clearInventory(playerId: string): boolean | Promise<boolean> {
        return this.adapter.clearInventory(playerId);
    }

    public getPlayerEquipment(playerId: string): EquipmentRecord | Promise<EquipmentRecord> {
        return this.adapter.getPlayerEquipment(playerId);
    }

    public save(): void | Promise<void> {
        return this.adapter.save();
    }

    public saveAndClose(): void | Promise<void> {
        return this.adapter.saveAndClose();
    }
}