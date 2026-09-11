import Player from "../player/player.entity.js";
import Enemy from "../enemy/enemy.entity.js";
import { Logger } from "../utils/logger.js";

export interface CombatResult {
    playerDamage: number;
    enemyDamage: number;
    enemyHealth: number;
    victory: boolean;
    defeat: boolean;
}

export default class Combat {
    private readonly logger = new Logger({ context: "Combat" });

    constructor(public readonly player: Player, public readonly enemy: Enemy) {}

    public attack(): CombatResult {
        const playerDamage = this.enemy.takeDamage(this.getPlayerDamage());
        this.logger.info(`Player deals ${playerDamage} damage to ${this.enemy.name}.`);

        if (!this.enemy.isAlive()) {
            this.player.gainExperience(this.enemy.experience);
            this.logger.info(`Player gained ${this.enemy.experience} XP.`);
            return { playerDamage, enemyDamage: 0, enemyHealth: 0, victory: true, defeat: false };
        }

        const enemyDamage = Math.max(1, this.enemy.strength - Math.floor(this.player.attributes.defense / 2));
        this.player.takeDamage(enemyDamage);

        return { playerDamage, enemyDamage, enemyHealth: this.enemy.health, victory: false, defeat: !this.player.isAlive() };
    }

    private getPlayerDamage(): number {
        const statMap: Record<string, number> = { warrior: this.player.attributes.strength, explorer: this.player.attributes.agility, mage: this.player.attributes.intelligence };
        const baseStat = statMap[this.player.classId] ?? this.player.attributes.strength;
        return Math.max(1, baseStat + Math.floor(Math.random() * 6) - 2);
    }

    public isFinished(): boolean { return !this.player.isAlive() || !this.enemy.isAlive(); }
}