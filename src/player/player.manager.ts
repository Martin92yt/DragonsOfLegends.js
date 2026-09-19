import { CreatePlayerOptions, PlayerCount, PlayerData } from "./player.interface.js";
import PlayerDatabase from "./player.database.js";
import Player from "./player.entity.js";
import { consola } from "consola";
import World from "../world.js";
import { PlayerAlreadyExistsError } from "../types/error.js";
import { InventoryEntity } from "../inventory/inventory.class.js";

export default class PlayerManager {
    private static readonly INACTIVITY_TIME_MS = 15 * 60 * 1000;
    public readonly world: World;
    private readonly activePlayersMap = new Map<string, Player>();
    private readonly unloadTimersMap = new Map<string, NodeJS.Timeout>();
    private readonly playerDatabase;

    constructor(worldInstance: World) {
        this.world = worldInstance;
        this.playerDatabase = new PlayerDatabase(this);
    }


    /**
     * Ensures that a player exists in memory.
     */
    public async ensure(playerIdOrCreationOptions: string | CreatePlayerOptions): Promise<Player | undefined> {
        if (typeof playerIdOrCreationOptions === "string") {
            return await this.get(playerIdOrCreationOptions);
        }

        const existingPlayer = await this.get(playerIdOrCreationOptions.id);
        if (existingPlayer) {
            return existingPlayer;
        }

        return await this.create(playerIdOrCreationOptions);
    }

    /**
     * Gets a player by identifier.
     */
    public async get(playerId: string): Promise<Player | undefined> {
        const activePlayer = this.activePlayersMap.get(playerId);

        if (activePlayer) {
            this.refreshUnloadTimer(playerId);
            return activePlayer;
        }

        const dbResult = this.playerDatabase.get(playerId);
        const playerData = dbResult instanceof Promise ? await dbResult : dbResult;
        
        if (!playerData) {
            return undefined;
        }

        return await this.loadPlayerIntoCache(playerData);
    }

    private async loadPlayerIntoCache(playerData: PlayerData): Promise<Player> {
        const playerInstance = new Player(
            this.world,
            playerData.id,
            playerData.name,
            playerData.classId,
            playerData.locationId,
            playerData.level,
            playerData.experience,
            playerData.health,
            playerData.maxHealth,
            playerData.partnerId,
            playerData.gold,        
            playerData.bankGold,    
            playerData.bankUnlocked,
            playerData.attributePoints,
            playerData.strength,
            playerData.agility,
            playerData.intelligence,
            playerData.defense
        );

        await playerInstance.inventory.load();
        this.activePlayersMap.set(playerData.id, playerInstance);
        this.refreshUnloadTimer(playerData.id);
        consola.debug(`Player ${playerData.id} loaded into cache.`);

        return playerInstance;
    }

    /**
     * Creates and persists a new player.
     */
    public async create(creationOptions: CreatePlayerOptions): Promise<Player> {
        const { id: playerId, name: playerName, playerClass } = creationOptions;

        if (await this.exist(playerId)) {
            consola.warn(`Attempt to create already existing player ${playerId}.`);
            throw new PlayerAlreadyExistsError(playerId);
        }

        const newPlayerInstance = new Player(
            this.world,
            playerId,
            playerName,
            playerClass,
            this.world.location.getStartingCityId(),
            1,
            0,
            100,
            100,
            "",
            this.world.initializationOptions.starterGold ?? 0
        );

        this.activePlayersMap.set(playerId, newPlayerInstance);
        await this.save(newPlayerInstance);
        this.refreshUnloadTimer(playerId);
        consola.success(`Player ${playerId} created.`);

        return newPlayerInstance;
    }

    public tickRegen(amount: number = 5): void {
        for (const [playerId, playerInstance] of this.activePlayersMap) {
            if (playerInstance.health.current < playerInstance.health.max) {
                const oldHealth = playerInstance.health.current;
                playerInstance.health.current = Math.min(
                    playerInstance.health.max,
                    playerInstance.health.current + amount
                );

                consola.debug(`Player ${playerId} regenerated health: ${oldHealth} -> ${playerInstance.health.current}/${playerInstance.health.max}`);
            }
        }
    }

