import Database from "better-sqlite3";
import { Logger } from "../utils/logger.js";
import { EquipmentRecord, InventoryItemRecord } from "./inventory.interface.js";
import { EquipmentSlot } from "./item.enum.js";

export default class InventoryDatabase {
    private readonly logger = new Logger({ context: "InventoryDatabase" });
    private readonly database: Database.Database;

    constructor() {
        this.database = new Database("./data/inventory.db");
        this.database.pragma("foreign_keys = ON");
        this.createTables();
        this.logger.info("Inventory database initialized successfully.");
    }

    public getPlayerInventory(playerId: string): InventoryItemRecord[] {
        const rows = this.database
            .prepare(
                `
                SELECT playerId, itemId, quantity, nbt, name, category, rarity, maxStack, description, isEquipped, equipmentSlot 
                FROM Inventory 
                WHERE playerId = ?
            `,
            )
            .all(playerId) as Array<any>;

        return rows.map((row) => ({
            playerId: row.playerId,
            itemId: row.itemId,
            quantity: row.quantity,
            data: row.nbt ? JSON.parse(row.nbt) : null,
            name: row.name ?? "Unknown Item",
            category: row.category ?? "misc",
            rarity: row.rarity ?? "common",
            maxStack: row.maxStack ?? 64,
            description: row.description ?? undefined,
            isEquipped: Boolean(row.isEquipped),
            equipmentSlot: row.equipmentSlot ?? null,
        }));
    }

    public savePlayerInventory(
        playerId: string,
        items: InventoryItemRecord[],
    ): void {
        const transaction = this.database.transaction(() => {
            this.database
                .prepare(`DELETE FROM Inventory WHERE playerId = ?`)
                .run(playerId);

            const insertStmt = this.database.prepare(`
                INSERT INTO Inventory (playerId, itemId, quantity, nbt, name, category, rarity, maxStack, description, isEquipped, equipmentSlot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const item of items) {
                const itemId = item.itemId || (item as any).id;
                if (!itemId) continue;

                // 1. Sécurisation de la catégorie (si c'est un tableau, on prend le premier élément ou "misc")
                let categoryValue = item.category ?? "misc";
                if (Array.isArray(categoryValue)) {
                    categoryValue = categoryValue[0] ?? "misc";
                }

                // 2. Récupération propre des données NBT (cherche dans item.nbt ou item.data)
                const nbtData = (item as any).nbt ?? item.data;

                insertStmt.run(
                    playerId,
                    itemId,
                    item.quantity ?? 1,
                    nbtData ? JSON.stringify(nbtData) : null,
                    item.name || "Unknown Item",
                    categoryValue,
                    item.rarity || "common",
                    item.maxStack ?? 64,
                    item.description ?? null,
                    item.isEquipped ? 1 : 0,
                    item.equipmentSlot ?? null,
                );
            }
        });

        transaction();
    }

    public clearInventory(playerId: string): boolean {
        const result = this.database
            .prepare(`DELETE FROM Inventory WHERE playerId = ?`)
            .run(playerId);
        return result.changes > 0;
    }

    public getPlayerEquipment(playerId: string): EquipmentRecord {
        const rows = this.database
            .prepare(
                `SELECT equipmentSlot, itemId FROM Inventory WHERE playerId = ? AND isEquipped = 1 AND equipmentSlot IS NOT NULL`,
            )
            .all(playerId) as Array<{ equipmentSlot: string; itemId: string }>;

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
            amulet3: null,
        };

        for (const row of rows) {
            if (row.equipmentSlot in equipment) {
                (equipment as any)[row.equipmentSlot] = row.itemId;
            }
        }

        return equipment;
    }

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

    public saveAndClose(): void {
        try {
            if (this.database && this.database.open) {
                this.database.close();
                this.logger.info("Inventory database successfully saved and closed.");
            }
        } catch (error) {
            this.logger.error(
                "Error while saving and closing inventory database:",
                error,
            );
        }
    }

    public save(): void {
        try {
            this.database.open;
        } catch (error) {
            this.logger.error("Error while saving inventory database:", error);
        }
    }
}