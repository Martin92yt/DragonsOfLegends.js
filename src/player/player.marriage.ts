import Database from "better-sqlite3";
import PlayerEntity from "./player.entity.js";
import consola from "consola";

export default class PlayerMarriage {
    private partnerId: string;
    private readonly player: PlayerEntity;
    private readonly dbPath: string;

    /**
     * Creates a player marriage manager.
     * 
     * @param player The player entity associated with this marriage manager.
     * @param initialPartnerId The partner player identifier, if any.
     * @param databasePath The path to the SQLite database.
     * @returns void
     */
    public constructor(player: PlayerEntity, initialPartnerId?: string, databasePath = "./data/player.db") {
        this.player = player;
        this.partnerId = initialPartnerId && initialPartnerId !== "/" ? initialPartnerId : "";
        this.dbPath = databasePath;
    }

    /**
     * Executes a database operation with an automatically managed connection.
     * 
     * @param operation The database callback to execute using the active connection.
     * @returns The result of the database operation.
     */
    private withDatabase<T>(operation: (db: Database.Database) => T): T {
        const database = new Database(this.dbPath);
        try {
            return operation(database);
        } finally {
            database.close();
        }
    }

    /**
     * Deletes any existing marriage records for the current player from the database.
     * 
     * @param database The active database instance.
     * @returns void
     */
    private removeExistingMarriage(database: Database.Database): void {
        database.prepare("DELETE FROM Marriage WHERE Player1 = ? OR Player2 = ?").run(this.player.id, this.player.id);
    }

    /**
     * Sets the player's marriage partner.
     * 
     * @param newPartnerId The partner player identifier.
     * @returns The current marriage manager instance.
     */
    public setPartner(newPartnerId: string): this {
        try {
            this.withDatabase(db => {
                const setMarriageTransaction = db.transaction(() => {
                    this.removeExistingMarriage(db);
                    db.prepare("INSERT INTO Marriage (Player1, Player2, DateStart) VALUES (?, ?, ?)").run(
                        this.player.id,
                        newPartnerId,
                        new Date().toISOString()
                    );
                });
                setMarriageTransaction();
            });

            this.partnerId = newPartnerId;
            consola.success(`Player ${this.player.id} married ${newPartnerId}.`);
            return this;
        } catch (error) {
            consola.error(`Failed to set marriage for player ${this.player.id}:`, error);
            throw error;
        }
    }

    /**
     * Ends the player's current marriage.
     * 
     * @returns void
     */
    public divorce(): void {
        try {
            this.withDatabase(db => {
                this.removeExistingMarriage(db);
            });

            this.partnerId = "";
            consola.info(`Player ${this.player.id} divorced.`);
        } catch (error) {
            consola.error(`Failed to process divorce for player ${this.player.id}:`, error);
            throw error;
        }
    }

    /**
     * Returns the current partner identifier.
     * 
     * @returns The partner identifier or an empty string when unmarried.
     */
    public getPartnerId(): string {
        return this.partnerId;
    }

    /**
     * Checks whether the player is currently married.
     * 
     * @returns True when the player has a partner, false otherwise.
     */
    public isMarried(): boolean {
        return this.partnerId.length > 0;
    }
}