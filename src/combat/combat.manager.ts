import EnemyManager from "../enemy/enemy.manager.js";
import { Logger } from "../utils/logger.js";
import Player from "../player/player.entity.js";
import Combat, { CombatResult } from "./combat.js";

export default class CombatManager {
    private readonly combats = new Map<string, Combat>();
    private readonly enemies = new EnemyManager();
    private readonly logger = new Logger({ context: "CombatManager" });

    public start(player: Player): Combat {
        const existing = this.combats.get(player.id);
        if (existing && !existing.isFinished()) throw new Error(`Player ${player.id} is already in combat.`);

        const enemy = this.enemies.create(player);
        const combat = new Combat(player, enemy);

        this.logger.info(`Starting combat for player ${player.id} against ${enemy.name}.`);
        this.combats.set(player.id, combat);
        return combat;
    }

    public attack(playerId: string): CombatResult {
        const combat = this.combats.get(playerId);
        if (!combat) throw new Error(`Player ${playerId} is not in combat.`);

        const result = combat.attack();
        if (result.victory || result.defeat) this.combats.delete(playerId);
        return result;
    }

    public has(playerId: string): boolean { return this.combats.has(playerId); }
    public get(playerId: string): Combat | undefined { return this.combats.get(playerId); }
    public clear(playerId: string): boolean { return this.combats.delete(playerId); }
    public get size(): number { return this.combats.size; }
}