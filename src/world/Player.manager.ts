import Player from "../player/Character.js";
import PlayerDatabase from "../database/Character.repository.js";
import { Logger } from "../utils/Logger.js";

export default class PlayerManager {
    private readonly logger = new Logger({ context: "PlayerManager" });
    private readonly players = new Map<string, Player>();
    private readonly timers = new Map<string, NodeJS.Timeout>();
    private readonly database = new PlayerDatabase();
    private readonly inactivityTime = 15 * 60 * 1000;

    public get(id: string): Player | undefined {
        let player = this.players.get(id);
        if (player) {
            this.resetUnloadTimer(id);
            return player;
        }

        const data = this.database.get(id);
        if (!data) { return undefined; }
        player = new Player(data.Identifier, data.Name, data.Class);
        this.players.set(id, player);
        this.resetUnloadTimer(id);
        this.logger.debug(`Player ${id} loaded from database.`);
        return player;
    }

    public create(id: string, name: string, className: string): Player {
        if (this.database.get(id)) { throw new Error(`Player ${id} already exists.`); }
        const player = new Player(id, name, className);
        this.database.save({Name: player.name, Identifier: player.id, Class: player.className});
        this.players.set(id, player);
        this.resetUnloadTimer(id);
        this.logger.debug(`Player ${id} created with class ${className}.`);
        return player;
    }

    private resetUnloadTimer(id: string): void {
        const existingTimer = this.timers.get(id);
        if (existingTimer) { clearTimeout(existingTimer); }
        const timer = setTimeout(() => { this.remove(id); }, this.inactivityTime);
        timer.unref();
        this.timers.set(id, timer);
    }

    public remove(id: string): void {
        const player = this.players.get(id);
        if (!player) { return; }
        this.database.save({ Name: player.name, Identifier: player.id, Class: player.className });
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
        }
        this.players.delete(id);
        this.logger.debug(`Player ${id} unloaded from memory.`);
    }

    public has(id: string): boolean { return this.players.has(id); }
    public get size(): number { return this.players.size; }
}
