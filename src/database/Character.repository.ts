import Database from "better-sqlite3";
import { Logger } from "../utils/Logger.js";
import { Player } from "../../interfaces/Player.interface.js";

export default class Playerbase {
    private readonly logger = new Logger({ context: "Playerbase" });
    private readonly database: Database.Database;

    constructor() {
        this.database = new Database("./data/player.db");
        this.database.exec(`CREATE TABLE IF NOT EXISTS Player ( Name TEXT NOT NULL, Identifier TEXT NOT NULL UNIQUE );`);
        this.logger.info("Player database initialized successfully.");
    }

    public save(player: Player): void {
        const statement = this.database.prepare(`INSERT INTO Player (Name, Identifier) VALUES (?, ?) ON CONFLICT(Identifier) DO UPDATE SET Name = excluded.Name;`);
        statement.run(player.Name, player.Identifier);
        this.logger.debug(`Player ${player.Identifier} saved.`);
    }

    public get(identifier: string): Player | undefined {
        const statement = this.database.prepare(`SELECT Name, Identifier FROM Player WHERE Identifier = ?`);
        return statement.get(identifier) as Player | undefined;
    }

    public delete(identifier: string): void {
        const statement = this.database.prepare(`DELETE FROM Player WHERE Identifier = ?`);
        statement.run(identifier);
        this.logger.debug(`Player ${identifier} deleted.`);
    }
}