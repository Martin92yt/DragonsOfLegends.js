import { PlayerClass } from "./player.class.js";
import { Logger } from "../utils/logger.js";
import { PlayerExperience, PlayerHealth, PlayerAttributes, ClassStats, PlayerSnapshot } from "./player.interface.js";
import { InventoryEntity } from "../inventory/inventory.entity.js";
import EnemyEntity from "../enemy/enemy.entity.js";
import { EnemyType } from "../enemy/enemy.type.js";
import { ExplorationResult, GainExperienceResult, DamageResult } from "../types/result.js";
import { MoveInCombatError, NoAttributePointsError, PlayerAlreadyTravellingError, UnknownPlayerClassError } from "../types/error.js";
import World from "../world.js"
export type Attribute = "strength" | "agility" | "intelligence" | "defense";

export default class PlayerEntity {
    private readonly rpg: World; // 👈 Référence vers le monde
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
    public inCombat = false;

    constructor(
        rpg: World,
        public readonly id: string,
        public name: string,
        public readonly classId: PlayerClass,
        public location: string,
        level = 1, experience = 0, health = PlayerEntity.BASE_HEALTH, maxHealth = PlayerEntity.BASE_HEALTH,
        strength?: number, agility?: number, intelligence?: number, defense?: number, attributePoints = 0,
    ) {
        this.rpg = rpg;
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
        this.inventory = new InventoryEntity(this.id, this);
        
        // 🔄 Calcul initial de la santé max en fonction des équipements par défaut s'il y en a
        this.updateMaxHealth();

        this.logger.debug(`Player entity initialized for ${this.name} (ID: ${this.id}).`);
    }

public async moveTo(
        destinationId: string, 
        distance: number = 1, 
        danger: number = 1
    ): Promise<ExplorationResult> {
        // 🔒 Bloqué si déjà en voyage ou en plein combat
        if (this.isTravelling) throw new PlayerAlreadyTravellingError();
        if (this.inCombat) throw new MoveInCombatError();
        
        this.logger.debug(`${this.name} travelling to ${destinationId} (distance: ${distance}, danger: ${danger}).`);
        this.isTravelling = true;
        
        // Configuration des multiplicateurs et valeurs de base
        const BASE_TRAVEL_MS = 1000;         // 1 seconde de base minimum
        const TRAVEL_MULTIPLIER = 1000;      // 1 de distance = +1 seconde
        
        const BASE_AMBUSH_CHANCE = 0.15;     // 15% de base
        const DANGER_MULTIPLIER = 0.05;      // Chaque point de danger ajoute +5% de chance d'embuscade

        // 1. Calculs intermédiaires pour les logs demandés
        const randomBaseTime = Math.floor(Math.random() * 2001); // 0 à 2 secondes aléatoires
        
        // Temps sans distance et sans multiplicateur
        const timeWithoutDistanceAndMultiplier = randomBaseTime + BASE_TRAVEL_MS;
        
        // Temps avec la distance (en considérant un multiplicateur neutre de 1, ou en isolant la formule distance * BASE_VALUE)
        const timeWithDistanceOnly = timeWithoutDistanceAndMultiplier + (distance * 1);

        // Temps réel complet avec le TRAVEL_MULTIPLIER
        let travelTimeMs = timeWithoutDistanceAndMultiplier + ((distance * 1) * TRAVEL_MULTIPLIER);
        
        // Calcul dynamique du taux d'embuscade en fonction du danger
        const ambushChance = Math.min(BASE_AMBUSH_CHANCE + (danger * DANGER_MULTIPLIER), 0.90); // Plafonné à 90% max
        const willBeAmbushed = Math.random() < ambushChance;

        // Si une embuscade est prévue, le voyage est interrompu en chemin (le temps est divisé par 2.1)
        if (willBeAmbushed) {
            travelTimeMs = Math.floor(travelTimeMs / 2.1);
        }

        await new Promise((resolve) => setTimeout(resolve, travelTimeMs));
        this.isTravelling = false;

        // Gestion de l'embuscade
        if (willBeAmbushed) {
            this.logger.info(`Ambush! ${this.name} was attacked on the road to ${destinationId} (Danger: ${danger}).`);
            
            const isWaterArea = /water|sea|ocean|lake|riviere|lac|eau/i.test(destinationId);
            let chosenEnemyType: EnemyType;

            if (isWaterArea) {
                const waterEnemies = [EnemyType.Hydra, EnemyType.GiantRat];
                chosenEnemyType = waterEnemies[Math.floor(Math.random() * waterEnemies.length)];
            } else {
                const landEnemies = [EnemyType.Slime, EnemyType.Goblin, EnemyType.Wolf, EnemyType.Bandit, EnemyType.WildBoar, EnemyType.Skeleton];
                chosenEnemyType = landEnemies[Math.floor(Math.random() * landEnemies.length)];
            }

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

            this.rpg.combat.startWithEnemy(this, enemy); 

            return { arrived: false, attacked: true, travelTimeMs, locationId: this.location, enemy };
        }

        this.location = destinationId;
        this.logger.debug(`${this.name} arrived at ${destinationId} in ${travelTimeMs}ms.`);
        return { arrived: true, attacked: false, travelTimeMs, locationId: this.location };
    }

