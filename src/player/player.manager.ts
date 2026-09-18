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
    private readonly playerDatabase = new PlayerDatabase(this);

    /**
     * Creates a player manager.
     *
     * @param worldInstance The world instance associated with the player manager.
     * @returns void
     */
    public constructor(worldInstance: World) {
        this.world = worldInstance;
    }

    /**
     * Ensures that a player exists in memory.
     *
     * @param playerIdOrCreationOptions The player identifier or player creation options.
     * @returns The existing player, the loaded player, or a newly created player, or undefined if not found/created.
     */
    public ensure(playerIdOrCreationOptions: string | CreatePlayerOptions): Player | undefined {
        if (typeof playerIdOrCreationOptions === "string") {
            return this.get(playerIdOrCreationOptions);
        }

        return this.get(playerIdOrCreationOptions.id) ?? this.create(playerIdOrCreationOptions);
    }

    /**
     * Gets a player by identifier.
     *
     * @param playerId The player identifier.
     * @returns The player if found, otherwise undefined.
     */
    public get(playerId: string): Player | undefined {
        const activePlayer = this.activePlayersMap.get(playerId);

        if (activePlayer) {
            this.refreshUnloadTimer(playerId);
            return activePlayer;
        }

        const playerData = this.playerDatabase.get(playerId);
        if (!playerData) {
            return undefined;
        }

        return this.loadPlayerIntoCache(playerData);
    }

    /**
     * Instantiates a player from database data, loads their inventory, and caches them.
     *
     * @param playerData The raw player data from the database.
     * @returns The newly loaded player instance.
     */
    private loadPlayerIntoCache(playerData: PlayerData): Player {
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
            playerData.strength,
            playerData.agility,
            playerData.intelligence,
            playerData.defense,
            playerData.attributePoints,
            playerData.gold
        );

        playerInstance.inventory.load();
        this.activePlayersMap.set(playerData.id, playerInstance);
        this.refreshUnloadTimer(playerData.id);
        consola.debug(`Player ${playerData.id} loaded into cache.`);

        return playerInstance;
    }

    /**
     * Creates and persists a new player.
     *
     * @param creationOptions The player creation options.
     * @returns The newly created player.
     * @throws PlayerAlreadyExistsError If the player already exists.
     */
    public create(creationOptions: CreatePlayerOptions): Player {
        const { id: playerId, name: playerName, playerClass } = creationOptions;

        if (this.exist(playerId)) {
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
            this.world.initializationOptions.starterGold || 0
        );

        this.activePlayersMap.set(playerId, newPlayerInstance);
        // TODO: Starter Items
        this.save(newPlayerInstance);
        this.refreshUnloadTimer(playerId);
        consola.success(`Player ${playerId} created.`);

        return newPlayerInstance;
    }

    /**
     * Checks whether a player exists.
     *
     * @param playerId The player identifier.
     * @returns True if the player exists, false otherwise.
     */
    public exist(playerId: string): boolean {
        return this.activePlayersMap.has(playerId) || this.playerDatabase.get(playerId) !== undefined;
    }

    /**
     * Deletes a player from memory, inventory, and database.
     *
     * @param playerId The player identifier.
     * @returns True if the player was deleted from the database, false otherwise.
     */
    public delete(playerId: string): boolean {
        this.clearUnloadTimer(playerId);
        this.activePlayersMap.delete(playerId); 
        let player = this.get(playerId);
        if (!player) {
            consola.warn(`Failed to delete non-existent player ${playerId} from database.`);
            return false;
        };
        new InventoryEntity(playerId, player).clear();

        const isDeleted = this.playerDatabase.delete(playerId);

        if (isDeleted) {
            consola.info(`Player ${playerId} deleted.`);
        } else {
            consola.warn(`Failed to delete non-existent player ${playerId} from database.`);
        }

        return isDeleted;
    }

    /**
     * Returns the current player count.
     *
     * @returns The active and total player counts.
     */
    public count(): PlayerCount {
        return {
            active: this.activePlayersMap.size,
            total: this.playerDatabase.count()
        };
    }

    /**
     * Removes a player from the active cache after saving it.
     *
     * @param playerId The player identifier.
     * @returns void
     */
    public remove(playerId: string): void {
        const playerInstance = this.activePlayersMap.get(playerId);

        if (!playerInstance) {
            consola.warn(`Attempt to remove non-cached player ${playerId}.`);
            this.clearUnloadTimer(playerId);
            return;
        }

        this.save(playerInstance);
        this.clearUnloadTimer(playerId);
        this.activePlayersMap.delete(playerId);
    }

    /**
     * Refreshes the inactivity timer for a player.
     *
     * @param playerId The player identifier.
     * @returns void
     */
    private refreshUnloadTimer(playerId: string): void {
        this.clearUnloadTimer(playerId);

        const inactivityTimer = setTimeout(() => this.remove(playerId), PlayerManager.INACTIVITY_TIME_MS);

        inactivityTimer.unref();
        this.unloadTimersMap.set(playerId, inactivityTimer);
    }

    /**
     * Clears a player's inactivity timer.
     *
     * @param playerId The player identifier.
     * @returns void
     */
    private clearUnloadTimer(playerId: string): void {
        const inactivityTimer = this.unloadTimersMap.get(playerId);

        if (!inactivityTimer) {
            return;
        }

        clearTimeout(inactivityTimer);
        this.unloadTimersMap.delete(playerId);
    }

    /**
     * Saves a player to the database.
     *
     * @param playerInstance The player to save.
     * @returns void
     */
    private save(playerInstance: Player): void {
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

        this.playerDatabase.save(playerData);
    }

    /**
     * Checks whether a player exists.
     *
     * @param playerId The player identifier.
     * @returns True if the player exists, false otherwise.
     */
    public has(playerId: string): boolean {
        return this.exist(playerId);
    }

    /**
     * Returns the number of active players.
     *
     * @returns The number of active players.
     */
    public get size(): number {
        return this.activePlayersMap.size;
    }

    /**
     * Saves all active players and their inventories.
     *
     * @returns void
     */
    public saveAll(): void {
        for (const [playerId, playerInstance] of this.activePlayersMap) {
            this.save(playerInstance);
            playerInstance.inventory.save();
            this.clearUnloadTimer(playerId);
        }

        consola.success("All players saved.");
    }
}