import Player from "../player/Character.js";
import PlayerDatabase from "../database/Character.repository.js";
import { Class } from "../../enums/Player.Class.js";
import { Logger } from "../utils/Logger.js";

export default class PlayerManager {
    private readonly logger = new Logger({ context: "PlayerManager" });
    private readonly players = new Map<string, Player>();
    private readonly timers = new Map<string, NodeJS.Timeout>();
    private readonly database = new PlayerDatabase();

    private readonly inactivityTime = 15 * 60 * 1000;

    public get(id: string): Player | undefined {
        const cachedPlayer = this.players.get(id);

        if (cachedPlayer) {
            this.resetUnloadTimer(id);
            return cachedPlayer;
        }

        const data = this.database.get(id);

        if (!data) {
            return undefined;
        }

        const player = new Player(
            data.Identifier,
            data.Name,
            data.Class,
        );

        this.players.set(id, player);
        this.resetUnloadTimer(id);

        this.logger.debug(`Player ${id} loaded from database.`);

        return player;
    }

    public create(id: string, name: string, playerClass: Class): Player {
        if (this.database.get(id)) {
            throw new Error(`Player ${id} already exists.`);
        }

        const player = new Player(id, name, playerClass);

        this.savePlayer(player);
        this.players.set(id, player);
        this.resetUnloadTimer(id);

        this.logger.debug(
            `Player ${id} created with class ${playerClass}.`,
        );

        return player;
    }

    public remove(id: string): void {
        const player = this.players.get(id);

        if (!player) {
            return;
        }

        this.savePlayer(player);
        this.clearUnloadTimer(id);
        this.players.delete(id);

        this.logger.debug(`Player ${id} unloaded from memory.`);
    }

    public has(id: string): boolean {
        return this.players.has(id);
    }

    public get size(): number {
        return this.players.size;
    }

    private resetUnloadTimer(id: string): void {
        this.clearUnloadTimer(id);

        const timer = setTimeout(() => {
            this.remove(id);
        }, this.inactivityTime);

        timer.unref();

        this.timers.set(id, timer);
    }

    private clearUnloadTimer(id: string): void {
        const timer = this.timers.get(id);

        if (!timer) {
            return;
        }

        clearTimeout(timer);
        this.timers.delete(id);
    }

    private savePlayer(player: Player): void {
        this.database.save({
            Name: player.name,
            Identifier: player.id,
            Class: player.className,
            Level: player.level,
            Experience: player.experience,
            Health: player.health,
            MaxHealth: player.maxHealth,
            Strength: player.strength,
            Agility: player.agility,
            Intelligence: player.intelligence,
            Defense: player.defense,
        });
    }
}
