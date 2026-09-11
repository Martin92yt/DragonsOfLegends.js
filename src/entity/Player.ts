import { PlayerClass } from "../../enums/Player.Class.js";
import { Logger } from "../utils/Logger.js";

type Attribute = "strength" | "agility" | "intelligence" | "defense";
import { PlayerExperience, PlayerHealth, PlayerAttributes, ClassStats, GainExperienceResult, PlayerSnapshot } from "../../interfaces/Player.interface.js";
import { ExplorationResult } from "../../interfaces/Location.interface.js";

export default class Player {
    private static readonly BASE_HEALTH = 100;
    private static readonly HEALTH_PER_LEVEL = 10;
    private static readonly EXPERIENCE_PER_LEVEL = 100;

    #logger: Logger;

    public level: number;
    public experience: PlayerExperience;
    public health: PlayerHealth;
    public attributes: PlayerAttributes;

    constructor(
        public readonly id: string,
        public name: string,
        public readonly classId: PlayerClass,
        public location: string,
        level = 1,
        experience = 0,
        health = Player.BASE_HEALTH,
        maxHealth = Player.BASE_HEALTH,
        strength?: number,
        agility?: number,
        intelligence?: number,
        defense?: number,
        attributePoints = 0,
    ) {
        this.#logger = new Logger({ context: "Player" });

        const stats = this.getClassStats();

        this.level = Math.max(1, level);
        this.location = location;
        this.experience = {
            current: Math.max(0, experience),
            required: this.level * Player.EXPERIENCE_PER_LEVEL,
        };

        this.health = {
            current: Math.max(0, Math.min(health, maxHealth)),
            max: Math.max(1, maxHealth),
        };

        this.attributes = {
            points: Math.max(0, attributePoints),
            strength: strength ?? stats.strength,
            agility: agility ?? stats.agility,
            intelligence: intelligence ?? stats.intelligence,
            defense: defense ?? stats.defense,
        };

        this.#logger.debug(`Player ${this.id} initialized.`);
    }

    public async moveTo(destinationId: string): Promise<ExplorationResult> {
        this.#logger.debug(`Player ${this.id} is travelling towards ${destinationId}...`);

        const travelTimeMs = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
        await new Promise((resolve) => setTimeout(resolve, travelTimeMs));

        const attacked = Math.random() < 0.30;

        if (attacked) {
            this.#logger.debug(`Player ${this.id} was attacked on the road.`);
            
            // Instancie ou récupère l'ennemi ici selon ta logique de jeu
            const enemy = { name: "Gobelin", level: this.level }; 

            return {
                arrived: false,
                attacked: true,
                enemy,
                travelTimeMs,
                locationId: this.location, // Le joueur reste sur sa zone d'origine
            };
        }

        this.location = destinationId;
        this.#logger.debug(`Player ${this.id} arrived at ${destinationId}.`);

        return {
            arrived: true,
            attacked: false,
            travelTimeMs,
            locationId: this.location,
        };
    }

    public gainExperience(amount: number): GainExperienceResult {
        if (amount <= 0) {
            return {
                amount: 0,
                total: this.experience.current,
                leveledUp: false,
                level: this.level,
            };
        }

        this.experience.current += amount;

        let leveledUp = false;

        while (this.experience.current >= this.experience.required) {
            this.experience.current -= this.experience.required;
            this.levelUp();
            leveledUp = true;
        }

        this.#logger.debug(
            `Player ${this.id} gained ${amount} experience (${this.experience.current}/${this.experience.required}).`,
        );

        return {
            amount,
            total: this.experience.current,
            leveledUp,
            level: this.level,
        };
    }

    public attack(): number {
        const damage = Math.max(
            1,
            this.attributes.strength + Math.floor(Math.random() * 6) - 2,
        );

        this.#logger.debug(
            `Player ${this.id} attacks for ${damage} damage.`,
        );

        return damage;
    }

    public takeDamage(damage: number): void {
        if (damage <= 0 || !this.isAlive()) return;

        const reducedDamage = Math.max(
            1,
            damage - Math.floor(this.attributes.defense / 2),
        );

        this.health.current = Math.max(
            0,
            this.health.current - reducedDamage,
        );

        this.#logger.debug(
            `Player ${this.id} takes ${reducedDamage} damage (${this.health.current}/${this.health.max}).`,
        );
    }

    public isAlive(): boolean {
        return this.health.current > 0;
    }

    public levelUpSkill(attribute: Attribute): void {
        if (this.attributes.points <= 0) {
            throw new Error("No attribute points available.");
        }

        this.attributes[attribute]++;
        this.attributes.points--;

        this.#logger.debug(
            `Player ${this.id} increased ${attribute} to ${this.attributes[attribute]}.`,
        );
    }

    public toJSON(): PlayerSnapshot {
        return {
            id: this.id,
            name: this.name,
            classId: this.classId,
            level: this.level,
            locationId: this.location,
            experience: {
                current: this.experience.current,
                required: this.experience.required,
            },
            health: {
                current: this.health.current,
                max: this.health.max,
            },
            attributes: {
                points: this.attributes.points,
                strength: this.attributes.strength,
                agility: this.attributes.agility,
                intelligence: this.attributes.intelligence,
                defense: this.attributes.defense,
            },
        };
    }

    private levelUp(): void {
        this.level++;

        this.health.max += Player.HEALTH_PER_LEVEL;
        this.health.current = this.health.max;

        this.attributes.strength++;
        this.attributes.agility++;
        this.attributes.intelligence++;
        this.attributes.defense++;
        this.attributes.points++;

        this.experience.required =
            this.level * Player.EXPERIENCE_PER_LEVEL;

        this.#logger.info(
            `Player ${this.id} reached level ${this.level}.`,
        );
    }

    private getClassStats(): ClassStats {
        const stats: Record<PlayerClass, ClassStats> = {
            [PlayerClass.Warrior]: {
                strength: 10,
                agility: 5,
                intelligence: 3,
                defense: 10,
            },
            [PlayerClass.Explorer]: {
                strength: 6,
                agility: 10,
                intelligence: 6,
                defense: 5,
            },
            [PlayerClass.Mage]: {
                strength: 3,
                agility: 5,
                intelligence: 12,
                defense: 4,
            },
        };

        const classStats = stats[this.classId];

        if (!classStats) {
            throw new Error(`Unknown player class: ${this.classId}`);
        }

        return this.generateStats(classStats);
    }

    private generateStats(stats: ClassStats): ClassStats {
        return {
            strength: this.randomize(stats.strength),
            agility: this.randomize(stats.agility),
            intelligence: this.randomize(stats.intelligence),
            defense: this.randomize(stats.defense),
        };
    }

    private randomize(value: number): number {
        return Math.max(
            1,
            Math.round(value * (0.8 + Math.random() * 0.4)),
        );
    }
}