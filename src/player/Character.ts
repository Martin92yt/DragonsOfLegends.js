import { Class } from "../../enums/Player.Class.js";
import { Logger } from "../utils/Logger.js";

interface ClassStats {
    strength: number;
    agility: number;
    intelligence: number;
    defense: number;
}

export default class Player {
    private readonly logger = new Logger({ context: "Player" });

    public level: number;
    public experience: number;

    public health: number;
    public maxHealth: number;

    public strength: number;
    public agility: number;
    public intelligence: number;
    public defense: number;

    constructor(
        public readonly id: string,
        public name: string,
        public readonly className: Class,
        level = 1,
        experience = 0,
        health = 100,
        maxHealth = 100,
        strength?: number,
        agility?: number,
        intelligence?: number,
        defense?: number,
    ) {
        this.level = level;
        this.experience = experience;

        this.health = health;
        this.maxHealth = maxHealth;

        const classStats = this.getClassStats();

        this.strength = strength ?? classStats.strength;
        this.agility = agility ?? classStats.agility;
        this.intelligence = intelligence ?? classStats.intelligence;
        this.defense = defense ?? classStats.defense;

        this.logger.debug(`Player ${id} initialized.`);
    }

    public addExperience(amount: number): void {
        if (amount <= 0) {
            return;
        }

        this.experience += amount;

        while (this.experience >= this.experienceToNextLevel) {
            this.experience -= this.experienceToNextLevel;
            this.levelUp();
        }
    }

    public get experienceToNextLevel(): number {
        return this.level * 100;
    }

    public attack(): number {
        const damage = Math.max(
            1,
            this.strength + Math.floor(Math.random() * 6) - 2,
        );

        this.logger.debug(
            `Player ${this.id} attacks for ${damage} damage.`,
        );

        return damage;
    }

    public takeDamage(damage: number): void {
        const reducedDamage = Math.max(
            1,
            damage - Math.floor(this.defense / 2),
        );

        this.health = Math.max(0, this.health - reducedDamage);

        this.logger.debug(
            `Player ${this.id} takes ${reducedDamage} damage (${this.health}/${this.maxHealth}).`,
        );
    }

    public isAlive(): boolean {
        return this.health > 0;
    }

    private getClassStats(): ClassStats {
        switch (this.className) {
            case Class.Warrior:
                return this.generateStats({
                    strength: 10,
                    agility: 5,
                    intelligence: 3,
                    defense: 10,
                });

            case Class.Explorer:
                return this.generateStats({
                    strength: 6,
                    agility: 10,
                    intelligence: 6,
                    defense: 5,
                });

            case Class.Mage:
                return this.generateStats({
                    strength: 3,
                    agility: 5,
                    intelligence: 12,
                    defense: 4,
                });

            default:
                throw new Error(`Unknown player class: ${this.className}`);
        }
    }

    private generateStats(baseStats: ClassStats): ClassStats {
        return {
            strength: this.randomize(baseStats.strength),
            agility: this.randomize(baseStats.agility),
            intelligence: this.randomize(baseStats.intelligence),
            defense: this.randomize(baseStats.defense),
        };
    }

    private randomize(value: number): number {
        const minFactor = 0.8;
        const maxFactor = 1.2;
        const factor = minFactor + Math.random() * (maxFactor - minFactor);

        return Math.max(1, Math.round(value * factor));
    }

    private levelUp(): void {
        this.level++;

        this.maxHealth += 10;
        this.health = this.maxHealth;

        this.strength++;
        this.agility++;
        this.intelligence++;
        this.defense++;

        this.logger.info(
            `Player ${this.id} reached level ${this.level}.`,
        );
    }
}
