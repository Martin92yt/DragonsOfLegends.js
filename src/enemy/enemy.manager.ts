import { consola } from "consola";
import Player from "../player/player.entity.js";
import { NoEnemyAvailableError } from "../types/error.js";
import { DEFAULT_ENEMY_SPAWN_RULES, type EnemyDefinition, type EnemySpawnRule } from "./enemy.definition.js";
import EnemyRegistry from "./enemy.registry.js";
import { registerOfficialEnemies } from "./official-enemies.js";
import Enemy from "./enemy.js";

/**
 * Creates the enemies met by players, from the enemy registry.
 */
export default class EnemyManager {
    // Rebalanced elite spawn frequency and stat scaling factor to curb exponential difficulty spikes.
    private static readonly ELITE_SPAWN_CHANCE = 0.08;
    private static readonly BASE_STAT_SCALE_FACTOR = 0.09;

    private readonly registry: EnemyRegistry;
    private readonly spawnRules: readonly EnemySpawnRule[];

    /**
     * Creates an enemy manager.
     *
     * @param registry The registry holding the enemy species. Defaults to a private registry preloaded with
     * the official enemies, which keeps `new EnemyManager()` usable on its own.
     * @param spawnRules The rules choosing the tier from the player level ({@link DEFAULT_ENEMY_SPAWN_RULES} by default).
     */
    public constructor(registry?: EnemyRegistry, spawnRules: readonly EnemySpawnRule[] = DEFAULT_ENEMY_SPAWN_RULES) {
        if (registry) {
            this.registry = registry;
        } else {
            this.registry = new EnemyRegistry();
            registerOfficialEnemies(this.registry);
        }
        this.spawnRules = spawnRules;
    }

    /**
     * Creates a random enemy based on the player's level.
     *
     * @param playerEntity The player used to determine the enemy difficulty.
     * @returns A newly created enemy instance.
     * @throws {NoEnemyAvailableError} If no enemy is registered.
     */
    public create(playerEntity: Player): Enemy {
        const availablePool = this.getEnemyPool(playerEntity.level);
        const selected = availablePool[Math.floor(Math.random() * availablePool.length)] as EnemyDefinition;
        return this.createOfType(selected.id, playerEntity.level);
    }

    /**
     * Creates an enemy of a specific species.
     *
     * @param enemyType The identifier of the species to create.
     * @param playerLevel The player level used for enemy scaling.
     * @returns A newly created enemy instance (a generic fallback enemy if the species is unknown).
     */
    public createOfType(enemyType: string, playerLevel = 1): Enemy {
        const definition = this.registry.get(enemyType);
        if (!definition) {
            consola.error(`Failed to create enemy: unknown enemy type ${enemyType}.`);
            return new Enemy(enemyType, "Unknown Enemy", 50, 50, 5, 2, 10, 5);
        }

        const isEliteEnemy = Math.random() < EnemyManager.ELITE_SPAWN_CHANCE;
        const statScalingMultiplier = 1 + Math.max(0, playerLevel - 1) * EnemyManager.BASE_STAT_SCALE_FACTOR;
        const eliteAttributeMultiplier = isEliteEnemy ? 1.4 : 1;
        const rewardMultiplier = isEliteEnemy ? 1.75 : 1;

        const resolvedEnemyName = isEliteEnemy ? `★ ${definition.name} (Elite)` : definition.name;
        const scaledHealthPoints = this.calculateStat(definition.health, statScalingMultiplier * eliteAttributeMultiplier);
        const scaledStrength = this.calculateStat(definition.strength, statScalingMultiplier * eliteAttributeMultiplier);
        const scaledDefense = this.calculateStat(definition.defense, statScalingMultiplier * eliteAttributeMultiplier, 0);
        const scaledExperienceReward = this.calculateStat(definition.experience, statScalingMultiplier * rewardMultiplier);
        const scaledGoldReward = this.calculateStat(definition.gold, statScalingMultiplier * rewardMultiplier);

        consola.success(`Spawned enemy: ${resolvedEnemyName} (Lv. ${playerLevel}).`);

        return new Enemy(
            definition.id,
            resolvedEnemyName,
            scaledHealthPoints,
            scaledHealthPoints,
            scaledStrength,
            scaledDefense,
            scaledExperienceReward,
            scaledGoldReward,
            definition.loot ?? [],
            definition.tier
        );
    }

    /**
     * Calculates a scaled and randomized stat value with tighter variance bounds.
     */
    private calculateStat(baseValue: number, multiplier: number, minimumAllowedValue = 1): number {
        const randomVarianceFactor = 0.85 + Math.random() * 0.3;
        return Math.max(minimumAllowedValue, Math.round(baseValue * multiplier * randomVarianceFactor));
    }

    /**
     * Selects an enemy pool based on the player's level and the spawn rules.
     * Falls back to every registered enemy when the chosen tier is empty.
     *
     * @param playerLevel The player level used to determine the difficulty tier.
     * @returns A non-empty pool of enemy definitions.
     * @throws {NoEnemyAvailableError} If no enemy is registered.
     */
    private getEnemyPool(playerLevel: number): ReadonlyArray<Readonly<EnemyDefinition>> {
        const tier = this.pickTier(playerLevel);
        const tierPool = tier === undefined ? [] : this.registry.listByTier(tier);
        if (tierPool.length > 0) return tierPool;

        const everyEnemy = this.registry.list();
        if (everyEnemy.length === 0) throw new NoEnemyAvailableError();
        consola.warn(`No enemy registered for tier "${tier ?? "?"}"; picking among every registered enemy.`);
        return everyEnemy;
    }

    /**
     * Chooses a tier from the spawn rules.
     *
     * @param playerLevel The player level.
     * @returns The tier name, or undefined if the rules define none.
     */
    private pickTier(playerLevel: number): string | undefined {
        const firstRule = this.spawnRules[0];
        if (playerLevel < 1) {
            consola.warn(`Invalid player level ${playerLevel} encountered; defaulting pool to the first tier.`);
            return firstRule ? Object.keys(firstRule.tiers)[0] : undefined;
        }

        const rule = this.spawnRules.find((candidate) => playerLevel < candidate.belowLevel) ?? this.spawnRules[this.spawnRules.length - 1];
        if (!rule) return undefined;

        const weighted = Object.entries(rule.tiers);
        const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
        let threshold = Math.random() * total;
        for (const [tier, weight] of weighted) {
            if (threshold < weight) return tier;
            threshold -= weight;
        }
        return weighted[weighted.length - 1]?.[0];
    }
}
