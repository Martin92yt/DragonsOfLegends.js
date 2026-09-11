import EnemyManager from "./Enemy.manager.js";
import { Logger } from "../utils/Logger.js";
import Player from "../entity/Player.js";
import Combat from "../combat/Combat.js";

export default class CombatManager {
    private readonly combats = new Map<string, Combat>();
    private readonly enemies = new EnemyManager();
    #logger = new Logger({ context: "CombatManager" });

    public start(player: Player): Combat {
        const existingCombat = this.combats.get(player.id);
        if (existingCombat && !existingCombat.isFinished()) throw new Error("Player is already in combat.");
        const enemy = this.enemies.create(player);

        this.#logger.info(`Starting combat for player ${player.id} against ${enemy.name}.`);

        const combat = new Combat(player, enemy);
        this.combats.set(player.id, combat);
        return combat;
    }

    public attack(playerId: string) {
        const combat = this.combats.get(playerId);
        if (!combat) throw new Error("Player is not in combat.");

        const result = combat.attack();
        if (result.victory || result.defeat) this.combats.delete(playerId);
        return result;
    }

    public has(playerId: string): boolean { return this.combats.has(playerId); }
    public get size(): number { return this.combats.size; }
    public get(playerId: string): Combat | undefined { return this.combats.get(playerId); }
}
