import { EnemyType } from "./enemy.type.js";
import Player from "../player/player.entity.js";
import Enemy from "./enemy.entity.js";
import { Logger } from "../utils/logger.js";

export type EnemyStats = { name: string; health: number; strength: number; defense: number; experience: number };

export default class EnemyManager {
    private readonly logger = new Logger({ context: "EnemyManager" });

    private readonly enemies: Record<EnemyType, EnemyStats> = {
        [EnemyType.Goblin]: { name: "Gobelin", health: 50, strength: 6, defense: 2, experience: 25 },
        [EnemyType.Wolf]: { name: "Loup Sauvage", health: 40, strength: 8, defense: 2, experience: 30 },
        [EnemyType.Slime]: { name: "Slime Gluant", health: 35, strength: 4, defense: 1, experience: 15 },
        [EnemyType.Bandit]: { name: "Bandit de Grand-Chemin", health: 65, strength: 9, defense: 4, experience: 45 },
        [EnemyType.GiantRat]: { name: "Rat Géant", health: 30, strength: 5, defense: 1, experience: 10 },
        [EnemyType.WildBoar]: { name: "Sanglier Furieux", health: 55, strength: 10, defense: 3, experience: 35 },

        [EnemyType.Skeleton]: { name: "Squelette Guerrier", health: 60, strength: 7, defense: 5, experience: 40 },
        [EnemyType.Spider]: { name: "Araignée Géante", health: 45, strength: 11, defense: 3, experience: 45 },
        [EnemyType.Orc]: { name: "Orc Brutal", health: 90, strength: 14, defense: 6, experience: 75 },
        [EnemyType.Ghost]: { name: "Spectre Errant", health: 50, strength: 12, defense: 8, experience: 65 },
        [EnemyType.Zombie]: { name: "Zombie Putréfié", health: 80, strength: 10, defense: 4, experience: 50 },
        [EnemyType.DarkCultist]: { name: "Cultiste des Ombres", health: 70, strength: 16, defense: 3, experience: 85 },

        [EnemyType.Troll]: { name: "Troll des Cavernes", health: 150, strength: 20, defense: 10, experience: 150 },
        [EnemyType.Minotaur]: { name: "Minotaure Enragé", health: 180, strength: 25, defense: 12, experience: 200 },
        [EnemyType.Vampire]: { name: "Seigneur Vampire", health: 130, strength: 22, defense: 9, experience: 220 },
        [EnemyType.Witch]: { name: "Sorcière des Marais", health: 90, strength: 28, defense: 5, experience: 180 },
        [EnemyType.StoneGolem]: { name: "Golem de Pierre", health: 250, strength: 18, defense: 25, experience: 250 },

        [EnemyType.Lich]: { name: "Liche Suprême", health: 300, strength: 35, defense: 15, experience: 500 },
        [EnemyType.DemonLord]: { name: "Seigneur Démonaque", health: 450, strength: 45, defense: 20, experience: 800 },
        [EnemyType.AncientDragon]: { name: "Dragon Ancien", health: 700, strength: 60, defense: 30, experience: 1500 },
        [EnemyType.Hydra]: { name: "Hydre aux Sept Têtes", health: 600, strength: 50, defense: 22, experience: 1200 },
    };

    private readonly tiers = {
        beginner: [EnemyType.Goblin, EnemyType.Wolf, EnemyType.Slime, EnemyType.GiantRat, EnemyType.WildBoar],
        intermediate: [EnemyType.Bandit, EnemyType.Skeleton, EnemyType.Spider, EnemyType.Orc, EnemyType.Ghost, EnemyType.Zombie],
        advanced: [EnemyType.DarkCultist, EnemyType.Troll, EnemyType.Minotaur, EnemyType.Vampire, EnemyType.Witch, EnemyType.StoneGolem],
        boss: [EnemyType.Lich, EnemyType.DemonLord, EnemyType.AncientDragon, EnemyType.Hydra]
    };

    public create(player: Player): Enemy {
        let pool: EnemyType[];
        if (player.level < 3) {
            pool = Math.random() < 0.8 ? this.tiers.beginner : this.tiers.intermediate;
        } else if (player.level < 6) {
            pool = Math.random() < 0.7 ? this.tiers.intermediate : this.tiers.advanced;
        } else {
            pool = Math.random() < 0.85 ? this.tiers.advanced : this.tiers.boss;
        }

        const randomType = pool[Math.floor(Math.random() * pool.length)];
        return this.createOfType(randomType, player.level);
    }

    public createOfType(type: EnemyType, playerLevel: number = 1): Enemy {
        const base = this.enemies[type] || this.enemies[EnemyType.Goblin];
        const scale = 1 + (playerLevel - 1) * 0.12;

        // 10% de chance qu'un monstre soit "Elite" (stats boostées x1.5 et nom modifié)
        const isElite = Math.random() < 0.10;
        const eliteMultiplier = isElite ? 1.5 : 1.0;
        const enemyName = isElite ? `★ ${base.name} (Élite)` : base.name;

        // Variance aléatoire forte : un multiplicateur entre 0.70 et 1.35 (soit de -30% à +35% de stats brutes)
        const randomFactor = () => 0.70 + Math.random() * 0.65;

        const health = Math.max(1, Math.round(base.health * scale * eliteMultiplier * randomFactor()));
        const strength = Math.max(1, Math.round(base.strength * scale * eliteMultiplier * randomFactor()));
        const defense = Math.max(0, Math.round(base.defense * scale * eliteMultiplier * randomFactor()));
        const experience = Math.round(base.experience * scale * (isElite ? 2.0 : 1.0) * randomFactor());

        if (isElite) {
            this.logger.info(`⚡ Elite enemy spawned: ${enemyName} (Level ${playerLevel}) with ${health} HP!`);
        } else {
            this.logger.debug(`Spawned enemy: ${enemyName} (Type: ${type}, Level: ${playerLevel}, HP: ${health})`);
        }

        return new Enemy(type, enemyName, health, health, strength, defense, experience);
    }
}