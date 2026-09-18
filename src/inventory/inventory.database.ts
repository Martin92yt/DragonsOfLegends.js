import { EquipmentSlot, ItemCategory, ItemRarity, VALID_EQUIPMENT_SLOTS } from "./item.enum.js";
import { EquipmentRecord, InventoryItemRecord } from "./inventory.interface.js";
import { consola } from "consola";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { InventoryEntity } from "./inventory.class.js";

interface InventoryRow {
    playerId: string;
    itemId: string;
    quantity: number;
    nbt: string | null;
    name: string;
    category: string;
    rarity: string;
    maxStack: number;
    description: string | null;
    isEquipped: number;
    equipmentSlot: string | null;
}

interface EquipmentRow {
    equipmentSlot: EquipmentSlot;
    itemId: string;
}

type EquipmentKey = Exclude<keyof EquipmentRecord, "playerId">;

export default class InventoryDatabase {
    private readonly databaseInstance: Database.Database;
    private deleteInventoryStatement!: Database.Statement;
    private insertInventoryStatement!: Database.Statement;

    private static readonly VALID_CATEGORIES = new Set<string>(Object.values(ItemCategory));
    private static readonly VALID_RARITIES = new Set<string>(Object.values(ItemRarity));
    private static readonly VALID_SLOTS = new Set<string>(VALID_EQUIPMENT_SLOTS);

    /**
     * Creates and initializes the inventory database.
     *
     * @param inventory InventoryEntity
     * @returns void
     */
    public constructor(inventory: InventoryEntity) {
        try {
            fs.mkdirSync(path.dirname(inventory.playerEntityReference.worldInstance.initializationOptions.database?.path || "data.db"), { recursive: true });
            
            this.databaseInstance = new Database(inventory.playerEntityReference.worldInstance.initializationOptions.database?.path || "data.db");
            this.databaseInstance.pragma("foreign_keys = ON");
            this.createTables();
            this.prepareStatements();
            consola.success("Inventory database initialized.");
        } catch (initializationError) {
            consola.error("Failed to initialize inventory database:", initializationError);
            throw initializationError;
        }
    }

    /**
     * Retrieves all inventory items for a player.
     *
     * @param playerId The player identifier.
     * @returns An array of the player's inventory items.
     */
    public getPlayerInventory(playerId: string): InventoryItemRecord[] {
        const inventoryRows = this.databaseInstance.prepare(`
            SELECT playerId, itemId, quantity, nbt, name, category, rarity, maxStack, description, isEquipped, equipmentSlot
            FROM Inventory
            WHERE playerId = ?
        `).all(playerId) as InventoryRow[];

        return inventoryRows.map(databaseRow => this.mapRowToInventoryItem(databaseRow));
    }

    /**
     * Maps a raw database row to an inventory item record.
     */
    private mapRowToInventoryItem(databaseRow: InventoryRow): InventoryItemRecord {
        return {
            playerId: databaseRow.playerId,
            itemId: databaseRow.itemId,
            quantity: databaseRow.quantity,
            itemNbtData: this.parseNBT(databaseRow.nbt),
            name: databaseRow.name || "Unknown Item",
            category: this.parseCategory(databaseRow.category),
            rarity: this.parseRarity(databaseRow.rarity),
            maxStack: databaseRow.maxStack,
            description: databaseRow.description ?? undefined,
            isEquipped: databaseRow.isEquipped === 1,
            equipmentSlot: this.parseEquipmentSlot(databaseRow.equipmentSlot)
        };
    }

    /**
     * Saves all inventory items for a player.
     *
     * @param playerId The player identifier.
     * @param inventoryItems The inventory items to save.
     * @returns void
     */
    public savePlayerInventory(playerId: string, inventoryItems: InventoryItemRecord[]): void {
        try {
            const saveTransaction = this.databaseInstance.transaction(() => {
                this.deleteInventoryStatement.run(playerId);

                for (const itemRecord of inventoryItems) {
                    if (!itemRecord.itemId || itemRecord.quantity <= 0) {
                        consola.warn(`Skipping invalid inventory item for player ${playerId}: ${itemRecord.itemId}`);
                        continue;
                    }

                    this.insertInventoryStatement.run(
                        playerId,
                        itemRecord.itemId,
                        itemRecord.quantity,
                        itemRecord.itemNbtData ? JSON.stringify(itemRecord.itemNbtData) : null,
                        itemRecord.name || itemRecord.itemId ? itemRecord.itemId : "Unknown Item",
                        itemRecord.category || ItemCategory.Valuables,
                        itemRecord.rarity || ItemRarity.Common,
                        itemRecord.maxStack ?? 64,
                        itemRecord.description ?? null,
                        itemRecord.isEquipped ? 1 : 0,
                        itemRecord.equipmentSlot ?? null
                    );
                }
            });

            saveTransaction();
        } catch (saveError) {
            consola.error(`Failed to save inventory for player ${playerId}:`, saveError);
            throw saveError;
        }
    }

