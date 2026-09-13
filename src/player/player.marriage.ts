import Database from "better-sqlite3";
import PlayerEntity from "./player.entity.js";

export default class PlayerMarriage {
    private partnerId: string;
    private readonly player: PlayerEntity;
    private readonly dbPath: string;

    /**
     * Creates a player marriage manager.
     *
     * @param player Player entity.
     * @param partner Partner player identifier.
     * @param dbPath Path to the SQLite database.
     */
    public constructor(player: PlayerEntity, partner?: string, dbPath: string = "./data/player.db") {
        this.player = player;
        this.partnerId = partner && partner !== "/" ? partner : "";
        this.dbPath = dbPath;
    }

    /**
     * Sets the player's marriage partner.
     *
     * @param partnerId Partner player identifier.
     * @returns The current marriage manager.
     */
    public setPartner(partnerId: string): this {
        const db = new Database(this.dbPath);

        try {
            const setMarriage = db.transaction(() => {
                db.prepare("DELETE FROM Marriage WHERE Player1 = ? OR Player2 = ?").run(this.player.id, this.player.id);
                db.prepare("INSERT INTO Marriage (Player1, Player2, DateStart) VALUES (?, ?, ?)").run(this.player.id, partnerId, new Date().toISOString());
            });

            setMarriage();
            this.partnerId = partnerId;
            return this;
        } finally {
            db.close();
        }
    }

    /**
     * Ends the player's current marriage.
     *
     * @returns Nothing.
     */
    public divorce(): void {
        const db = new Database(this.dbPath);

        try {
            db.prepare("DELETE FROM Marriage WHERE Player1 = ? OR Player2 = ?").run(this.player.id, this.player.id);
            this.partnerId = "";
        } finally {
            db.close();
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
     * @returns True when the player has a partner.
     */
    public isMarried(): boolean {
        return this.partnerId.length > 0;
    }
}
