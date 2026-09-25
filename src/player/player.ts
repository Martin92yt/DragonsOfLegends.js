import { PlayerData } from "./player.interface.js";
export interface PlayerDatabaseInterface {
    save(playerData: PlayerData): void | Promise<void>;
    get(playerId: string): PlayerData | undefined | Promise<PlayerData | undefined>;
    delete(playerId: string): boolean | Promise<boolean>;
    count(): number | Promise<number>;
}
import PlayerManager from "./player.manager.js";
import SqlitePlayerAdapter from "../adapters/sqlite-player.adapter.js";
import MongoPlayerAdapter from "../adapters/mongodb-player.adapter.js"; // Ajuste le chemin selon ton arborescence

export default class PlayerDatabase implements PlayerDatabaseInterface {
    private readonly adapter: PlayerDatabaseInterface;

    /**
     * Initializes the appropriate player database adapter based on world configuration.
     * 
     * @param players The player manager instance.
     */
    public constructor(players: PlayerManager) {
        const dbConfig = players.world.initializationOptions.database;
        const dbAdapterType: string = dbConfig?.adapter || "file";

        if (dbAdapterType === "mongodb") {
            this.adapter = new MongoPlayerAdapter(players);
        } else {
            this.adapter = new SqlitePlayerAdapter(players);
        }
    }

    /**
     * Saves player data.
     */
    public save(playerData: PlayerData): void | Promise<void> {
        return this.adapter.save(playerData);
    }

    /**
     * Retrieves player data by identifier.
     */
    public get(playerId: string): PlayerData | undefined | Promise<PlayerData | undefined> {
        return this.adapter.get(playerId);
    }

    /**
     * Deletes a player by identifier.
     */
    public delete(playerId: string): boolean | Promise<boolean> {
        return this.adapter.delete(playerId);
    }

    /**
     * Counts the total number of registered players.
     */
    public count(): number | Promise<number> {
        return this.adapter.count();
    }
}