import { EnemyType } from "./enemy.type.js";
import Player from "../player/player.entity.js";
import Enemy from "./enemy.entity.js";

export type EnemyStats = { name: string; health: number; strength: number; defense: number; experience: number };

export default class EnemyManager {
    private readonly enemies: Record<EnemyType, EnemyStats> = {
        [EnemyType.Goblin]: { name: "Goblin", health: 50, strength: 6, defense: 2, experience: 25 },
        [EnemyType.Wolf]: { name: "Wolf", health: 40, strength: 8, defense: 2, experience: 30 },
        [EnemyType.Skeleton]: { name: "Skeleton", health: 60, strength: 7, defense: 5, experience: 40 },
    };

    public create(player: Player): Enemy {
        const types = Object.keys(this.enemies) as EnemyType[];
        return this.createOfType(types[Math.floor(Math.random() * types.length)], player.level);
    }

    public createOfType(type: EnemyType, playerLevel: number = 1): Enemy {
        const base = this.enemies[type];
        const scale = 1 + (playerLevel - 1) * 0.1;
        const scaleVal = (val: number) => Math.max(1, Math.round(val * scale * (0.85 + Math.random() * 0.3)));
        const health = scaleVal(base.health);

        return new Enemy(type, base.name, health, health, scaleVal(base.strength), scaleVal(base.defense), Math.round(base.experience * scale));
    }
}