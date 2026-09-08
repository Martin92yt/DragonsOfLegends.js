import Database from "better-sqlite3";
import { Logger } from "../utils/Logger.js";
import { Player } from "../../interfaces/Player.interface.js";

export default class PlayerDatabase {
    private readonly logger = new Logger({ context: "PlayerDatabase" });
    private readonly database: Database.Database;

    constructor() {
        this.database = new Database("./data/player.db");
        this.database.exec(`CREATE TABLE IF NOT EXISTS Player ( Name TEXT NOT NULL, Identifier TEXT NOT NULL UNIQUE, Class TEXT NOT NULL DEFAULT 'unknown' );`);
        const columns = this.database.prepare(`PRAGMA table_info(Player)`).all() as { name: string }[];
        const hasClass = columns.some((column) => column.name === "Class");
        if (!hasClass) { this.database.exec(`ALTER TABLE Player ADD COLUMN Class TEXT NOT NULL DEFAULT 'unknown';`); }
        this.logger.info("Player database initialized successfully.");
    }

    public save(player: Player): void {
        const statement = this.database.prepare(`INSERT INTO Player ( Name, Identifier, Class ) VALUES (?, ?, ?) ON CONFLICT(Identifier) DO UPDATE SET Name = excluded.Name, Class = excluded.Class;`);
        statement.run(player.Name, player.Identifier, player.Class);
        this.logger.debug(`Player ${player.Identifier} saved.`);
    }

    public get(identifier: string): Player | undefined {
        const statement = this.database.prepare(`SELECT Name, Identifier, Class FROM Player WHERE Identifier = ?`);
        return statement.get(identifier) as Player | undefined;
    }

    public delete(identifier: string): void {
        const statement = this.database.prepare(`DELETE FROM Player WHERE Identifier = ?`);
        statement.run(identifier);
        this.logger.debug(`Player ${identifier} deleted.`);
    }
}
