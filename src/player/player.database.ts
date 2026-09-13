import { PlayerData } from "./player.interface.js";
import { Logger } from "../utils/logger.js";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

interface PlayerRecord {
    id: string;
    name: string;
    classId: PlayerData["classId"];
    locationId: string;
    gold: number;
}

interface StatsRecord {
    level: number;
    experience: number;
    health: number;
    maxHealth: number;
    strength: number;
    agility: number;
    intelligence: number;
    defense: number;
    attributePoints: number;
}

interface MarriageRecord {
    Player1: string;
    Player2: string;
    DateStart: string;
}

interface CountRecord {
    count: number;
}

interface TableColumnRecord {
    name: string;
}

export default class PlayerDatabase {
    readonly #logger = new Logger({ context: "PlayerDatabase" });
    private readonly database: Database.Database;

    /**
     * Creates a player database and initializes its schema.
     */
    public constructor() {
        fs.mkdirSync(path.dirname("./data/player.db"), { recursive: true });
        
        this.database = new Database("./data/player.db");
        this.database.pragma("foreign_keys = ON");
        this.createTables();
        this.migrateStats();
        this.#logger.info(`Player database initialized successfully. (${this.count()} players registered).`);
    }

    /**
     * Saves player data to the database.
     *
     * @param player Player data to save.
     */
    public save(player: PlayerData): void {
        const transaction = this.database.transaction(() => {
            this.savePlayer(player);
            this.saveStats(player);
        });

        transaction();
        this.#logger.debug(`Saved player data for ${player.id} (${player.name}).`);
    }

    /**
     * Retrieves player data by identifier.
     *
     * @param identifier Player identifier.
     * @returns Player data if found, otherwise undefined.
     */
    public get(identifier: string): PlayerData | undefined {
        const player = this.findPlayer(identifier);

        if (!player) {
            return undefined;
        }

        const stats = this.findStats(identifier);
        const marriage = this.database
            .prepare("SELECT Player1, Player2, DateStart FROM Marriage WHERE Player1 = ? OR Player2 = ?")
            .get(identifier, identifier) as MarriageRecord | undefined;

        const partnerId = marriage
            ? marriage.Player1 === identifier
                ? marriage.Player2
                : marriage.Player1
            : "";

        return {
            id: player.id,
            name: player.name,
            classId: player.classId,
            locationId: player.locationId,
            gold: player.gold,
            level: stats?.level ?? 1,
            experience: stats?.experience ?? 0,
            health: stats?.health ?? 100,
            maxHealth: stats?.maxHealth ?? 100,
            partener: partnerId,
            strength: stats?.strength ?? 0,
            agility: stats?.agility ?? 0,
            intelligence: stats?.intelligence ?? 0,
            defense: stats?.defense ?? 0,
            attributePoints: stats?.attributePoints ?? 0
        };
    }

    /**
     * Deletes a player and all related data.
     *
     * @param identifier Player identifier.
     * @returns True if the player was deleted.
     */
    public delete(identifier: string): boolean {
        const transaction = this.database.transaction(() => {
            this.database.prepare("DELETE FROM Stats WHERE Identifier = ?").run(identifier);
            this.database.prepare("DELETE FROM Marriage WHERE Player1 = ? OR Player2 = ?").run(identifier, identifier);
            const result = this.database.prepare("DELETE FROM Player WHERE Identifier = ?").run(identifier);
            return result.changes > 0;
        });

        const deleted = transaction();

        if (deleted) {
            this.#logger.info(`Player ${identifier} successfully deleted from database.`);
        } else {
            this.#logger.warn(`Player ${identifier} was not found in the database.`);
        }

        return deleted;
    }

    /**
     * Returns the total number of registered players.
     *
     * @returns Number of registered players.
     */
    public count(): number {
        const result = this.database.prepare("SELECT COUNT(*) AS count FROM Player").get() as CountRecord;
        return result.count;
    }

