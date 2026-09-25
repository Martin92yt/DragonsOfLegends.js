import EnemyManager from "../enemy/enemy.manager.js";
import PlayerEntity from "../player/player.entity.js";
import { consola } from "consola";
import Combat from "./combat.js";
import { CombatResult } from "../types/result.js";
import { PlayerAlreadyInCombatError, PlayerNotInCombatError } from "../types/error.js";
import EnemyEntity from "../enemy/enemy.js";

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
     */
    public start(playerEntity: PlayerEntity): Combat {
        const generatedEnemyEntity = this.enemyManagerInstance.create(playerEntity);
        return this.registerCombat(playerEntity, generatedEnemyEntity);
    }

    /**
     * Starts a combat against a specific enemy.
     */
    public startWithEnemy(playerEntity: PlayerEntity, enemyEntity: EnemyEntity): Combat {
        return this.registerCombat(playerEntity, enemyEntity);
    }

    /**
     * Performs an attack for a player in combat.
     */
    public async attack(targetPlayerId: string): Promise<CombatResult> {
        const activeCombatInstance = this.activeCombatMap.get(targetPlayerId);
        if (!activeCombatInstance) {
            consola.warn(`Attack failed: player with ID ${targetPlayerId} is not in combat.`);
            throw new PlayerNotInCombatError(targetPlayerId);
        }

        // 🛡️ Ajout du 'await' indispensable ici car Combat.attack() est devenu async
        const combatTurnResult = await activeCombatInstance.attack();
        if (combatTurnResult.victory || combatTurnResult.defeat) {
            this.clear(targetPlayerId);
        }
        return combatTurnResult;
    }

    /**
     * Checks whether a player has an active combat.
     */
    public has(targetPlayerId: string): boolean {
        return this.activeCombatMap.has(targetPlayerId);
    }

    /**
     * Retrieves a player's active combat.
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
     */
    public get size(): number {
        return this.activeCombatMap.size;
    }

    /**
     * Stops all active combats and safely compensates affected players with balanced values.
     */
    public stopAllCombats(): void {
        for (const activeCombatInstance of this.activeCombatMap.values()) {
            const affectedPlayerEntity = activeCombatInstance.playerEntity;
            affectedPlayerEntity.addXP(affectedPlayerEntity.level * 5);
            affectedPlayerEntity.gold += Math.floor(affectedPlayerEntity.gold * 0.005);
            affectedPlayerEntity.inCombat = false;
        }
        this.activeCombatMap.clear();
        consola.success("All active combats stopped.");
    }
}