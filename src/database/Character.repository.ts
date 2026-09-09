import Database from "better-sqlite3";
import { Player } from "../../interfaces/Player.interface.js";
import { Logger } from "../utils/Logger.js";

interface PlayerRecord {
    Name: string;
    Identifier: string;
    Class: Player["Class"];
}

interface StatsRecord {
    Level: number;
    Experience: number;
    Health: number;
    MaxHealth: number;
    Strength: number;
    Agility: number;
    Intelligence: number;
    Defense: number;
}

export default class PlayerDatabase {
    private readonly logger = new Logger({
        context: "PlayerDatabase",
    });

    private readonly database: Database.Database;

    constructor() {
        this.database = new Database("./data/player.db");

        this.database.pragma("foreign_keys = ON");
        this.createTables();
        this.migrateStats();

        this.logger.info("Player database initialized successfully.");
    }

    public save(player: Player): void {
        const transaction = this.database.transaction(() => {
            this.savePlayer(player);
            this.saveStats(player);
        });

        transaction();

        this.logger.debug(`Player ${player.Identifier} saved.`);
    }

    public get(identifier: string): Player | undefined {
        const player = this.findPlayer(identifier);

        if (!player) {
            return undefined;
        }

        const stats = this.findStats(identifier);

        return {
            ...player,
            Level: stats?.Level ?? 1,
            Experience: stats?.Experience ?? 0,
            Health: stats?.Health ?? 100,
            MaxHealth: stats?.MaxHealth ?? 100,
            Strength: stats?.Strength ?? 0,
            Agility: stats?.Agility ?? 0,
            Intelligence: stats?.Intelligence ?? 0,
            Defense: stats?.Defense ?? 0,
        };
    }

    public delete(identifier: string): void {
        this.database
            .prepare(`
                DELETE FROM Player
                WHERE Identifier = ?
            `)
            .run(identifier);

        this.logger.debug(`Player ${identifier} deleted.`);
    }

    private createTables(): void {
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS Player (
                Name TEXT NOT NULL,
                Identifier TEXT NOT NULL UNIQUE,
                Class TEXT NOT NULL DEFAULT 'unknown'
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

                FOREIGN KEY (Identifier)
                    REFERENCES Player(Identifier)
                    ON DELETE CASCADE
            );
        `);
    }

    private migrateStats(): void {
        const columns = this.database
            .prepare(`PRAGMA table_info(Stats)`)
            .all() as { name: string }[];

        const existingColumns = new Set(
            columns.map(({ name }) => name),
        );

        const migrations: Record<string, string> = {
            Strength:
                "ALTER TABLE Stats ADD COLUMN Strength INTEGER NOT NULL DEFAULT 0",
            Agility:
                "ALTER TABLE Stats ADD COLUMN Agility INTEGER NOT NULL DEFAULT 0",
            Intelligence:
                "ALTER TABLE Stats ADD COLUMN Intelligence INTEGER NOT NULL DEFAULT 0",
            Defense:
                "ALTER TABLE Stats ADD COLUMN Defense INTEGER NOT NULL DEFAULT 0",
        };

        for (const [column, query] of Object.entries(migrations)) {
            if (existingColumns.has(column)) {
                continue;
            }

            this.database.exec(query);
            this.logger.debug(`Added Stats.${column} column.`);
        }
    }

    private savePlayer(player: Player): void {
        this.database
            .prepare(`
                INSERT INTO Player (
                    Name,
                    Identifier,
                    Class
                )
                VALUES (?, ?, ?)
                ON CONFLICT(Identifier)
                DO UPDATE SET
                    Name = excluded.Name,
                    Class = excluded.Class;
            `)
            .run(
                player.Name,
                player.Identifier,
                player.Class,
            );
    }

    private saveStats(player: Player): void {
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
                    Defense
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(Identifier)
                DO UPDATE SET
                    Level = excluded.Level,
                    Experience = excluded.Experience,
                    Health = excluded.Health,
                    MaxHealth = excluded.MaxHealth,
                    Strength = excluded.Strength,
                    Agility = excluded.Agility,
                    Intelligence = excluded.Intelligence,
                    Defense = excluded.Defense;
            `)
            .run(
                player.Identifier,
                player.Level,
                player.Experience,
                player.Health,
                player.MaxHealth,
                player.Strength,
                player.Agility,
                player.Intelligence,
                player.Defense,
            );
    }

    private findPlayer(identifier: string): PlayerRecord | undefined {
        return this.database
            .prepare(`
                SELECT
                    Name,
                    Identifier,
                    Class
                FROM Player
                WHERE Identifier = ?
            `)
            .get(identifier) as PlayerRecord | undefined;
    }

    private findStats(identifier: string): StatsRecord | undefined {
        return this.database
            .prepare(`
                SELECT
                    Level,
                    Experience,
                    Health,
                    MaxHealth,
                    Strength,
                    Agility,
                    Intelligence,
                    Defense
                FROM Stats
                WHERE Identifier = ?
            `)
            .get(identifier) as StatsRecord | undefined;
    }
}
