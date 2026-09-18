import EnemyManager from "../enemy/enemy.manager.js";
import PlayerEntity from "../player/player.entity.js";
import { consola } from "consola";
import Combat from "./combat.js";
import { CombatResult } from "../types/result.js";
import { PlayerAlreadyInCombatError, PlayerNotInCombatError } from "../types/error.js";
import EnemyEntity from "../enemy/enemy.class.js";

export default class CombatManager {
    private readonly activeCombatMap = new Map<string, Combat>();
    private readonly enemyManagerInstance = new EnemyManager();

    /**
     * Checks if a player is already in an active combat.
     */
    private ensurePlayerNotInCombat(playerEntity: PlayerEntity): void {
        const existingCombatInstance = this.activeCombatMap.get(playerEntity.id);
        if (existingCombatInstance && !existingCombatInstance.isFinished()) {
            consola.warn(`Combat start failed: player ${playerEntity.name} (${playerEntity.id}) is already in combat.`);
            throw new PlayerAlreadyInCombatError(playerEntity.id);
        }
    }

    /**
     * Registers and initializes a combat instance for a player.
     */
    private registerCombat(playerEntity: PlayerEntity, enemyEntity: EnemyEntity): Combat {
        this.ensurePlayerNotInCombat(playerEntity);
        const newCombatInstance = new Combat(playerEntity, enemyEntity);
        playerEntity.inCombat = true;
        this.activeCombatMap.set(playerEntity.id, newCombatInstance);
        consola.success(`Combat started for ${playerEntity.name}.`);
        return newCombatInstance;
    }

    /**
     * Starts a combat against a randomly selected enemy.
     *
     * @param playerEntity The player starting the combat.
     * @returns The newly created combat instance.
     */
    public start(playerEntity: PlayerEntity): Combat {
        const generatedEnemyEntity = this.enemyManagerInstance.create(playerEntity);
        return this.registerCombat(playerEntity, generatedEnemyEntity);
    }

    /**
     * Starts a combat against a specific enemy.
     *
     * @param playerEntity The player starting the combat.
     * @param enemyEntity The enemy to fight.
     * @returns The newly created combat instance.
     */
    public startWithEnemy(playerEntity: PlayerEntity, enemyEntity: EnemyEntity): Combat {
        return this.registerCombat(playerEntity, enemyEntity);
    }

    /**
     * Performs an attack for a player in combat.
     *
     * @param targetPlayerId The player's identifier.
     * @returns The result of the attack.
     */
    public attack(targetPlayerId: string): CombatResult {
        const activeCombatInstance = this.activeCombatMap.get(targetPlayerId);
        if (!activeCombatInstance) {
            consola.warn(`Attack failed: player with ID ${targetPlayerId} is not in combat.`);
            throw new PlayerNotInCombatError(targetPlayerId);
        }

        const combatTurnResult = activeCombatInstance.attack();
        if (combatTurnResult.victory || combatTurnResult.defeat) {
            this.clear(targetPlayerId);
        }
        return combatTurnResult;
    }

    /**
     * Checks whether a player has an active combat.
     *
     * @param targetPlayerId The player's identifier.
     * @returns True if the player has an active combat, false otherwise.
     */
    public has(targetPlayerId: string): boolean {
        return this.activeCombatMap.has(targetPlayerId);
    }

    /**
     * Retrieves a player's active combat.
     *
     * @param targetPlayerId The player's identifier.
     * @returns The active combat or undefined if none exists.
     */
    public get(targetPlayerId: string): Combat | undefined {
        const activeCombatInstance = this.activeCombatMap.get(targetPlayerId);
        if (!activeCombatInstance) {
            consola.warn(`Failed to retrieve active combat for player ID ${targetPlayerId}.`);
        }
        return activeCombatInstance;
    }

    /**
     * Removes a player's active combat.
     *
     * @param targetPlayerId The player's identifier.
     * @returns True if a combat was removed, false otherwise.
     */
    public clear(targetPlayerId: string): boolean {
        const activeCombatInstance = this.activeCombatMap.get(targetPlayerId);
        if (activeCombatInstance) {
            activeCombatInstance.playerEntity.inCombat = false;
        }
        return this.activeCombatMap.delete(targetPlayerId);
    }

    /**
     * Gets the number of active combats.
     *
     * @returns The number of active combats.
     */
    public get size(): number {
        return this.activeCombatMap.size;
    }

    /**
     * Stops all active combats and safely compensates affected players with balanced values.
     *
     * @returns void
     */
    public stopAllCombats(): void {
        for (const activeCombatInstance of this.activeCombatMap.values()) {
            const affectedPlayerEntity = activeCombatInstance.playerEntity;
            // Rebalanced compensation scaling to prevent runaway inflation during global resets.
            affectedPlayerEntity.addXP(affectedPlayerEntity.level * 5);
            affectedPlayerEntity.gold += Math.floor(affectedPlayerEntity.gold * 0.005);
            affectedPlayerEntity.inCombat = false;
        }
        this.activeCombatMap.clear();
        consola.success("All active combats stopped.");
    }
}