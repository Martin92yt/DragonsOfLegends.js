import { PlayerClass } from "./player.class.js";
import { Logger } from "../utils/logger.js";
import { PlayerExperience, PlayerHealth, PlayerAttributes, ClassStats, GainExperienceResult, PlayerSnapshot, DamageResult } from "./player.interface.js";
import { ExplorationResult } from "../location/location.interface.js";
import { InventoryEntity } from "../inventory/inventory.entity.js";
import EnemyEntity from "../enemy/enemy.entity.js";
import { EnemyType } from "../enemy/enemy.type.js";

export type Attribute = "strength" | "agility" | "intelligence" | "defense";

export default class PlayerEntity {
    private static readonly BASE_HEALTH = 100;
    private static readonly HP_PER_LEVEL = 10;
    private static readonly XP_PER_LEVEL = 100;

    private readonly logger = new Logger({ context: "Player" });

    public level: number;
    public experience: PlayerExperience;
    public health: PlayerHealth;
    public attributes: PlayerAttributes;
    public readonly inventory: InventoryEntity;
    public isTravelling = false;

    constructor(
        public readonly id: string,
        public name: string,
        public readonly classId: PlayerClass,
        public location: string,
        level = 1, experience = 0, health = PlayerEntity.BASE_HEALTH, maxHealth = PlayerEntity.BASE_HEALTH,
        strength?: number, agility?: number, intelligence?: number, defense?: number, attributePoints = 0,
    ) {
        const baseStats = this.generateBaseStats();
        this.level = Math.max(1, level);
        this.experience = { current: Math.max(0, experience), required: this.level * PlayerEntity.XP_PER_LEVEL };
        this.health = { current: Math.max(0, Math.min(health, maxHealth)), max: Math.max(1, maxHealth) };
        this.attributes = {
            points: Math.max(0, attributePoints),
            strength: strength ?? baseStats.strength,
            agility: agility ?? baseStats.agility,
            intelligence: intelligence ?? baseStats.intelligence,
            defense: defense ?? baseStats.defense,
        };
        
        // Instanciation de l'inventaire dédié au joueur
        this.inventory = new InventoryEntity(this.id);
        
        this.logger.debug(`Player entity initialized for ${this.name} (ID: ${this.id}).`);
    }

    public async moveTo(destinationId: string): Promise<ExplorationResult> {
        if (this.isTravelling) throw new Error("Player is already travelling.");
        
        this.logger.debug(`${this.name} travelling to ${destinationId}.`);
        this.isTravelling = true;
        
        const travelTimeMs = Math.floor(Math.random() * 4001) + 1000;
        await new Promise((resolve) => setTimeout(resolve, travelTimeMs));
        this.isTravelling = false;

        // 30% de chance d'embuscade
        if (Math.random() < 0.30) {
            this.logger.info(`Ambush! ${this.name} was attacked on the road to ${destinationId}.`);
            
            // Vérifie si on est dans une zone d'eau (ex: si l'ID contient "water", "sea", "ocean", "lake", etc.)
            const isWaterArea = /water|sea|ocean|lake|riviere|lac|eau/i.test(destinationId);

            let chosenEnemyType: EnemyType;

            if (isWaterArea) {
                // Mobs aquatiques (adapte selon les types disponibles dans ton EnemyType)
                const waterEnemies = [EnemyType.Hydra, EnemyType.GiantRat]; // Ajoute des monstres aquatiques si tu en as
                chosenEnemyType = waterEnemies[Math.floor(Math.random() * waterEnemies.length)];
            } else {
                // Mobs terrestres classiques
                const landEnemies = [
                    EnemyType.Slime,
                    EnemyType.Goblin,
                    EnemyType.Wolf,
                    EnemyType.Bandit,
                    EnemyType.WildBoar,
                    EnemyType.Skeleton
                ];
                chosenEnemyType = landEnemies[Math.floor(Math.random() * landEnemies.length)];
            }

            // Génération dynamique de l'ennemi en fonction du niveau du joueur
            const enemyName = chosenEnemyType.charAt(0).toUpperCase() + chosenEnemyType.slice(1);
            const baseHp = 30 + (this.level * 10);
            
            const enemy = new EnemyEntity(
                chosenEnemyType,
                enemyName,
                baseHp,
                baseHp,
                5 + this.level * 2,
                2 + this.level,
                15 * this.level
            );

            return { arrived: false, attacked: true, travelTimeMs, locationId: this.location, enemy };
        }

        this.location = destinationId;
        this.logger.debug(`${this.name} arrived at ${destinationId}.`);
        return { arrived: true, attacked: false, travelTimeMs, locationId: this.location };
    }

