import { EquipmentSlot, ItemCategory, ItemRarity, VALID_EQUIPMENT_SLOTS } from "./item.enum.js";
import { EquipmentRecord, InventoryItemRecord } from "./inventory.interface.js";
import { Logger } from "../utils/logger.js";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

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
    readonly #logger = new Logger({ context: "InventoryDatabase" });
    private readonly database: Database.Database;

    /**
     * Creates and initializes the inventory database.
     */
    public constructor() {
        fs.mkdirSync(path.dirname("./data/inventory.db"), { recursive: true });
        
        this.database = new Database("./data/inventory.db");
        this.database.pragma("foreign_keys = ON");
        this.createTables();
        this.#logger.info("Inventory database initialized successfully.");
    }

    /**
     * Retrieves all inventory items for a player.
     *
     * @param playerId Player identifier.
     * @returns The player's inventory items.
     */
    public getPlayerInventory(playerId: string): InventoryItemRecord[] {
        const rows = this.database.prepare(`
            SELECT playerId, itemId, quantity, nbt, name, category, rarity, maxStack, description, isEquipped, equipmentSlot
            FROM Inventory
            WHERE playerId = ?
        `).all(playerId) as InventoryRow[];

        return rows.map((row): InventoryItemRecord => ({
            playerId: row.playerId,
            itemId: row.itemId,
            quantity: row.quantity,
            data: this.parseNBT(row.nbt),
            name: row.name || "Unknown Item",
            category: this.parseCategory(row.category),
            rarity: this.parseRarity(row.rarity),
            maxStack: row.maxStack,
            description: row.description ?? undefined,
            isEquipped: row.isEquipped === 1,
            equipmentSlot: this.parseEquipmentSlot(row.equipmentSlot)
        }));
    }

    /**
     * Saves all inventory items for a player.
     *
     * @param playerId Player identifier.
     * @param items Inventory items to save.
     */
    public savePlayerInventory(playerId: string, items: InventoryItemRecord[]): void {
        const transaction = this.database.transaction(() => {
            this.database.prepare("DELETE FROM Inventory WHERE playerId = ?").run(playerId);

            const statement = this.database.prepare(`
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

            for (const item of items) {
                if (!item.itemId || item.quantity <= 0) {
                    continue;
                }

                statement.run(
                    playerId,
                    item.itemId,
                    item.quantity,
                    item.data ? JSON.stringify(item.data) : null,
                    item.name || item.itemId ? item.itemId : "Unknown Item",
                    item.category || ItemCategory.Valuables,
                    item.rarity || ItemRarity.Common,
                    item.maxStack ?? 64,
                    item.description ?? null,
                    item.isEquipped ? 1 : 0,
                    item.equipmentSlot ?? null
                );
            }
        });

        transaction();
    }

    /**
     * Clears all inventory items for a player.
     *
     * @param playerId Player identifier.
     * @returns Whether any inventory item was deleted.
     */
    public clearInventory(playerId: string): boolean {
        const result = this.database.prepare("DELETE FROM Inventory WHERE playerId = ?").run(playerId);
        return result.changes > 0;
    }

    /**
     * Retrieves the equipment currently equipped by a player.
     *
     * @param playerId Player identifier.
     * @returns The player's equipment.
     */
    public getPlayerEquipment(playerId: string): EquipmentRecord {
        const rows = this.database.prepare(`
            SELECT equipmentSlot, itemId
            FROM Inventory
            WHERE playerId = ?
            AND isEquipped = 1
            AND equipmentSlot IS NOT NULL
        `).all(playerId) as EquipmentRow[];

        const equipment: EquipmentRecord = {
            playerId,
            helmet: null,
            chest: null,
            leggings: null,
            boots: null,
            sword: null,
            shield: null,
            amulet1: null,
            amulet2: null,
            amulet3: null
        };

        for (const row of rows) {
            equipment[row.equipmentSlot] = row.itemId;
        }

        return equipment;
    }

    /**
     * Saves the current database state.
     *
     * SQLite automatically persists committed transactions.
     */
    public save(): void {
        this.database.pragma("optimize");
    }

    /**
     * Saves and closes the database connection.
     */
    public saveAndClose(): void {
        if (!this.database.open) {
            return;
        }

        try {
            this.database.close();
            this.#logger.info("Inventory database successfully saved and closed.");
        } catch (error) {
            this.#logger.error("Error while closing inventory database:", error);
        }
    }

    /**
     * Creates the inventory database tables.
     */
    private createTables(): void {
        this.database.exec(`
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
     * Parses serialized item data.
     *
     * @param value Serialized NBT data.
     * @returns Parsed NBT data or null.
     */
    private parseNBT(value: string | null): InventoryItemRecord["data"] {
        if (!value) {
            return null;
        }

        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }

    /**
     * Parses an item category.
     *
     * @param value Database category value.
     * @returns A valid item category.
     */
    private parseCategory(value: string): ItemCategory {
        return Object.values(ItemCategory).includes(value as ItemCategory) ? value as ItemCategory : ItemCategory.Valuables;
    }

    /**
     * Parses an item rarity.
     *
     * @param value Database rarity value.
     * @returns A valid item rarity.
     */
    private parseRarity(value: string): ItemRarity {
        return Object.values(ItemRarity).includes(value as ItemRarity) ? value as ItemRarity : ItemRarity.Common;
    }

    /**
     * Parses an equipment slot.
     *
     * @param value Database equipment slot value.
     * @returns A valid equipment slot or null.
     */
    private parseEquipmentSlot(value: string | null): EquipmentSlot | null {
        return value && (VALID_EQUIPMENT_SLOTS as readonly string[]).includes(value) ? (value as EquipmentSlot) : null;
    }
}
