import { CountRecord, MarriageRecord, PlayerData, PlayerRecord, StatsRecord, TableColumnRecord } from "./player.interface.js";
import { consola } from "consola";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import PlayerManager from "./player.manager.js";

export default class PlayerDatabase {
    private readonly databaseInstance: Database.Database;

    /**
     * Creates a player database and initializes its schema.
     *
     * @returns void
     */
    public constructor(players: PlayerManager) {
        try {
            fs.mkdirSync(path.dirname(players.world.initializationOptions.database?.path || "data.db"), { recursive: true });
            
            this.databaseInstance = new Database(players.world.initializationOptions.database?.path || "data.db");
            this.databaseInstance.pragma("foreign_keys = ON");
            this.createTables();
            this.migrateStats();
            this.migratePlayer();
            consola.success("Player database initialized.");
        } catch (error) {
            consola.error("Failed to initialize player database:", error);
            throw error;
        }
    }

    /**
     * Saves player data to the database.
     *
     * @param playerData The player data to save.
     * @returns void
     */
    public save(playerData: PlayerData): void {
        try {
            const saveTransaction = this.databaseInstance.transaction(() => {
                this.savePlayer(playerData);
                this.saveStats(playerData);
            });

            saveTransaction();
        } catch (error) {
            consola.error(`Failed to save data for player ${playerData.id}:`, error);
            throw error;
        }
    }

    /**
     * Retrieves player data by identifier.
     *
     * @param playerId The player identifier.
     * @returns The player data if found, otherwise undefined.
     */
    public get(playerId: string): PlayerData | undefined {
        try {
            const playerRecord = this.findPlayer(playerId);

            if (!playerRecord) {
                return undefined;
            }

            const statsRecord = this.findStats(playerId);
            const partnerId = this.findPartnerId(playerId);

            return {
                id: playerRecord.id,
                name: playerRecord.name,
                classId: playerRecord.classId,
                locationId: playerRecord.locationId,
                gold: playerRecord.gold,
                bankGold: playerRecord.bankGold ?? 0,
                bankUnlocked: Boolean(playerRecord.bankUnlocked),
                level: statsRecord?.level ?? 1,
                experience: statsRecord?.experience ?? 0,
                health: statsRecord?.health ?? 100,
                maxHealth: statsRecord?.maxHealth ?? 100,
                partnerId,
                strength: statsRecord?.strength ?? 0,
                agility: statsRecord?.agility ?? 0,
                intelligence: statsRecord?.intelligence ?? 0,
                defense: statsRecord?.defense ?? 0,
                attributePoints: statsRecord?.attributePoints ?? 0
            };
        } catch (error) {
            consola.error(`Failed to retrieve data for player ${playerId}:`, error);
            return undefined;
        }
    }

    /**
     * Deletes a player and all related data.
     *
     * @param playerId The player identifier.
     * @returns True if the player was deleted, false otherwise.
     */
    public delete(playerId: string): boolean {
        try {
            const deleteTransaction = this.databaseInstance.transaction(() => {
                this.databaseInstance.prepare("DELETE FROM Stats WHERE Identifier = ?").run(playerId);
                this.databaseInstance.prepare("DELETE FROM Marriage WHERE Player1 = ? OR Player2 = ?").run(playerId, playerId);
                const deletionResult = this.databaseInstance.prepare("DELETE FROM Player WHERE Identifier = ?").run(playerId);
                return deletionResult.changes > 0;
            });

            const isDeleted = deleteTransaction();

            if (isDeleted) {
                consola.success(`Player ${playerId} deleted from database.`);
            } else {
                consola.warn(`Attempt to delete non-existent player ${playerId} from database.`);
            }

            return isDeleted;
        } catch (error) {
            consola.error(`Failed to delete player ${playerId} from database:`, error);
            throw error;
        }
    }

    /**
     * Returns the total number of registered players.
     *
     * @returns The number of registered players.
     */
    public count(): number {
        try {
            const countRecord = this.databaseInstance.prepare("SELECT COUNT(*) AS count FROM Player").get() as CountRecord;
            return countRecord.count;
        } catch (error) {
            consola.error("Failed to count registered players:", error);
            return 0;
        }
    }

