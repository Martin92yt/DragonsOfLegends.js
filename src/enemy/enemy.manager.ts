import { EnemyType } from "./enemy.type.js";
import Player from "../player/player.entity.js";
import Enemy from "./enemy.entity.js";
import { Logger } from "../utils/logger.js";

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
    readonly #logger = new Logger({ context: "EnemyManager" });

    private readonly enemies: Record<EnemyType, EnemyStats> = {
        [EnemyType.Goblin]: { name: "Goblin", health: 50, strength: 6, defense: 2, experience: 25, gold: 10 },
        [EnemyType.Wolf]: { name: "Wild Wolf", health: 40, strength: 8, defense: 2, experience: 30, gold: 12 },
        [EnemyType.Slime]: { name: "Gooey Slime", health: 35, strength: 4, defense: 1, experience: 15, gold: 5 },
        [EnemyType.Bandit]: { name: "Highway Bandit", health: 65, strength: 9, defense: 4, experience: 45, gold: 25 },
        [EnemyType.GiantRat]: { name: "Giant Rat", health: 30, strength: 5, defense: 1, experience: 10, gold: 3 },
        [EnemyType.WildBoar]: { name: "Furious Boar", health: 55, strength: 10, defense: 3, experience: 35, gold: 15 },
        [EnemyType.Skeleton]: { name: "Warrior Skeleton", health: 60, strength: 7, defense: 5, experience: 40, gold: 20 },
        [EnemyType.Spider]: { name: "Giant Spider", health: 45, strength: 11, defense: 3, experience: 45, gold: 18 },
        [EnemyType.Orc]: { name: "Brutal Orc", health: 90, strength: 14, defense: 6, experience: 75, gold: 45 },
        [EnemyType.Ghost]: { name: "Wandering Specter", health: 50, strength: 12, defense: 8, experience: 65, gold: 35 },
        [EnemyType.Zombie]: { name: "Rotten Zombie", health: 80, strength: 10, defense: 4, experience: 50, gold: 22 },
        [EnemyType.DarkCultist]: { name: "Shadow Cultist", health: 70, strength: 16, defense: 3, experience: 85, gold: 60 },
        [EnemyType.Troll]: { name: "Cave Troll", health: 150, strength: 20, defense: 10, experience: 150, gold: 120 },
        [EnemyType.Minotaur]: { name: "Enraged Minotaur", health: 180, strength: 25, defense: 12, experience: 200, gold: 160 },
        [EnemyType.Vampire]: { name: "Vampire Lord", health: 130, strength: 22, defense: 9, experience: 220, gold: 200 },
        [EnemyType.Witch]: { name: "Swamp Witch", health: 90, strength: 28, defense: 5, experience: 180, gold: 150 },
        [EnemyType.StoneGolem]: { name: "Stone Golem", health: 250, strength: 18, defense: 25, experience: 250, gold: 220 },
        [EnemyType.Lich]: { name: "Supreme Lich", health: 300, strength: 35, defense: 15, experience: 500, gold: 500 },
        [EnemyType.DemonLord]: { name: "Demon Lord", health: 450, strength: 45, defense: 20, experience: 800, gold: 850 },
        [EnemyType.AncientDragon]: { name: "Ancient Dragon", health: 700, strength: 60, defense: 30, experience: 1500, gold: 2000 },
        [EnemyType.Hydra]: { name: "Seven-Headed Hydra", health: 600, strength: 50, defense: 22, experience: 1200, gold: 1600 },
    };

    private readonly tiers: Record<EnemyTier, readonly EnemyType[]> = {
        beginner: [EnemyType.Goblin, EnemyType.Wolf, EnemyType.Slime, EnemyType.GiantRat, EnemyType.WildBoar],
        intermediate: [EnemyType.Bandit, EnemyType.Skeleton, EnemyType.Spider, EnemyType.Orc, EnemyType.Ghost, EnemyType.Zombie],
        advanced: [EnemyType.DarkCultist, EnemyType.Troll, EnemyType.Minotaur, EnemyType.Vampire, EnemyType.Witch, EnemyType.StoneGolem],
        boss: [EnemyType.Lich, EnemyType.DemonLord, EnemyType.AncientDragon, EnemyType.Hydra],
    };

    /**
     * Creates a random enemy based on the player's level.
     * @param player Player used to determine the enemy difficulty.
     * @returns A newly created enemy.
     */
    public create(player: Player): Enemy {
        const pool = this.getEnemyPool(player.level);
        const randomType = pool[Math.floor(Math.random() * pool.length)];
        return this.createOfType(randomType, player.level);
    }

    /**
     * Creates an enemy of a specific type.
     * @param type Enemy type to create.
     * @param playerLevel Player level used for enemy scaling.
     * @returns A newly created enemy.
     */
    public createOfType(type: EnemyType, playerLevel: number = 1): Enemy {
        const base = this.enemies[type];
        const scale = 1 + Math.max(0, playerLevel - 1) * 0.12;
        const isElite = Math.random() < 0.1;
        const eliteMultiplier = isElite ? 1.5 : 1;
        const randomFactor = (): number => 0.7 + Math.random() * 0.65;
        const name = isElite ? `★ ${base.name} (Elite)` : base.name;
        const health = Math.max(1, Math.round(base.health * scale * eliteMultiplier * randomFactor()));
        const strength = Math.max(1, Math.round(base.strength * scale * eliteMultiplier * randomFactor()));
        const defense = Math.max(0, Math.round(base.defense * scale * eliteMultiplier * randomFactor()));
        const rewardMultiplier = isElite ? 2 : 1;
        const experience = Math.max(1, Math.round(base.experience * scale * rewardMultiplier * randomFactor()));
        const gold = Math.max(1, Math.round(base.gold * scale * rewardMultiplier * randomFactor()));

        if (isElite) {
            this.#logger.info(`Elite enemy spawned: ${name} (Lv. ${playerLevel}, ${health} HP).`);
        } else {
            this.#logger.debug(`Spawned enemy: ${name} (Type: ${type}, Level: ${playerLevel}, HP: ${health}).`);
        }

        return new Enemy(type, name, health, health, strength, defense, experience, gold);
    }

    /**
     * Selects an enemy pool based on the player's level.
     * @param playerLevel Player level used to determine the difficulty tier.
     * @returns A pool of possible enemy types.
     */
    private getEnemyPool(playerLevel: number): readonly EnemyType[] {
        if (playerLevel < 3) {
            return Math.random() < 0.8 ? this.tiers.beginner : this.tiers.intermediate;
        }

        if (playerLevel < 6) {
            return Math.random() < 0.7 ? this.tiers.intermediate : this.tiers.advanced;
        }

        return Math.random() < 0.85 ? this.tiers.advanced : this.tiers.boss;
    }
}
