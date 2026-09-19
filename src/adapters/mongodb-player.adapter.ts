import { consola } from "consola";
import { MongoClient, Collection, Db } from "mongodb";
import { PlayerData } from "../player/player.interface.js";
export interface PlayerDatabaseInterface {
    save(playerData: PlayerData): void | Promise<void>;
    get(playerId: string): PlayerData | undefined | Promise<PlayerData | undefined>;
    delete(playerId: string): boolean | Promise<boolean>;
    count(): number | Promise<number>;
}
import PlayerManager from "../player/player.manager.js";

export default class MongoPlayerAdapter implements PlayerDatabaseInterface {
    private client!: MongoClient;
    private db!: Db;
    private playersCollection!: Collection<PlayerData>;
    private isConnected: boolean = false;

    public constructor(players: PlayerManager) {
        const uri = players.world.initializationOptions.database?.uri || "mongodb://localhost:27017";
        const dbName = players.world.initializationOptions.database?.name || "dragons-of-legends";

        this.client = new MongoClient(uri);
        this.initConnection(dbName);
    }

    private async initConnection(dbName: string): Promise<void> {
        try {
            await this.client.connect();
            this.db = this.client.db(dbName);
            this.playersCollection = this.db.collection<PlayerData>("players");
            this.isConnected = true;
            consola.success("MongoDB player database initialized.");
        } catch (error) {
            consola.error("Failed to initialize MongoDB player database:", error);
            throw error;
        }
    }

    public async save(playerData: PlayerData): Promise<void> {
        try {
            await this.playersCollection.updateOne(
                { id: playerData.id },
                { $set: playerData },
                { upsert: true }
            );
        } catch (error) {
            consola.error(`Failed to save player ${playerData.id} to MongoDB:`, error);
            throw error;
        }
    }

    public async get(playerId: string): Promise<PlayerData | undefined> {
        try {
            const doc = await this.playersCollection.findOne({ id: playerId });
            if (!doc) {
                return undefined;
            }
            // Retire l'objectId _id de MongoDB pour ne garder que le PlayerData pur
            const { _id, ...playerData } = doc as any;
            return playerData as PlayerData;
        } catch (error) {
            consola.error(`Failed to retrieve player ${playerId} from MongoDB:`, error);
            return undefined;
        }
    }

    public async delete(playerId: string): Promise<boolean> {
        try {
            const result = await this.playersCollection.deleteOne({ id: playerId });
            return (result.deletedCount ?? 0) > 0;
        } catch (error) {
            consola.error(`Failed to delete player ${playerId} from MongoDB:`, error);
            return false;
        }
    }

    public async count(): Promise<number> {
        try {
            return await this.playersCollection.countDocuments();
        } catch (error) {
            consola.error("Failed to count players in MongoDB:", error);
            return 0;
        }
    }

    public async close(): Promise<void> {
        if (!this.isConnected) {
            return;
        }

        try {
            await this.client.close();
            this.isConnected = false;
            consola.success("MongoDB player database closed.");
        } catch (error) {
            consola.error("Error while closing MongoDB player database:", error);
        }
    }
}