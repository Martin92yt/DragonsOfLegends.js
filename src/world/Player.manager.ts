import Player from "../entity/Character.js";
import PlayerDatabase from "../database/Character.repository.js";
import { PlayerClass } from "../../enums/Player.Class.js";
import { Logger } from "../utils/Logger.js";

interface CreatePlayerOptions {
    id: string;
    name: string;
    playerClass: PlayerClass;
}

interface PlayerCount {
    active: number;
    total: number;
}

export default class PlayerManager {
    private static readonly INACTIVITY_TIME = 15 * 60 * 1000;

    #logger = new Logger({ context: "PlayerManager" });

    private readonly players = new Map<string, Player>();
    private readonly unloadTimers = new Map<string, NodeJS.Timeout>();
    private readonly database = new PlayerDatabase();

    public ensure(id: string): Player | undefined;
    public ensure(options: CreatePlayerOptions): Player;
    public ensure(
        idOrOptions: string | CreatePlayerOptions,
    ): Player | undefined {
        if (typeof idOrOptions === "string") {
            return this.get(idOrOptions);
        }

        const player = this.get(idOrOptions.id);
        if (player) return player;

        return this.create(idOrOptions);
    }

    public get(id: string): Player | undefined {
        const player = this.players.get(id);

        if (player) {
            this.refreshUnloadTimer(id);
            return player;
        }

        const data = this.database.get(id);
        if (!data) return undefined;

        const loadedPlayer = new Player(
            data.Identifier,
            data.Name,
            data.Class,
            data.Level,
            data.Experience,
            data.Health,
            data.MaxHealth,
            data.Strength,
            data.Agility,
            data.Intelligence,
            data.Defense,
            data.AttributePoints,
        );

        this.players.set(id, loadedPlayer);
        this.refreshUnloadTimer(id);

        this.#logger.debug(`Player ${id} loaded from database.`);

        return loadedPlayer;
    }

    public create(options: CreatePlayerOptions): Player {
        const { id, name, playerClass } = options;

        if (this.exist(id)) {
            throw new Error(`Player ${id} already exists.`);
        }

        const player = new Player(id, name, playerClass);

        this.players.set(id, player);
        this.save(player);
        this.refreshUnloadTimer(id);

        this.#logger.debug(
            `Player ${id} created with class ${playerClass}.`,
        );

        return player;
    }

    /**
     * Check if a player exists in memory or in the database.
     */
    public exist(id: string): boolean {
        return (
            this.players.has(id) ||
            this.database.get(id) !== undefined
        );
    }

    /**
     * Delete a player completely from memory and database.
     */
    public delete(id: string): boolean {
        const exists = this.exist(id);

        if (!exists) {
            return false;
        }

        this.clearUnloadTimer(id);
        this.players.delete(id);
        this.database.delete(id);

        this.#logger.debug(`Player ${id} permanently deleted.`);

        return true;
    }

    /**
     * Returns the number of active players and total players.
     *
     * active = players currently loaded in memory
     * total  = players stored in database
     */
    public count(): PlayerCount {
        return {
            active: this.players.size,
            total: this.database.count(),
        };
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

    public has(id: string): boolean {
        return this.exist(id);
    }

    public get size(): number {
        return this.players.size;
    }

    private refreshUnloadTimer(id: string): void {
        this.clearUnloadTimer(id);

        const timer = setTimeout(
            () => this.remove(id),
            PlayerManager.INACTIVITY_TIME,
        );

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
        this.database.save({
            Identifier: player.id,
            Name: player.name,
            Class: player.classId,
            Level: player.level,
            Experience: player.experience.current,
            Health: player.health.current,
            MaxHealth: player.health.max,
            Strength: player.attributes.strength,
            Agility: player.attributes.agility,
            Intelligence: player.attributes.intelligence,
            Defense: player.attributes.defense,
            AttributePoints: player.attributes.points,
        });
    }
}