    /**
     * Creates the required database tables.
     */
    private createTables(): void {
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS Player (
                Name TEXT NOT NULL,
                Identifier TEXT NOT NULL UNIQUE,
                Class TEXT NOT NULL DEFAULT 'unknown',
                Gold INTEGER NOT NULL DEFAULT 0,
                LocationId TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS Stats (
                Identifier TEXT NOT NULL UNIQUE,
                Level INTEGER NOT NULL DEFAULT 1,
                Experience INTEGER NOT NULL DEFAULT 0,
                Health INTEGER NOT NULL DEFAULT 100,
                MaxHealth INTEGER NOT NULL DEFAULT 100,
                Strength INTEGER NOT NULL DEFAULT 0,
                Agility INTEGER NOT NULL DEFAULT 0,
                Intelligence INTEGER NOT NULL DEFAULT 0,
                Defense INTEGER NOT NULL DEFAULT 0,
                AttributePoints INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (Identifier) REFERENCES Player(Identifier) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS Marriage (
                Player1 TEXT NOT NULL,
                Player2 TEXT NOT NULL,
                DateStart TEXT NOT NULL,
                FOREIGN KEY (Player1) REFERENCES Player(Identifier) ON DELETE CASCADE,
                FOREIGN KEY (Player2) REFERENCES Player(Identifier) ON DELETE CASCADE
            );
        `);
    }

    /**
     * Applies missing statistics columns to existing databases.
     */
    private migrateStats(): void {
        const columns = this.database.prepare("PRAGMA table_info(Stats)").all() as TableColumnRecord[];
        const existingColumns = new Set(columns.map(({ name }) => name));

        const migrations: Record<string, string> = {
            Strength: "ALTER TABLE Stats ADD COLUMN Strength INTEGER NOT NULL DEFAULT 0",
            Agility: "ALTER TABLE Stats ADD COLUMN Agility INTEGER NOT NULL DEFAULT 0",
            Intelligence: "ALTER TABLE Stats ADD COLUMN Intelligence INTEGER NOT NULL DEFAULT 0",
            Defense: "ALTER TABLE Stats ADD COLUMN Defense INTEGER NOT NULL DEFAULT 0",
            AttributePoints: "ALTER TABLE Stats ADD COLUMN AttributePoints INTEGER NOT NULL DEFAULT 0"
        };

        for (const [column, query] of Object.entries(migrations)) {
            if (existingColumns.has(column)) {
                continue;
            }

            this.database.exec(query);
            this.#logger.info(`Migration applied: Added Stats.${column} column.`);
        }
    }

    /**
     * Saves player statistics.
     *
     * @param player Player data containing statistics.
     */
    private saveStats(player: PlayerData): void {
        this.database
            .prepare(`
                INSERT INTO Stats (
                    Identifier,
                    Level,
                    Experience,
                    Health,
                    MaxHealth,
                    Strength,
                    Agility,
                    Intelligence,
                    Defense,
                    AttributePoints
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(Identifier)
                DO UPDATE SET
                    Level = excluded.Level,
                    Experience = excluded.Experience,
                    Health = excluded.Health,
                    MaxHealth = excluded.MaxHealth,
                    Strength = excluded.Strength,
                    Agility = excluded.Agility,
                    Intelligence = excluded.Intelligence,
                    Defense = excluded.Defense,
                    AttributePoints = excluded.AttributePoints
            `)
            .run(
                player.id,
                player.level,
                player.experience,
                player.health,
                player.maxHealth,
                player.strength,
                player.agility,
                player.intelligence,
                player.defense,
                player.attributePoints
            );
    }

    /**
     * Saves basic player information.
     *
     * @param player Player data to save.
     */
    private savePlayer(player: PlayerData): void {
        this.database
            .prepare(`
                INSERT INTO Player (
                    Name,
                    Identifier,
                    Class,
                    LocationId,
                    Gold
                )
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(Identifier)
                DO UPDATE SET
                    Name = excluded.Name,
                    Class = excluded.Class,
                    LocationId = excluded.LocationId,
                    Gold = excluded.Gold
            `)
            .run(
                player.name,
                player.id,
                player.classId,
                player.locationId,
                player.gold
            );
    }

    /**
     * Finds a player by identifier.
     *
     * @param identifier Player identifier.
     * @returns Player database record if found.
     */
    private findPlayer(identifier: string): PlayerRecord | undefined {
        return this.database
            .prepare(`
                SELECT
                    Name AS name,
                    Identifier AS id,
                    Class AS classId,
                    LocationId AS locationId,
                    Gold AS gold
                FROM Player
                WHERE Identifier = ?
            `)
            .get(identifier) as PlayerRecord | undefined;
    }

    /**
     * Finds player statistics by identifier.
     *
     * @param identifier Player identifier.
     * @returns Player statistics if found.
     */
    private findStats(identifier: string): StatsRecord | undefined {
        return this.database
            .prepare(`
                SELECT
                    Level AS level,
                    Experience AS experience,
                    Health AS health,
                    MaxHealth AS maxHealth,
                    Strength AS strength,
                    Agility AS agility,
                    Intelligence AS intelligence,
                    Defense AS defense,
                    AttributePoints AS attributePoints
                FROM Stats
                WHERE Identifier = ?
            `)
            .get(identifier) as StatsRecord | undefined;
    }
}
