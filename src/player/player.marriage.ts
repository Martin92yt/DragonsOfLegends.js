import Database from "better-sqlite3";
import PlayerEntity from "./player.entity.js";
import consola from "consola";
import { InvalidPartnerError } from "../types/error.js";

export default class PlayerMarriage {
    private partnerId: string;
    private readonly player: PlayerEntity;
    private readonly dbPathOverride: string | undefined;

    /**
     * Creates a player marriage manager.
     * 
     * @param player The player entity associated with this marriage manager.
     * @param initialPartnerId The partner player identifier, if any.
     * @param databasePath The path to the SQLite database.
     * @returns void
     */
    public constructor(player: PlayerEntity, initialPartnerId?: string, databasePath?: string) {
        this.player = player;
        this.partnerId = initialPartnerId && initialPartnerId !== "/" ? initialPartnerId : "";
        this.dbPathOverride = databasePath;
    }

    /**
     * Executes a database operation with an automatically managed connection.
     * 
     * @param operation The database callback to execute using the active connection.
     * @returns The result of the database operation.
     */
    private withDatabase<T>(operation: (db: Database.Database) => T): T {
        // Rationale: the marriages live in the world database, next to the players (not in a hard-coded ./data/player.db).
        const database = new Database(this.dbPathOverride ?? this.player.worldInstance.initializationOptions.database?.path ?? "data.db");
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
    private removeExistingMarriage(database: Database.Database, playerId: string = this.player.id): void {
        database.prepare("DELETE FROM Marriage WHERE Player1 = ? OR Player2 = ?").run(playerId, playerId);
    }

    /**
     * Updates the in-memory partner when the marriage was changed from the other side (no database write).
     *
     * @param partnerId The new partner identifier, or an empty string.
     * @returns void
     */
    public syncPartner(partnerId: string): void {
        this.partnerId = partnerId;
    }

    /**
     * Updates the cached marriage of a player that is currently loaded (nothing to do if it is not).
     */
    private syncCachedPlayer(playerId: string, partnerId: string): void {
        if (playerId === "") return;
        this.player.worldInstance.players.peek(playerId)?.marriage.syncPartner(partnerId);
    }

    /**
     * Sets the player's marriage partner.
     * 
     * @param newPartnerId The partner player identifier.
     * @returns The current marriage manager instance.
     */
    public setPartner(newPartnerId: string): this {
        this.player.assertCanAct("marriage.setPartner");
        if (newPartnerId === this.player.id) {
            throw new InvalidPartnerError(newPartnerId);
        }
        try {
            const previousPartnerId = this.partnerId;
            // The new partner may have been married too: their former partner is freed as well.
            const partnerFormerPartnerId = this.player.worldInstance.players.peek(newPartnerId)?.marriage.getPartnerId() ?? "";
            this.withDatabase(db => {
                const setMarriageTransaction = db.transaction(() => {
                    this.removeExistingMarriage(db);
                    this.removeExistingMarriage(db, newPartnerId);
                    db.prepare("INSERT INTO Marriage (Player1, Player2, DateStart) VALUES (?, ?, ?)").run(
                        this.player.id,
                        newPartnerId,
                        new Date().toISOString()
                    );
                });
                setMarriageTransaction();
            });

            this.partnerId = newPartnerId;
            for (const freedPlayerId of [previousPartnerId, partnerFormerPartnerId]) {
                if (freedPlayerId !== newPartnerId && freedPlayerId !== this.player.id) this.syncCachedPlayer(freedPlayerId, "");
            }
            this.syncCachedPlayer(newPartnerId, this.player.id);
            consola.success(`Player ${this.player.id} married ${newPartnerId}.`);
            // Fire-and-forget: setPartner is synchronous, so asynchronous listeners are not awaited.
            this.player.worldInstance.events.emit("marriageStart", { playerId: this.player.id, player: this.player, partnerId: newPartnerId });
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
        this.player.assertCanAct("marriage.divorce");
        try {
            this.withDatabase(db => {
                this.removeExistingMarriage(db);
            });

            const formerPartnerId = this.partnerId;
            this.partnerId = "";
            this.syncCachedPlayer(formerPartnerId, "");
            consola.info(`Player ${this.player.id} divorced.`);
            this.player.worldInstance.events.emit("marriageDivorce", { playerId: this.player.id, player: this.player, formerPartnerId });
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