    public addXP(amount: number): GainExperienceResult {
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
        // 1. Calcul de la stat de base selon la classe
        const statMap: Record<string, number> = { 
            warrior: this.attributes.strength, 
            explorer: this.attributes.agility, 
            mage: this.attributes.intelligence 
        };
        const baseStat = statMap[this.classId] ?? this.attributes.strength;
        
        let totalDamage = baseStat + Math.floor(Math.random() * 6) - 2;

        // 2. Intégration des bonus/malus d'équipement
        if (this.inventory && typeof this.inventory.getItems === "function") {
            const items = this.inventory.getItems();
            const equippedItems = items.filter((i: any) => i.isEquipped);
            
            let flatBonus = 0;
            let percentageBonus = 0; // Ex: 0.016 (+1.6%) ou -0.008 (-0.8%)

            for (const item of equippedItems) {
                if (item.data) {
                    if (typeof item.data.flatDamage === "number") {
                        flatBonus += item.data.flatDamage;
                    }
                    // Lecture de la bonne clé + conversion du pourcentage (ex: 1.6 -> 0.016 ou -0.8 -> -0.008)
                    if (typeof item.data.damageBonusPercent === "number") {
                        percentageBonus += item.data.damageBonusPercent / 100;
                    }
                }
            }

            totalDamage += flatBonus;
            totalDamage = totalDamage * (1 + percentageBonus);
        }

        const finalDamage = Math.max(1, Math.floor(totalDamage));
        this.logger.debug(`Player ${this.name} strikes for ${finalDamage} damage.`);
        return finalDamage;
    }

    public takeDamage(damage: number): DamageResult | null {
        if (damage <= 0 || !this.isAlive()) {
            return null;
        }

        let baseDefense = this.attributes.defense ?? 0;

        if (this.inventory && typeof this.inventory.getItems === "function") {
            const items = this.inventory.getItems();
            const equippedItems = items.filter((i: any) => i.isEquipped);

            let flatDefense = 0;
            let percentDefense = 0; // Ex: 0.023 (+2.3% d'armure) ou -0.003 (-0.3% d'armure)

            for (const item of equippedItems) {
                if (item.data) {
                    // Si tu as de la défense brute (ex: data.defense = 25)
                    if (typeof item.data.defense === "number") {
                        flatDefense += item.data.defense;
                    }
                    // Lecture de la bonne clé pour les pourcentages d'armure (ex: 2.3 -> 0.023 ou -0.3 -> -0.003)
                    if (typeof item.data.armorBonusPercent === "number") {
                        percentDefense += item.data.armorBonusPercent / 100;
                    }
                }
            }

            // Applique d'abord les bonus bruts puis le multiplicateur de pourcentage (qui gère les bonus et les malus)
            baseDefense = (baseDefense + flatDefense) * (1 + percentDefense);
        }

        const totalDefense = Math.max(0, Math.floor(baseDefense));
        const reducedDamage = Math.max(1, damage - Math.floor(totalDefense / 2));
        this.health.current = Math.max(0, this.health.current - reducedDamage);

        return {
            reducedDamage,
            currentHealth: this.health.current,
            rawDamage: damage
        };
    }

    public isAlive(): boolean { return this.health.current > 0; }

    public levelUpSkill(attribute: Attribute): void {
        if (this.attributes.points <= 0) throw new NoAttributePointsError();
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
        // On met à jour la santé max en prenant en compte le nouveau niveau et les équipements
        this.updateMaxHealth();
        this.health.current = this.health.max; // Soin complet au level up

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
        if (!base) throw new UnknownPlayerClassError(this.classId);

        const rand = (val: number) => Math.max(1, Math.round(val * (0.8 + Math.random() * 0.4)));
        return { strength: rand(base.strength), agility: rand(base.agility), intelligence: rand(base.intelligence), defense: rand(base.defense) };
    }

    /**
     * Recalcule la santé maximale du joueur en fonction de son niveau, de sa base et de ses équipements.
     * À appeler lors d'un changement d'équipement (equip/unequip) et lors de la montée de niveau.
     */
    public updateMaxHealth(): void {
        const baseMax = PlayerEntity.BASE_HEALTH + (this.level * PlayerEntity.HP_PER_LEVEL);
        let bonusHealth = 0;

        if (this.inventory && typeof this.inventory.getItems === "function") {
            const items = this.inventory.getItems();
            const equippedItems = items.filter(i => i.isEquipped);

            for (const item of equippedItems) {
                if (item.data && typeof item.data.healthBonus === "number") {
                    bonusHealth += item.data.healthBonus;
                }
            }
        }

        // Calcule le nouveau max (avec un minimum de 1 PV)
        this.health.max = Math.max(1, baseMax + bonusHealth);

        // S'assure que les PV actuels ne dépassent pas le nouveau max
        if (this.health.current > this.health.max) {
            this.health.current = this.health.max;
        }
    }
}