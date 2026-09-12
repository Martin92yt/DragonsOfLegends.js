import { CreatePlayerOptions, PlayerCount, PlayerData } from "./player.interface.js";
import PlayerDatabase from "./player.database.js";
import Player from "./player.entity.js";
import { Logger } from "../utils/logger.js";
import World from "../world.js";
import { PlayerAlreadyExistsError } from "../types/error.js";
import { InventoryEntity } from "../inventory/inventory.entity.js";

export default class PlayerManager {
    private static readonly INACTIVITY_TIME = 15 * 60 * 1000;

    private readonly logger = new Logger({ context: "PlayerManager" });
    private readonly rpg: World;
    private readonly players = new Map<string, Player>();
    private readonly unloadTimers = new Map<string, NodeJS.Timeout>();
    private readonly database = new PlayerDatabase();

    constructor(rpg: World) { 
        this.rpg = rpg; 
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

        if (loadedPlayer.inventory && typeof loadedPlayer.inventory.load === "function") {
            loadedPlayer.inventory.load();
        }

        this.players.set(id, loadedPlayer);
        this.refreshUnloadTimer(id);
        this.logger.debug(`Player ${id} loaded into cache with inventory.`);

        return loadedPlayer;
    }

    public create(options: CreatePlayerOptions): Player {
        const { id, name, playerClass } = options;
        if (this.exist(id)) throw new PlayerAlreadyExistsError(id);

        // Correction : on passe une chaîne vide ou le partenaire par défaut s'il y en a un
        const player = new Player(
            this.rpg, 
            id, 
            name, 
            playerClass, 
            this.rpg.location.getStartingCityId(), 
            1, // level
            0, // experience
            100, // health
            100, // maxHealth
            "" // partener vide par défaut à la création
        );
        
        this.players.set(id, player);
        this.save(player);
        this.refreshUnloadTimer(id);

        this.logger.info(`New player registered: ${name} (${id}) as class ${playerClass}.`);
        return player;
    }

    public exist(id: string): boolean {
        return this.players.has(id) || this.database.get(id) !== undefined;
    }

    public delete(id: string): boolean {
        this.clearUnloadTimer(id);
        this.players.delete(id);
        
        const inventory = new InventoryEntity(id);
        if (typeof inventory.clear === "function") {
            inventory.clear();
        }

        const dbDeleted = this.database.delete(id);
        this.logger.info(`Player ${id} permanently deleted from database and cache.`);
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
            partener: player.marriage?.getPartnerId() ?? "", // Sauvegarde propre du partenaire si géré via un module marriage
            strength: player.attributes.strength,
            agility: player.attributes.agility,
            intelligence: player.attributes.intelligence,
            defense: player.attributes.defense,
            attributePoints: player.attributes.points,
            gold: player.gold,
        };
        
        this.database.save(data);
    }

    public has(id: string): boolean { return this.exist(id); }
    public get size(): number { return this.players.size; }

    public saveAll(): void {
        this.logger.info(`Sauvegarde globale de ${this.players.size} joueur(s) actif(s)...`);

        for (const [id, player] of this.players.entries()) {
            this.save(player);
            
            // Sécurise la sauvegarde de l'inventaire de chaque joueur actif
            if (player.inventory && typeof player.inventory.save === "function") {
                player.inventory.save();
            }

            this.clearUnloadTimer(id);
        }

        this.logger.info("Tous les joueurs actifs et leurs inventaires ont été sauvegardés avec succès.");
    }
}