    public gainExperience(amount: number): GainExperienceResult {
        if (amount <= 0) return { amount: 0, total: this.experience.current, leveledUp: false, level: this.level };

        this.logger.info(`${this.name} gained ${amount} XP (${this.experience.current} → ${this.experience.current+amount} / ${this.experience.required}).`)
        this.experience.current += amount;
        let leveledUp = false;

        while (this.experience.current >= this.experience.required) {
            this.experience.current -= this.experience.required;
            this.levelUp();
            leveledUp = true;
        }

        return { amount, total: this.experience.current, leveledUp, level: this.level };
    }

    public attack(): number {
        const damage = Math.max(1, this.attributes.strength + Math.floor(Math.random() * 6) - 2);
        this.logger.debug(`Player ${this.name} strikes for ${damage} damage.`);
        return damage;
    }

    public takeDamage(damage: number): DamageResult | null {
    if (damage <= 0 || !this.isAlive()) {
        return null; // Ou retourne un objet par défaut si tu préfères ne pas retourner null
    }

    const reducedDamage = Math.max(1, damage - Math.floor(this.attributes.defense / 2));
    this.health.current = Math.max(0, this.health.current - reducedDamage);

    return {
        reducedDamage,
        currentHealth: this.health.current,
        rawDamage: damage
    };
}

    public isAlive(): boolean { return this.health.current > 0; }

    public levelUpSkill(attribute: Attribute): void {
        if (this.attributes.points <= 0) throw new Error("No attribute points available.");
        this.attributes[attribute]++;
        this.attributes.points--;
        this.logger.info(`Player ${this.name} allocated a point to ${attribute} (New value: ${this.attributes[attribute]}).`);
    }

    public toJSON(): PlayerSnapshot {
        return {
            id: this.id, name: this.name, classId: this.classId, level: this.level, locationId: this.location,
            experience: { ...this.experience }, health: { ...this.health }, attributes: { ...this.attributes },
        };
    }

    private levelUp(): void {
        this.level++;
        this.health.max += PlayerEntity.HP_PER_LEVEL;
        this.health.current = this.health.max;
        this.attributes.strength++; this.attributes.agility++; this.attributes.intelligence++; this.attributes.defense++; this.attributes.points++;
        this.experience.required = this.level * PlayerEntity.XP_PER_LEVEL;
        this.logger.info(`${this.name} reached level ${this.level}!`)
    }

    private generateBaseStats(): ClassStats {
        const stats: Record<PlayerClass, ClassStats> = {
            [PlayerClass.Warrior]: { strength: 10, agility: 5, intelligence: 3, defense: 10 },
            [PlayerClass.Explorer]: { strength: 6, agility: 10, intelligence: 6, defense: 5 },
            [PlayerClass.Mage]: { strength: 3, agility: 5, intelligence: 12, defense: 4 },
        };
        const base = stats[this.classId];
        if (!base) throw new Error(`Unknown player class: ${this.classId}`);

        const rand = (val: number) => Math.max(1, Math.round(val * (0.8 + Math.random() * 0.4)));
        return { strength: rand(base.strength), agility: rand(base.agility), intelligence: rand(base.intelligence), defense: rand(base.defense) };
    }
}