    /**
     * Creates the required database tables.
     *
     * @returns void
     */
    private createTables(): void {
        this.databaseInstance.exec(`CREATE TABLE IF NOT EXISTS Player (
                Name TEXT NOT NULL,
                Identifier TEXT NOT NULL UNIQUE,
                Class TEXT NOT NULL DEFAULT 'unknown',
                Gold INTEGER NOT NULL DEFAULT 0,
                LocationId TEXT NOT NULL DEFAULT '',
                BankGold INTEGER NOT NULL DEFAULT 0,
                BankUnlocked INTEGER NOT NULL DEFAULT 0
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
     *
     * @returns void
     */
    private migrateStats(): void {
        const existingColumns = this.fetchTableColumns("Stats");

        const migrationQueries: Record<string, string> = {
            Strength: "ALTER TABLE Stats ADD COLUMN Strength INTEGER NOT NULL DEFAULT 0",
            Agility: "ALTER TABLE Stats ADD COLUMN Agility INTEGER NOT NULL DEFAULT 0",
            Intelligence: "ALTER TABLE Stats ADD COLUMN Intelligence INTEGER NOT NULL DEFAULT 0",
            Defense: "ALTER TABLE Stats ADD COLUMN Defense INTEGER NOT NULL DEFAULT 0",
            AttributePoints: "ALTER TABLE Stats ADD COLUMN AttributePoints INTEGER NOT NULL DEFAULT 0"
        };

        this.executeMigrations(existingColumns, migrationQueries);
    }

    /**
     * Applies missing player columns to existing databases.
     *
     * @returns void
     */
    private migratePlayer(): void {
        const existingColumns = this.fetchTableColumns("Player");

        const migrationQueries: Record<string, string> = {
            BankGold: "ALTER TABLE Player ADD COLUMN BankGold INTEGER NOT NULL DEFAULT 0",
            BankUnlocked: "ALTER TABLE Player ADD COLUMN BankUnlocked INTEGER NOT NULL DEFAULT 0"
        };

        this.executeMigrations(existingColumns, migrationQueries);
    }

    /**
     * Retrieves column names for a given table.
     *
     * @param tableName The name of the table.
     * @returns A set of existing column names.
     */
    private fetchTableColumns(tableName: string): Set<string> {
        const columnRecords = this.databaseInstance.prepare(`PRAGMA table_info(${tableName})`).all() as TableColumnRecord[];
        return new Set(columnRecords.map(columnRecord => columnRecord.name));
    }

    /**
     * Executes missing column migrations for a table.
     *
     * @param existingColumns The set of existing columns.
     * @param migrationQueries A record mapping column names to migration queries.
     */
    private executeMigrations(existingColumns: Set<string>, migrationQueries: Record<string, string>): void {
        for (const [columnName, query] of Object.entries(migrationQueries)) {
            if (!existingColumns.has(columnName)) {
                this.databaseInstance.exec(query);
            }
        }
    }

    /**
     * Saves player statistics.
     *
     * @param playerData The player data containing statistics.
     * @returns void
     */
    private saveStats(playerData: PlayerData): void {
        this.databaseInstance
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
                playerData.id,
                playerData.level,
                playerData.experience,
                playerData.health,
                playerData.maxHealth,
                playerData.strength,
                playerData.agility,
                playerData.intelligence,
                playerData.defense,
                playerData.attributePoints
            );
    }

    /**
     * Saves basic player information.
     *
     * @param playerData The player data to save.
     * @returns void
     */
    private savePlayer(playerData: PlayerData): void {
        this.databaseInstance
            .prepare(`
                INSERT INTO Player (
                    Name,
                    Identifier,
                    Class,
                    LocationId,
                    Gold,
                    BankGold,
                    BankUnlocked
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(Identifier)
                DO UPDATE SET
                    Name = excluded.Name,
                    Class = excluded.Class,
                    LocationId = excluded.LocationId,
                    Gold = excluded.Gold,
                    BankGold = excluded.BankGold,
                    BankUnlocked = excluded.BankUnlocked
            `)
            .run(
                playerData.name,
                playerData.id,
                playerData.classId,
                playerData.locationId,
                playerData.gold,
                playerData.bankGold ?? 0,
                playerData.bankUnlocked ? 1 : 0
            );
    }

    /**
     * Finds a player by identifier.
     *
     * @param playerId The player identifier.
     * @returns The player database record if found, otherwise undefined.
     */
    private findPlayer(playerId: string): PlayerRecord | undefined {
        const rawRecord = this.databaseInstance
            .prepare(`
                SELECT
                    Name AS name,
                    Identifier AS id,
                    Class AS classId,
                    LocationId AS locationId,
                    Gold AS gold,
                    BankGold AS bankGold,
                    BankUnlocked AS bankUnlocked
                FROM Player
                WHERE Identifier = ?
            `)
            .get(playerId) as { name: string; id: string; classId: PlayerData["classId"]; locationId: string; gold: number; bankGold: number; bankUnlocked: number } | undefined;

        if (!rawRecord) {
            return undefined;
        }

        return {
            ...rawRecord,
            bankUnlocked: Boolean(rawRecord.bankUnlocked)
        };
    }

    /**
     * Finds player statistics by identifier.
     *
     * @param playerId The player identifier.
     * @returns The player statistics if found, otherwise undefined.
     */
    private findStats(playerId: string): StatsRecord | undefined {
        return this.databaseInstance
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
            .get(playerId) as StatsRecord | undefined;
    }

    /**
     * Finds the partner ID for a given player identifier from the marriage table.
     *
     * @param playerId The player identifier.
     * @returns The partner identifier string, or empty string if not married.
     */
    private findPartnerId(playerId: string): string {
        const marriageRecord = this.databaseInstance
            .prepare("SELECT Player1, Player2, DateStart FROM Marriage WHERE Player1 = ? OR Player2 = ?")
            .get(playerId, playerId) as MarriageRecord | undefined;

        if (!marriageRecord) {
            return "";
        }

        return marriageRecord.Player1 === playerId ? marriageRecord.Player2 : marriageRecord.Player1;
    }
}