    /**
     * Clears all inventory items for a player.
     *
     * @param playerId The player identifier.
     * @returns True if any inventory item was deleted, false otherwise.
     */
    public clearInventory(playerId: string): boolean {
        const queryResult = this.deleteInventoryStatement.run(playerId);
        return queryResult.changes > 0;
    }

    /**
     * Retrieves the equipment currently equipped by a player.
     *
     * @param playerId The player identifier.
     * @returns The player's equipment record.
     */
    public getPlayerEquipment(playerId: string): EquipmentRecord {
        const equipmentRows = this.databaseInstance.prepare(`
            SELECT equipmentSlot, itemId
            FROM Inventory
            WHERE playerId = ?
            AND isEquipped = 1
            AND equipmentSlot IS NOT NULL
        `).all(playerId) as EquipmentRow[];

        const playerEquipmentRecord: EquipmentRecord = {
            playerId,
            helmetItemId: null,
            chestItemId: null,
            leggingsItemId: null,
            bootsItemId: null,
            swordItemId: null,
            shieldItemId: null,
            amuletOneItemId: null,
            amuletTwoItemId: null,
            amuletThreeItemId: null
        };

        for (const equipmentRow of equipmentRows) {
            if (InventoryDatabase.VALID_SLOTS.has(equipmentRow.equipmentSlot)) {
                playerEquipmentRecord[equipmentRow.equipmentSlot as EquipmentKey] = equipmentRow.itemId;
            }
        }

        return playerEquipmentRecord;
    }

    /**
     * Saves the current database state.
     *
     * @returns void
     */
    public save(): void {
        this.databaseInstance.pragma("optimize");
    }

    /**
     * Saves and closes the database connection.
     *
     * @returns void
     */
    public saveAndClose(): void {
        if (!this.databaseInstance.open) {
            return;
        }

        try {
            this.databaseInstance.close();
            consola.success("Inventory database closed.");
        } catch (closeError) {
            consola.error("Error while closing inventory database:", closeError);
        }
    }

    /**
     * Creates the inventory database tables.
     *
     * @returns void
     */
    private createTables(): void {
        this.databaseInstance.exec(`
            CREATE TABLE IF NOT EXISTS Inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playerId TEXT NOT NULL,
                itemId TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                nbt TEXT,
                name TEXT NOT NULL DEFAULT 'Unknown Item',
                category TEXT NOT NULL,
                rarity TEXT NOT NULL,
                maxStack INTEGER NOT NULL DEFAULT 64,
                description TEXT,
                isEquipped INTEGER NOT NULL DEFAULT 0,
                equipmentSlot TEXT
            );
        `);
    }

    /**
     * Prepares reusable database statements for performance optimization.
     */
    private prepareStatements(): void {
        this.deleteInventoryStatement = this.databaseInstance.prepare("DELETE FROM Inventory WHERE playerId = ?");
        this.insertInventoryStatement = this.databaseInstance.prepare(`
            INSERT INTO Inventory (
                playerId,
                itemId,
                quantity,
                nbt,
                name,
                category,
                rarity,
                maxStack,
                description,
                isEquipped,
                equipmentSlot
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
    }

    /**
     * Parses serialized item data.
     *
     * @param serializedNbtPayload The serialized NBT data string or null.
     * @returns The parsed NBT data object or null.
     */
    private parseNBT(serializedNbtPayload: string | null): InventoryItemRecord["itemNbtData"] {
        if (!serializedNbtPayload) {
            return null;
        }

        try {
            return JSON.parse(serializedNbtPayload);
        } catch {
            consola.warn("Failed to parse item NBT JSON payload.");
            return null;
        }
    }

    /**
     * Parses an item category.
     *
     * @param categoryValue The database category value.
     * @returns A valid item category.
     */
    private parseCategory(categoryValue: string): ItemCategory {
        if (InventoryDatabase.VALID_CATEGORIES.has(categoryValue)) {
            return categoryValue as ItemCategory;
        }

        consola.warn(`Unknown item category encountered: ${categoryValue}. Falling back to valuables.`);
        return ItemCategory.Valuables;
    }

    /**
     * Parses an item rarity.
     *
     * @param rarityValue The database rarity value.
     * @returns A valid item rarity.
     */
    private parseRarity(rarityValue: string): ItemRarity {
        if (InventoryDatabase.VALID_RARITIES.has(rarityValue)) {
            return rarityValue as ItemRarity;
        }

        consola.warn(`Unknown item rarity encountered: ${rarityValue}. Falling back to common.`);
        return ItemRarity.Common;
    }

    /**
     * Parses an equipment slot.
     *
     * @param slotValue The database equipment slot value or null.
     * @returns A valid equipment slot or null.
     */
    private parseEquipmentSlot(slotValue: string | null): EquipmentSlot | null {
        if (!slotValue) {
            return null;
        }

        if (InventoryDatabase.VALID_SLOTS.has(slotValue)) {
            return slotValue as EquipmentSlot;
        }

        consola.warn(`Unknown equipment slot encountered: ${slotValue}.`);
        return null;
    }
}