import EnemyManager from "../enemy/enemy.manager.js";
import EnemyEntity from "../enemy/enemy.entity.js";
import Player from "../player/player.entity.js";
import { Logger } from "../utils/logger.js";
import Combat from "./combat.js";
import { CombatResult } from "../types/result.js";
import { PlayerAlreadyInCombatError, PlayerNotInCombatError } from "../types/error.js";

export default class CombatManager {
    private readonly combats = new Map<string, Combat>();
    private readonly enemies = new EnemyManager();
    readonly #logger = new Logger({ context: "CombatManager" });

    /**
     * Starts a combat against a randomly selected enemy.
     * @param player The player starting the combat.
     * @returns The newly created combat.
     * @throws PlayerAlreadyInCombatError If the player is already in an active combat.
     */
    public start(player: Player): Combat {
        const existingCombat = this.combats.get(player.id);
        if (existingCombat && !existingCombat.isFinished()) {
            throw new PlayerAlreadyInCombatError(player.id);
        }
        const enemy = this.enemies.create(player);
        const combat = new Combat(player, enemy);
        player.inCombat = true;
        this.combats.set(player.id, combat);
        this.#logger.info(`Combat started: ${player.name} vs ${enemy.name} (Lv. ${player.level}, ${enemy.health} HP).`);
        return combat;
    }

    /**
     * Starts a combat against a specific enemy.
     * @param player The player starting the combat.
     * @param enemy The enemy to fight.
     * @returns The newly created combat.
     * @throws PlayerAlreadyInCombatError If the player is already in an active combat.
     */
    public startWithEnemy(player: Player, enemy: EnemyEntity): Combat {
        const existingCombat = this.combats.get(player.id);
        if (existingCombat && !existingCombat.isFinished()) {
            throw new PlayerAlreadyInCombatError(player.id);
        }
        const combat = new Combat(player, enemy);
        player.inCombat = true;
        this.combats.set(player.id, combat);
        this.#logger.info(`Combat started: ${player.name} vs ${enemy.name} (Lv. ${player.level}, ${enemy.health} HP).`);
        return combat;
    }

    /**
     * Performs an attack for a player in combat.
     * @param playerId The player's identifier.
     * @returns The result of the attack.
     * @throws PlayerNotInCombatError If the player has no active combat.
     */
    public attack(playerId: string): CombatResult {
        const combat = this.combats.get(playerId);
        if (!combat) {
            throw new PlayerNotInCombatError(playerId);
        }
        const result = combat.attack();
        if (result.victory || result.defeat) {
            this.clear(playerId);
        }
        return result;
    }

    /**
     * Checks whether a player has an active combat.
     * @param playerId The player's identifier.
     * @returns True if the player has an active combat.
     */
    public has(playerId: string): boolean {
        return this.combats.has(playerId);
    }

    /**
     * Retrieves a player's active combat.
     * @param playerId The player's identifier.
     * @returns The active combat or undefined if none exists.
     */
    public get(playerId: string): Combat | undefined {
        return this.combats.get(playerId);
    }

    /**
     * Removes a player's active combat.
     * @param playerId The player's identifier.
     * @returns True if a combat was removed.
     */
    public clear(playerId: string): boolean {
        const combat = this.combats.get(playerId);
        if (combat) {
            combat.player.inCombat = false;
        }
        return this.combats.delete(playerId);
    }

    /**
     * Gets the number of active combats.
     * @returns The number of active combats.
     */
    public get size(): number {
        return this.combats.size;
    }

    /**
     * Stops all active combats and compensates affected players.
     * @returns void.
     */
    public stopAllCombats(): void {
        this.#logger.info("Stopping all active combats...");
        for (const combat of this.combats.values()) {
            const player = combat.player;
            const compensationXp = player.level * 10;
            player.addXP(compensationXp);
            player.gold += player.gold * 0.01;
            player.inCombat = false;
            this.#logger.info(`Combat stopped for ${player.name}. Compensation granted: +${compensationXp} XP.`);
        }
        this.combats.clear();
    }
}
