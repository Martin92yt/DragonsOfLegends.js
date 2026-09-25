import { EnemyType } from "./enemy.type.js";
import Player from "../player/player.entity.js";
import Enemy from "./enemy.js";
import { consola } from "consola";

export interface EnemyStats {
    name: string;
    health: number;
    strength: number;
    defense: number;
    experience: number;
    gold: number;
}

type EnemyTier = "beginner" | "intermediate" | "advanced" | "boss";

export default class EnemyManager {
    // Rebalanced elite spawn frequency and stat scaling factor to curb exponential difficulty spikes.
    private static readonly ELITE_SPAWN_CHANCE = 0.08;
    private static readonly BASE_STAT_SCALE_FACTOR = 0.09;

    private readonly enemyBaseStatsRegistry: Record<EnemyType, EnemyStats> = {
        [EnemyType.Goblin]: { name: "Goblin", health: 50, strength: 6, defense: 2, experience: 25, gold: 8 },
        [EnemyType.Wolf]: { name: "Wild Wolf", health: 40, strength: 8, defense: 2, experience: 30, gold: 10 },
        [EnemyType.Slime]: { name: "Gooey Slime", health: 35, strength: 4, defense: 1, experience: 15, gold: 4 },
        [EnemyType.Bandit]: { name: "Highway Bandit", health: 65, strength: 9, defense: 4, experience: 45, gold: 20 },
        [EnemyType.GiantRat]: { name: "Giant Rat", health: 30, strength: 5, defense: 1, experience: 10, gold: 3 },
        [EnemyType.WildBoar]: { name: "Furious Boar", health: 55, strength: 10, defense: 3, experience: 35, gold: 12 },
        [EnemyType.Skeleton]: { name: "Warrior Skeleton", health: 60, strength: 7, defense: 5, experience: 40, gold: 16 },
        [EnemyType.Spider]: { name: "Giant Spider", health: 45, strength: 11, defense: 3, experience: 45, gold: 15 },
        [EnemyType.Orc]: { name: "Brutal Orc", health: 90, strength: 14, defense: 6, experience: 75, gold: 35 },
        [EnemyType.Ghost]: { name: "Wandering Specter", health: 50, strength: 12, defense: 8, experience: 65, gold: 28 },
        [EnemyType.Zombie]: { name: "Rotten Zombie", health: 80, strength: 10, defense: 4, experience: 50, gold: 18 },
        [EnemyType.DarkCultist]: { name: "Shadow Cultist", health: 70, strength: 16, defense: 3, experience: 85, gold: 48 },
        [EnemyType.Troll]: { name: "Cave Troll", health: 150, strength: 20, defense: 10, experience: 150, gold: 95 },
        [EnemyType.Minotaur]: { name: "Enraged Minotaur", health: 180, strength: 25, defense: 12, experience: 200, gold: 130 },
        [EnemyType.Vampire]: { name: "Vampire Lord", health: 130, strength: 22, defense: 9, experience: 220, gold: 160 },
        [EnemyType.Witch]: { name: "Swamp Witch", health: 90, strength: 28, defense: 5, experience: 180, gold: 120 },
        [EnemyType.StoneGolem]: { name: "Stone Golem", health: 250, strength: 18, defense: 25, experience: 250, gold: 180 },
        [EnemyType.Lich]: { name: "Supreme Lich", health: 300, strength: 35, defense: 15, experience: 500, gold: 400 },
        [EnemyType.DemonLord]: { name: "Demon Lord", health: 450, strength: 45, defense: 20, experience: 800, gold: 680 },
        [EnemyType.AncientDragon]: { name: "Ancient Dragon", health: 700, strength: 60, defense: 30, experience: 1500, gold: 1500 },
        [EnemyType.Hydra]: { name: "Seven-Headed Hydra", health: 600, strength: 50, defense: 22, experience: 1200, gold: 1250 },
    };

