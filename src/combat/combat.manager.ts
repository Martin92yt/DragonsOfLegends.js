import EnemyManager from "../enemy/enemy.manager.js";
import type EnemyRegistry from "../enemy/enemy.registry.js";
import type { EnemySpawnRule } from "../enemy/enemy.definition.js";
import PlayerEntity from "../player/player.entity.js";
import { consola } from "consola";
import Combat from "./combat.js";
import { CombatResult } from "../types/result.js";
import { PlayerAlreadyInCombatError, PlayerNotInCombatError } from "../types/error.js";
import EnemyEntity from "../enemy/enemy.js";

export default class CombatManager {
    private readonly activeCombatMap = new Map<string, Combat>();
    private readonly enemyManagerInstance: EnemyManager;

    /**
     * Creates the combat manager.
     *
     * @param enemies The enemy registry spawns are drawn from. Without it, a private registry holding the official enemies is used.
     * @param spawnRules The rules choosing the enemy tier from the player level.
     * @param resolvePlayer Looks up a loaded player by identifier, so `attack` can report a death before anything else.
     */
    public constructor(enemies?: EnemyRegistry, spawnRules?: readonly EnemySpawnRule[], private readonly resolvePlayer?: (playerId: string) => PlayerEntity | undefined) {
        this.enemyManagerInstance = new EnemyManager(enemies, spawnRules);
    }

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
        // Fire-and-forget: combat start is synchronous, so asynchronous listeners are not awaited.
        playerEntity.worldInstance.events.emit("combatStart", {
            playerId: playerEntity.id,
            player: playerEntity,
            combat: newCombatInstance,
            enemy: enemyEntity
        });
        return newCombatInstance;
    }

    /**
     * Starts a combat against a randomly selected enemy.
     */
    public start(playerEntity: PlayerEntity): Combat {
        playerEntity.assertCanAct("combat.start");
        const generatedEnemyEntity = this.enemyManagerInstance.create(playerEntity);
        return this.registerCombat(playerEntity, generatedEnemyEntity);
    }

    /**
     * Starts a combat against a specific enemy.
     */
    public startWithEnemy(playerEntity: PlayerEntity, enemyEntity: EnemyEntity): Combat {
        playerEntity.assertCanAct("combat.start");
        return this.registerCombat(playerEntity, enemyEntity);
    }

    /**
     * Performs an attack for a player in combat.
     */
    public async attack(targetPlayerId: string): Promise<CombatResult> {
        // A dead player must be told they are dead, not that they are "not in combat" (their combat was closed by their death).
        this.resolvePlayer?.(targetPlayerId)?.assertCanAct("combat.attack");
        const activeCombatInstance = this.activeCombatMap.get(targetPlayerId);
        if (!activeCombatInstance) {
            consola.warn(`Attack failed: player with ID ${targetPlayerId} is not in combat.`);
            throw new PlayerNotInCombatError(targetPlayerId);
        }

        // 🛡️ Ajout du 'await' indispensable ici car Combat.attack() est devenu async
        const combatTurnResult = await activeCombatInstance.attack();
        if (combatTurnResult.victory || combatTurnResult.defeat) {
            this.clear(targetPlayerId);
            await activeCombatInstance.playerEntity.worldInstance.events.emitAsync("combatEnd", {
                playerId: targetPlayerId,
                player: activeCombatInstance.playerEntity,
                combat: activeCombatInstance,
                enemy: activeCombatInstance.enemyEntity,
                outcome: combatTurnResult.victory ? "victory" : "defeat"
            });
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
            affectedPlayerEntity.worldInstance.events.emit("combatEnd", {
                playerId: affectedPlayerEntity.id,
                player: affectedPlayerEntity,
                combat: activeCombatInstance,
                enemy: activeCombatInstance.enemyEntity,
                outcome: "aborted"
            });
        }
        this.activeCombatMap.clear();
        consola.success("All active combats stopped.");
    }
}