import PlayerEntity from "./player.entity";
import Database from "better-sqlite3";

export default class PlayerMarriage {
    private partnerId: string;
    private player: PlayerEntity;
    private dbPath: string; // Ou une référence à ton instance de PlayerDatabase / db

    constructor(player: PlayerEntity, partner?: string, dbPath: string = "./data/player.db") {
        this.partnerId = partner && partner !== "/" ? partner : "";
        this.player = player;
        this.dbPath = dbPath;
    }

    public setPartner(partnerId: string): this {
        this.partnerId = partnerId;
        const db = new Database(this.dbPath);

        const now = new Date().toISOString();

        db.prepare(`DELETE FROM Marriage WHERE Player1 = ? OR Player2 = ?`).run(this.player.id, this.player.id);

        db.prepare(`INSERT INTO Marriage (Player1, Player2, DateStart) VALUES (?, ?, ?)`).run(
            this.player.id,
            partnerId,
            now
        );

        db.close();
        return this;
    }

    public divorce(): void {
        const db = new Database(this.dbPath);
        
        db.prepare(`DELETE FROM Marriage WHERE Player1 = ? OR Player2 = ?`).run(this.player.id, this.player.id);
        
        db.close();
        this.partnerId = "";
    }

    public getPartnerId(): string {
        return this.partnerId;
    }

    public isMarried(): boolean {
        return this.partnerId !== "" && this.partnerId !== "/";
    }
}