import { CreatePlayerOptions, PlayerCount, PlayerData } from "./player.interface.js";
import PlayerDatabase from "./player.database.js";
import Player from "./player.entity.js";
import { Logger } from "../utils/logger.js";
import World from "../world.js";
import { PlayerAlreadyExistsError } from "../types/error.js";
import { InventoryEntity } from "../inventory/inventory.class.js";

export default class PlayerManager {
    private static readonly INACTIVITY_TIME = 15 * 60 * 1000;
    readonly #logger = new Logger({ context: "PlayerManager" });
    private readonly rpg: World;
    private readonly players = new Map<string, Player>();
    private readonly unloadTimers = new Map<string, NodeJS.Timeout>();
    private readonly database = new PlayerDatabase();

    /**
     * Creates a player manager.
     *
     * @param rpg World instance.
     */
    public constructor(rpg: World) {
        this.rpg = rpg;
    }

    /**
     * Ensures that a player exists in memory.
     *
     * @param idOrOptions Player identifier or player creation options.
     * @returns The existing player, the loaded player, or a newly created player.
     */
    public ensure(idOrOptions: string | CreatePlayerOptions): Player | undefined {
        if (typeof idOrOptions === "string") {
            return this.get(idOrOptions);
        }

        return this.get(idOrOptions.id) ?? this.create(idOrOptions);
    }

    /**
     * Gets a player by identifier.
     *
     * @param id Player identifier.
     * @returns The player if found, otherwise undefined.
     */
    public get(id: string): Player | undefined {
        const activePlayer = this.players.get(id);

        if (activePlayer) {
            this.refreshUnloadTimer(id);
            return activePlayer;
        }

        const data = this.database.get(id);

        if (!data) {
            return undefined;
        }

        const player = new Player(
            this.rpg,
            data.id,
            data.name,
            data.classId,
            data.locationId,
            data.level,
            data.experience,
            data.health,
            data.maxHealth,
            data.partener,
            data.strength,
            data.agility,
            data.intelligence,
            data.defense,
            data.attributePoints,
            data.gold
        );

        player.inventory.load();
        this.players.set(id, player);
        this.refreshUnloadTimer(id);
        this.#logger.debug(`Player ${id} loaded into cache.`);

        return player;
    }

    /**
     * Creates and persists a new player.
     *
     * @param options Player creation options.
     * @returns The newly created player.
     * @throws PlayerAlreadyExistsError If the player already exists.
     */
    public create(options: CreatePlayerOptions): Player {
        const { id, name, playerClass } = options;

        if (this.exist(id)) {
            throw new PlayerAlreadyExistsError(id);
        }

        const player = new Player(
            this.rpg,
            id,
            name,
            playerClass,
            this.rpg.location.getStartingCityId(),
            1,
            0,
            100,
            100,
            ""
        );

        this.players.set(id, player);
        this.save(player);
        this.refreshUnloadTimer(id);
        this.#logger.info(`New player registered: ${name} (${id}) as class ${playerClass}.`);

        return player;
    }

    /**
     * Checks whether a player exists.
     *
     * @param id Player identifier.
     * @returns True if the player exists.
     */
    public exist(id: string): boolean {
        return this.players.has(id) || this.database.get(id) !== undefined;
    }

    /**
     * Deletes a player from memory, inventory, and database.
     *
     * @param id Player identifier.
     * @returns True if the player was deleted from the database.
     */
    public delete(id: string): boolean {
        this.clearUnloadTimer(id);
        this.players.delete(id);
        new InventoryEntity(id).clear();

        const deleted = this.database.delete(id);

        if (deleted) {
            this.#logger.info(`Player ${id} permanently deleted.`);
        }

        return deleted;
    }

    /**
     * Returns the current player count.
     *
     * @returns Active and total player counts.
     */
    public count(): PlayerCount {
        return {
            active: this.players.size,
            total: this.database.count()
        };
    }

    /**
     * Removes a player from the active cache after saving it.
     *
     * @param id Player identifier.
     */
    public remove(id: string): void {
        const player = this.players.get(id);

        if (!player) {
            this.clearUnloadTimer(id);
            return;
        }

        this.save(player);
        this.clearUnloadTimer(id);
        this.players.delete(id);
    }

    /**
     * Refreshes the inactivity timer for a player.
     *
     * @param id Player identifier.
     */
    private refreshUnloadTimer(id: string): void {
        this.clearUnloadTimer(id);

        const timer = setTimeout(() => this.remove(id), PlayerManager.INACTIVITY_TIME);

        timer.unref();
        this.unloadTimers.set(id, timer);
    }

    /**
     * Clears a player's inactivity timer.
     *
     * @param id Player identifier.
     */
    private clearUnloadTimer(id: string): void {
        const timer = this.unloadTimers.get(id);

        if (!timer) {
            return;
        }

        clearTimeout(timer);
        this.unloadTimers.delete(id);
    }

    /**
     * Saves a player to the database.
     *
     * @param player Player to save.
     */
    private save(player: Player): void {
        const data: PlayerData = {
            id: player.id,
            name: player.name,
            classId: player.classId,
            locationId: player.location,
            level: player.level,
            experience: player.experience.current,
            health: player.health.current,
            maxHealth: player.health.max,
            partener: player.marriage?.getPartnerId() ?? "",
            strength: player.attributes.strength,
            agility: player.attributes.agility,
            intelligence: player.attributes.intelligence,
            defense: player.attributes.defense,
            attributePoints: player.attributes.points,
            gold: player.gold,
            bankGold: player.bankGold,
            bankUnlocked: player.bankUnlocked
        };

        this.database.save(data);
    }

    /**
     * Checks whether a player exists.
     *
     * @param id Player identifier.
     * @returns True if the player exists.
     */
    public has(id: string): boolean {
        return this.exist(id);
    }

    /**
     * Returns the number of active players.
     *
     * @returns Number of active players.
     */
    public get size(): number {
        return this.players.size;
    }

    /**
     * Saves all active players and their inventories.
     */
    public saveAll(): void {
        this.#logger.info(`Saving ${this.players.size} active player(s)...`);

        for (const [id, player] of this.players) {
            this.save(player);
            player.inventory.save();
            this.clearUnloadTimer(id);
        }

        this.#logger.info("All active players and their inventories have been saved successfully.");
    }
}
