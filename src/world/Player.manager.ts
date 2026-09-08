import Player from "../player/Character.js";
import PlayerDatabase from "../database/Character.repository.js";
import { Logger } from "../utils/Logger.js";

export default class PlayerManager {
    private readonly logger = new Logger({ context: "PlayerManager" });
    private readonly players = new Map<string, Player>();
    private readonly timers = new Map<string, NodeJS.Timeout>();
    private readonly database = new PlayerDatabase();
    private readonly inactivityTime = 15 * 60 * 1000;

    public get(id: string): Player {
        let player = this.players.get(id);
        if (player) {
            this.resetUnloadTimer(id);
            return player;
        }

        const data = this.database.get(id);
        if (data) {
            player = new Player(data.Identifier, data.Name);
            this.logger.debug(`Player ${id} loaded from database.`);
        } else {
            player = new Player(id, "Unknown");
            this.logger.debug(`Player ${id} created.`);
        }

        this.players.set(id, player);
        this.resetUnloadTimer(id);
        return player;
    }

    private resetUnloadTimer(id: string): void {
        const existingTimer = this.timers.get(id);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(() => { this.remove(id); }, this.inactivityTime);
        this.timers.set(id, timer);
    }

    public remove(id: string): void {
        const player = this.players.get(id);
        if (!player) return;

        this.database.save({ Name: player.name, Identifier: player.id });
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
