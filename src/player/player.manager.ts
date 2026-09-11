import { CreatePlayerOptions, PlayerCount, PlayerData } from "./player.interface.js";
import PlayerDatabase from "./player.repository.js";
import InventoryDatabase from "../inventory/inventory.repository.js";
import Player from "./player.entity.js";
import { Logger } from "../utils/logger.js";
import World from "../index.js";

export default class PlayerManager {
    private static readonly INACTIVITY_TIME = 15 * 60 * 1000;

    #logger = new Logger({ context: "PlayerManager" });
    #rpg: World;
    private readonly players = new Map<string, Player>();
    private readonly unloadTimers = new Map<string, NodeJS.Timeout>();
    private readonly database = new PlayerDatabase();
    private readonly inventoryDb = new InventoryDatabase();

    constructor(rpg: World) { 
        this.#rpg = rpg; 
    }

    public ensure(id: string): Player | undefined;
    public ensure(options: CreatePlayerOptions): Player;
    public ensure(idOrOptions: string | CreatePlayerOptions): Player | undefined {
        if (typeof idOrOptions === "string") return this.get(idOrOptions);
        return this.get(idOrOptions.id) ?? this.create(idOrOptions);
    }

    public get(id: string): Player | undefined {
        const activePlayer = this.players.get(id);
        if (activePlayer) {
            this.refreshUnloadTimer(id);
            return activePlayer;
        }

        const data = this.database.get(id);
        if (!data) return undefined;

        const loadedPlayer = new Player(
            data.id,
            data.name,
            data.classId,
            data.locationId,
            data.level,
            data.experience,
            data.health,
            data.maxHealth,
            data.strength,
            data.agility,
            data.intelligence,
            data.defense,
            data.attributePoints,
        );

        // Chargement de l'inventaire depuis la BDD d'inventaire
        const savedItems = this.inventoryDb.getPlayerInventory(id);
        if (loadedPlayer.inventory && typeof loadedPlayer.inventory.load === "function") {
            loadedPlayer.inventory.load(savedItems);
        }

        this.players.set(id, loadedPlayer);
        this.refreshUnloadTimer(id);
        this.#logger.debug(`Player ${id} loaded with inventory.`);

        return loadedPlayer;
    }

    public create(options: CreatePlayerOptions): Player {
        const { id, name, playerClass } = options;
        if (this.exist(id)) throw new Error(`Player ${id} already exists.`);

        const player = new Player(id, name, playerClass, this.#rpg.location.getStartingCityId());
        this.players.set(id, player);
        this.save(player);
        this.refreshUnloadTimer(id);

        this.#logger.debug(`Player ${id} created with class ${playerClass}.`);
        return player;
    }

    public exist(id: string): boolean {
        return this.players.has(id) || this.database.get(id) !== undefined;
    }

    public delete(id: string): boolean {
        this.clearUnloadTimer(id);
        this.players.delete(id);
        this.inventoryDb.clearInventory(id);
        const dbDeleted = this.database.delete(id);
        this.#logger.debug(`Player ${id} permanently deleted.`);
        return dbDeleted;
    }

    public count(): PlayerCount {
        return { active: this.players.size, total: this.database.count() };
    }

    public remove(id: string): void {
        const player = this.players.get(id);
        if (!player) {
            this.clearUnloadTimer(id);
            return;
        }

        this.save(player);
        this.clearUnloadTimer(id);
        this.players.delete(id);
        this.#logger.debug(`Player ${id} unloaded from memory.`);
    }

    private refreshUnloadTimer(id: string): void {
        this.clearUnloadTimer(id);
        const timer = setTimeout(() => this.remove(id), PlayerManager.INACTIVITY_TIME);
        timer.unref();
        this.unloadTimers.set(id, timer);
    }

    private clearUnloadTimer(id: string): void {
        const timer = this.unloadTimers.get(id);
        if (!timer) return;
        clearTimeout(timer);
        this.unloadTimers.delete(id);
    }

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
            strength: player.attributes.strength,
            agility: player.attributes.agility,
            intelligence: player.attributes.intelligence,
            defense: player.attributes.defense,
            attributePoints: player.attributes.points,
        };
        
        // Sauvegarde des stats et de l'inventaire
        this.database.save(data);
        if (player.inventory && typeof player.inventory.getItems === "function") {
            this.inventoryDb.savePlayerInventory(player.id, player.inventory.getItems());
        }
    }

    public has(id: string): boolean { return this.exist(id); }
    public get size(): number { return this.players.size; }
}