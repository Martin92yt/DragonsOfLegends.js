import Player from "../entity/Character.js";
import { Logger } from "../utils/Logger.js";
import Enemy from "./Enemy.js";

export default class Combat {
    #logger = new Logger({ context: "Combat" });

    constructor(
        public readonly player: Player,
        public readonly enemy: Enemy,
    ) {}

    public attack() {
        const playerDamage = this.enemy.takeDamage(this.getPlayerDamage());

        this.#logger.info(
            `Player deals ${playerDamage} damage to enemy ${this.enemy.name}.`,
        );

        if (!this.enemy.isAlive()) {
            this.player.gainExperience(this.enemy.experience);
            this.#logger.info(`Player gains ${this.enemy.experience} experience.`);

            return {
                playerDamage,
                enemyDamage: 0,
                enemyHealth: 0,
                victory: true,
                defeat: false,
            };
        }

        const enemyDamage = Math.max(
            1,
            this.enemy.strength - Math.floor(this.player.attributes.defense / 2),
        );

        this.player.takeDamage(enemyDamage);

        return {
            playerDamage,
            enemyDamage,
            enemyHealth: this.enemy.health,
            victory: false,
            defeat: !this.player.isAlive(),
        };
    }

    public isFinished(): boolean {
        return !this.player.isAlive() || !this.enemy.isAlive();
    }

    private getPlayerDamage(): number {
        const classStats = {
            warrior: this.player.attributes.strength,
            explorer: this.player.attributes.agility,
            mage: this.player.attributes.intelligence,
        };

        const stat = classStats[this.player.classId];
        const variation = Math.floor(Math.random() * 6) - 2;

        return Math.max(1, stat + variation);
    }
}