    private readonly enemyTierPools: Record<EnemyTier, readonly EnemyType[]> = {
        beginner: [EnemyType.Goblin, EnemyType.Wolf, EnemyType.Slime, EnemyType.GiantRat, EnemyType.WildBoar],
        intermediate: [EnemyType.Bandit, EnemyType.Skeleton, EnemyType.Spider, EnemyType.Orc, EnemyType.Ghost, EnemyType.Zombie],
        advanced: [EnemyType.DarkCultist, EnemyType.Troll, EnemyType.Minotaur, EnemyType.Vampire, EnemyType.Witch, EnemyType.StoneGolem],
        boss: [EnemyType.Lich, EnemyType.DemonLord, EnemyType.AncientDragon, EnemyType.Hydra],
    };

    /**
     * Creates a random enemy based on the player's level.
     *
     * @param playerEntity The player used to determine the enemy difficulty.
     * @returns A newly created enemy instance.
     */
    public create(playerEntity: Player): Enemy {
        const availableEnemyPool = this.getEnemyPool(playerEntity.level);
        const randomSelectedEnemyType = availableEnemyPool[Math.floor(Math.random() * availableEnemyPool.length)];
        return this.createOfType(randomSelectedEnemyType, playerEntity.level);
    }

    /**
     * Creates an enemy of a specific type.
     *
     * @param enemyType The enemy type to create.
     * @param playerLevel The player level used for enemy scaling.
     * @returns A newly created enemy instance.
     */
    public createOfType(enemyType: EnemyType, playerLevel = 1): Enemy {
        const baseEnemyStats = this.enemyBaseStatsRegistry[enemyType];
        if (!baseEnemyStats) {
            consola.error(`Failed to create enemy: unknown enemy type ${enemyType}.`);
            return new Enemy(enemyType, "Unknown Enemy", 50, 50, 5, 2, 10, 5);
        }

        const isEliteEnemy = Math.random() < EnemyManager.ELITE_SPAWN_CHANCE;
        const statScalingMultiplier = 1 + Math.max(0, playerLevel - 1) * EnemyManager.BASE_STAT_SCALE_FACTOR;
        const eliteAttributeMultiplier = isEliteEnemy ? 1.4 : 1;
        const rewardMultiplier = isEliteEnemy ? 1.75 : 1;

        const resolvedEnemyName = isEliteEnemy ? `★ ${baseEnemyStats.name} (Elite)` : baseEnemyStats.name;
        const scaledHealthPoints = this.calculateStat(baseEnemyStats.health, statScalingMultiplier * eliteAttributeMultiplier);
        const scaledStrength = this.calculateStat(baseEnemyStats.strength, statScalingMultiplier * eliteAttributeMultiplier);
        const scaledDefense = this.calculateStat(baseEnemyStats.defense, statScalingMultiplier * eliteAttributeMultiplier, 0);
        const scaledExperienceReward = this.calculateStat(baseEnemyStats.experience, statScalingMultiplier * rewardMultiplier);
        const scaledGoldReward = this.calculateStat(baseEnemyStats.gold, statScalingMultiplier * rewardMultiplier);

        consola.success(`Spawned enemy: ${resolvedEnemyName} (Lv. ${playerLevel}).`);

        return new Enemy(
            enemyType,
            resolvedEnemyName,
            scaledHealthPoints,
            scaledHealthPoints,
            scaledStrength,
            scaledDefense,
            scaledExperienceReward,
            scaledGoldReward
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
     * Selects an enemy pool based on the player's level.
     *
     * @param playerLevel The player level used to determine the difficulty tier.
     * @returns A pool of possible enemy types.
     */
    private getEnemyPool(playerLevel: number): readonly EnemyType[] {
        if (playerLevel < 1) {
            consola.warn(`Invalid player level ${playerLevel} encountered; defaulting pool to beginner tier.`);
            return this.enemyTierPools.beginner;
        }

        if (playerLevel < 3) {
            return Math.random() < 0.85 ? this.enemyTierPools.beginner : this.enemyTierPools.intermediate;
        }

        if (playerLevel < 6) {
            return Math.random() < 0.75 ? this.enemyTierPools.intermediate : this.enemyTierPools.advanced;
        }

        return Math.random() < 0.9 ? this.enemyTierPools.advanced : this.enemyTierPools.boss;
    }
}