    /**
     * Checks whether a player exists.
     */
    public async exist(playerId: string): Promise<boolean> {
        if (this.activePlayersMap.has(playerId)) {
            return true;
        }
        const dbResult = this.playerDatabase.get(playerId);
        const playerData = dbResult instanceof Promise ? await dbResult : dbResult;
        return playerData !== undefined;
    }

    public async delete(playerId: string): Promise<boolean> {
        this.clearUnloadTimer(playerId);
        this.activePlayersMap.delete(playerId); 
        const player = await this.get(playerId);
        if (!player) {
            consola.warn(`Failed to delete non-existent player ${playerId} from database.`);
            return false;
        }
        await new InventoryEntity(playerId, player).clear();

        const dbDeleteResult = this.playerDatabase.delete(playerId);
        const isDeleted = dbDeleteResult instanceof Promise ? await dbDeleteResult : dbDeleteResult;

        if (isDeleted) {
            consola.info(`Player ${playerId} deleted.`);
        } else {
            consola.warn(`Failed to delete non-existent player ${playerId} from database.`);
        }

        return isDeleted as boolean;
    }

    public count(): PlayerCount {
        // Gardé synchrone si getPlayerCount() est synchrone, ou à adapter si `count()` est aussi une Promise dans ta base.
        return {
            active: this.activePlayersMap.size,
            total: (this.playerDatabase.count() as number) ?? 0
        };
    }

    public async remove(playerId: string): Promise<void> {
        const playerInstance = this.activePlayersMap.get(playerId);

        if (!playerInstance) {
            consola.warn(`Attempt to remove non-cached player ${playerId}.`);
            this.clearUnloadTimer(playerId);
            return;
        }

        await this.save(playerInstance);
        this.clearUnloadTimer(playerId);
        this.activePlayersMap.delete(playerId);
    }

    private refreshUnloadTimer(playerId: string): void {
        this.clearUnloadTimer(playerId);

        const inactivityTimer = setTimeout(async () => {
            await this.remove(playerId);
        }, PlayerManager.INACTIVITY_TIME_MS);

        inactivityTimer.unref();
        this.unloadTimersMap.set(playerId, inactivityTimer);
    }

    private clearUnloadTimer(playerId: string): void {
        const inactivityTimer = this.unloadTimersMap.get(playerId);

        if (!inactivityTimer) {
            return;
        }

        clearTimeout(inactivityTimer);
        this.unloadTimersMap.delete(playerId);
    }

    public async save(playerInstance: Player): Promise<void> {
        const playerData: PlayerData = {
            id: playerInstance.id,
            name: playerInstance.name,
            classId: playerInstance.classId,
            locationId: playerInstance.location,
            level: playerInstance.level,
            experience: playerInstance.experience.current,
            health: playerInstance.health.current,
            maxHealth: playerInstance.health.max,
            partnerId: playerInstance.marriage?.getPartnerId() ?? "",
            strength: playerInstance.attributes.strength,
            agility: playerInstance.attributes.agility,
            intelligence: playerInstance.attributes.intelligence,
            defense: playerInstance.attributes.defense,
            attributePoints: playerInstance.attributes.points,
            gold: playerInstance.gold,
            bankGold: playerInstance.bankGold,
            bankUnlocked: playerInstance.bankUnlocked
        };

        const saveResult = this.playerDatabase.save(playerData);
        if (saveResult instanceof Promise) await saveResult;
    }

    public async has(playerId: string): Promise<boolean> {
        return await this.exist(playerId);
    }

    public get size(): number {
        return this.activePlayersMap.size;
    }

    public async saveAll(): Promise<void> {
        for (const [playerId, playerInstance] of this.activePlayersMap) {
            await this.save(playerInstance);
            await playerInstance.inventory.save();
            this.clearUnloadTimer(playerId);
        }

        consola.success("All players saved.");
    }
}