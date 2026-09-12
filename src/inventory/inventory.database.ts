import Database from "better-sqlite3";
import { Logger } from "../utils/logger.js";
import { InventoryItemRecord } from "./inventory.interface.js";

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
            .prepare(`SELECT id, playerId, itemId, quantity, data FROM Inventory WHERE playerId = ?`)
            .all(playerId) as Array<{ id: number; playerId: string; itemId: string; quantity: number; data: string | null }>;

        return rows.map((row) => ({
            id: row.id,
            playerId: row.playerId,
            itemId: row.itemId,
            quantity: row.quantity,
            data: row.data ? JSON.parse(row.data) : null,
        }));
    }

    public savePlayerInventory(playerId: string, items: any[]): void {
        const transaction = this.database.transaction(() => {
            this.database.prepare(`DELETE FROM Inventory WHERE playerId = ?`).run(playerId);
            const insertStmt = this.database.prepare(`
                INSERT INTO Inventory (playerId, itemId, quantity, data)
                VALUES (?, ?, ?, ?)
            `);

            for (const item of items) {
                // On récupère l'identifiant de l'item peu importe comment il s'appelle dans l'objet
                const itemId = item.itemId || item.type;
                
                // Sécurité : si pour une raison quelconque l'itemId est toujours vide, on l'ignore ou on log
                if (!itemId) continue; 

                const quantity = item.quantity ?? 1;
                const serializedData = item.data ? JSON.stringify(item.data) : null;
                
                insertStmt.run(playerId, itemId, quantity, serializedData);
            }
        });

        transaction();
    }

    public clearInventory(playerId: string): boolean {
        const result = this.database.prepare(`DELETE FROM Inventory WHERE playerId = ?`).run(playerId);
        return result.changes > 0;
    }

    private createTables(): void {
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS Inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playerId TEXT NOT NULL,
                itemId TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                data TEXT
            );
        `);
    }
}