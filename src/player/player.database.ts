import Database from "better-sqlite3";
import { PlayerData } from "./player.interface.js";
import { Logger } from "../utils/logger.js";

interface PlayerRecord { id: string; name: string; classId: PlayerData["classId"]; locationId: string; }
interface StatsRecord { level: number; experience: number; health: number; maxHealth: number; strength: number; agility: number; intelligence: number; defense: number; attributePoints: number; }

export default class PlayerDatabase {
    private readonly logger = new Logger({ context: "PlayerDatabase" });
    private readonly database: Database.Database;

    constructor() {
        this.database = new Database("./data/player.db");
        this.database.pragma("foreign_keys = ON");
        this.createTables();
        this.migrateStats();
        
        const totalPlayers = this.count();
        this.logger.info(`Player database initialized successfully. (${totalPlayers} players registered)`);
    }

    public save(player: PlayerData): void {
        const transaction = this.database.transaction(() => {
            this.savePlayer(player);
            this.saveStats(player);
        });
        transaction();
        this.logger.debug(`Saved player data for ${player.id} (ID: ${player.name}).`);
    }

    public get(identifier: string): PlayerData | undefined {
        const player = this.findPlayer(identifier);
        if (!player) return undefined;

        const stats = this.findStats(identifier);
        return {
            id: player.id,
            name: player.name,
            classId: player.classId,
            locationId: player.locationId,
            level: stats?.level ?? 1,
            experience: stats?.experience ?? 0,
            health: stats?.health ?? 100,
            maxHealth: stats?.maxHealth ?? 100,
            strength: stats?.strength ?? 0,
            agility: stats?.agility ?? 0,
            intelligence: stats?.intelligence ?? 0,
            defense: stats?.defense ?? 0,
            attributePoints: stats?.attributePoints ?? 0,
        };
    }

    public delete(identifier: string): boolean {
        const transaction = this.database.transaction(() => {
            this.database.prepare(`DELETE FROM Stats WHERE Identifier = ?`).run(identifier);
            const result = this.database.prepare(`DELETE FROM Player WHERE Identifier = ?`).run(identifier);
            return result.changes > 0;
        });

        const isDeleted = transaction();
        if (isDeleted) {
            this.logger.info(`Player ${identifier} successfully deleted from database.`);
        } else {
            this.logger.warn(`Attempted to delete player ${identifier}, but no record was found.`);
        }
        return isDeleted;
    }

    public count(): number {
        const result = this.database.prepare(`SELECT COUNT(*) as count FROM Player`).get() as { count: number };
        return result.count;
    }

    private createTables(): void {
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS Player (
                Name TEXT NOT NULL, 
                Identifier TEXT NOT NULL UNIQUE, 
                Class TEXT NOT NULL DEFAULT 'unknown', 
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
        `);
    }

    private migrateStats(): void {
        const columns = this.database.prepare("PRAGMA table_info(Stats)").all() as { name: string }[];
        const existingColumns = new Set(columns.map(({ name }) => name));

        const migrations: Record<string, string> = {
            Strength: "ALTER TABLE Stats ADD COLUMN Strength INTEGER NOT NULL DEFAULT 0",
            Agility: "ALTER TABLE Stats ADD COLUMN Agility INTEGER NOT NULL DEFAULT 0",
            Intelligence: "ALTER TABLE Stats ADD COLUMN Intelligence INTEGER NOT NULL DEFAULT 0",
            Defense: "ALTER TABLE Stats ADD COLUMN Defense INTEGER NOT NULL DEFAULT 0",
            AttributePoints: "ALTER TABLE Stats ADD COLUMN AttributePoints INTEGER NOT NULL DEFAULT 0",
        };

        for (const [column, query] of Object.entries(migrations)) {
            if (existingColumns.has(column)) continue;
            this.database.exec(query);
            this.logger.info(`Migration applied: Added Stats.${column} column.`);
        }
    }

    private savePlayer(player: PlayerData): void {
        this.database
            .prepare(`
                INSERT INTO Player (Name, Identifier, Class, LocationId)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(Identifier)
                DO UPDATE SET
                    Name = excluded.Name,
                    Class = excluded.Class,
                    LocationId = excluded.LocationId
            `)
            .run(player.name, player.id, player.classId, player.locationId);
    }

    private saveStats(player: PlayerData): void {
        this.database
            .prepare(`
                INSERT INTO Stats (Identifier, Level, Experience, Health, MaxHealth, Strength, Agility, Intelligence, Defense, AttributePoints)
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
                player.attributePoints,
            );
    }

    private findPlayer(identifier: string): PlayerRecord | undefined {
        return this.database
            .prepare(`SELECT Name as name, Identifier as id, Class as classId, LocationId as locationId FROM Player WHERE Identifier = ?`)
            .get(identifier) as PlayerRecord | undefined;
    }

    private findStats(identifier: string): StatsRecord | undefined {
        return this.database
            .prepare(`SELECT Level as level, Experience as experience, Health as health, MaxHealth as maxHealth, Strength as strength, Agility as agility, Intelligence as intelligence, Defense as defense, AttributePoints as attributePoints FROM Stats WHERE Identifier = ?`)
            .get(identifier) as StatsRecord | undefined;
    }
}