import { PlayerClass } from "./player.class.js";
import { Logger } from "../utils/logger.js";
import { PlayerExperience, PlayerHealth, PlayerAttributes, ClassStats, PlayerSnapshot } from "./player.interface.js";
import { InventoryEntity } from "../inventory/inventory.entity.js";
import EnemyEntity from "../enemy/enemy.entity.js";
import { EnemyType } from "../enemy/enemy.type.js";
import { ExplorationResult, GainExperienceResult, DamageResult } from "../types/result.js";
import { MoveInCombatError, NoAttributePointsError, PlayerAlreadyTravellingError, UnknownPlayerClassError } from "../types/error.js";
import World from "../world.js"
import PlayerMarriage from "./player.marriage.js";
export type Attribute = "strength" | "agility" | "intelligence" | "defense";

export default class PlayerEntity {
    private readonly rpg: World; // 👈 Référence vers le monde
    private static readonly BASE_HEALTH = 100;
    private static readonly HP_PER_LEVEL = 10;
    private static readonly XP_PER_LEVEL = 100;

    private readonly logger = new Logger({ context: "Player" });

    public level: number;
    public gold: number;
    public experience: PlayerExperience;
    public health: PlayerHealth;
    public attributes: PlayerAttributes;
    public readonly inventory: InventoryEntity;
    public marriage: PlayerMarriage;
    public isTravelling = false;
    public inCombat = false;

    constructor(
        rpg: World,
        public readonly id: string,
        public name: string,
        public readonly classId: PlayerClass,
        public location: string,
        level = 1, experience = 0, health = PlayerEntity.BASE_HEALTH, maxHealth = PlayerEntity.BASE_HEALTH, partener: string,
        strength?: number, agility?: number, intelligence?: number, defense?: number, attributePoints = 0, gold: number = 0
    ) {
        this.rpg = rpg;
        this.gold = gold;
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
        
        this.inventory = new InventoryEntity(this.id, this);
        this.marriage = new PlayerMarriage(this, partener)
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
                15 * this.level,
                10 * this.gold
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

        const oldXP = this.experience.current;
        const newXP = oldXP + amount;
        this.experience.current = newXP;
        
        let leveledUp = false;

        while (this.experience.current >= this.experience.required) {
            this.experience.current -= this.experience.required;
            this.levelUp();
            leveledUp = true;
        }

        // Log affichant clairement la progression et le passage de niveau si applicable
        if (leveledUp) {
            this.logger.info(`${this.name} gained ${amount} XP (${oldXP} → ${newXP}), Level ${this.level}`);
        } else {
            this.logger.info(`${this.name} gained ${amount} XP (${oldXP} → ${newXP} / ${this.experience.required}).`);
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
        
        // Calcul du jet aléatoire (roll) entre -2 et +3 (correspondant à ton -2 + aléa de 6)
        const roll = Math.floor(Math.random() * 6) - 2;
        let totalDamage = baseStat + roll;

        // 2. Intégration des bonus/malus d'équipement
        let flatBonus = 0;
        let percentageBonus = 0;
        let items: any[] = [];

        if (this.inventory && typeof this.inventory.getItems === "function") {
            items = this.inventory.getItems();
            const equippedItems = items.filter((i: any) => i.isEquipped);

            for (const item of equippedItems) {
                if (item.data) {
                    let contributesToAttack = false;

                    const rawDmgBonus = (item.data as any).damageBonus ?? (item.data as any).flatDamage;
                    if (typeof rawDmgBonus === "number") {
                        flatBonus += rawDmgBonus;
                        contributesToAttack = true;
                    }
                    
                    const rawPctBonus = (item.data as any).damageBonusPercent;
                    if (typeof rawPctBonus === "number") {
                        percentageBonus += rawPctBonus / 100;
                        contributesToAttack = true;
                    }

                    // USURE
                    if (contributesToAttack && item.data.durability !== undefined && item.data.durability > 0) {
                        const rarityMultipliers: Record<string, number> = {
                            common: 1.5,
                            uncommon: 1.2,
                            rare: 1.0,
                            epic: 0.7,
                            legendary: 0.4
                        };
                        const mult = rarityMultipliers[item.rarity?.toLowerCase()] ?? 1.0;
                        const durabilityLoss = Math.max(1, Math.floor(1 * mult));
                        const oldDurability = item.data.durability;

                        item.data.durability = Math.max(0, item.data.durability - durabilityLoss);

                        const durabilityLogger = new Logger({ context: "Durability" });
                        durabilityLogger.debug(`${item.name}: ${oldDurability} → ${item.data.durability}.`);

                        if (item.data.durability === 0) {
                            durabilityLogger.debug(`${item.name} is completely broken!`);
                        }
                    }
                }
            }

            totalDamage += flatBonus;
            totalDamage = totalDamage * (1 + percentageBonus);

            if (this.inventory && typeof this.inventory.save === "function") {
                this.inventory.save(items); 
            }
        }

        const finalDamage = Math.max(1, Math.floor(totalDamage));

        // Log d'attaque condensé sous [Combat] au format souhaité
        const combatLogger = new Logger({ context: "Combat" });
        combatLogger.debug(`${this.name} attack: base=${baseStat}, roll=${roll}, equipment=+${flatBonus} (+${percentageBonus * 100}%), final=${finalDamage}.`);

        return finalDamage;
    }

public takeDamage(damage: number): DamageResult | null {
        if (damage <= 0 || !this.isAlive()) {
            return null;
        }

        const baseDefense = this.attributes.defense ?? 0;
        let items: any[] = [];
        let flatDefense = 0;
        let percentDefense = 0; 

        if (this.inventory && typeof this.inventory.getItems === "function") {
            items = this.inventory.getItems();
            const equippedItems = items.filter((i: any) => i.isEquipped);

            for (const item of equippedItems) {
                if (item.data) {
                    let contributesToDefense = false;

                    const rawDefBonus = (item.data as any).defenseBonus ?? (item.data as any).defense;
                    if (typeof rawDefBonus === "number") {
                        flatDefense += rawDefBonus;
                        contributesToDefense = true;
                    }
                    
                    const rawArmorPct = (item.data as any).armorBonusPercent;
                    if (typeof rawArmorPct === "number") {
                        percentDefense += rawArmorPct / 100;
                        contributesToDefense = true;
                    }

                    // USURE
                    if (contributesToDefense && item.data.durability !== undefined && item.data.durability > 0) {
                        const rarityMultipliers: Record<string, number> = {
                            common: 1.5,
                            uncommon: 1.2,
                            rare: 1.0,
                            epic: 0.7,
                            legendary: 0.3 
                        };
                        const mult = rarityMultipliers[item.rarity?.toLowerCase()] ?? 1.0;
                        const durabilityLoss = Math.max(1, Math.floor((damage * 0.1) * mult));
                        const oldDurability = item.data.durability;

                        item.data.durability = Math.max(0, item.data.durability - durabilityLoss);
                        
                        // Log conservé avec le nom de l'objet et le format demandé
                        const loggerCombat = new Logger({ context: "Durability" });
                        loggerCombat.debug(`${item.name} lost ${oldDurability - item.data.durability} durability (${oldDurability} → ${item.data.durability}).`);

                        if (item.data.durability === 0) {
                            loggerCombat.debug(`${item.name} is completely broken!`);
                        }
                    }
                }
            }
        }

        const calculatedDefense = (baseDefense + flatDefense) * (1 + percentDefense);
        const totalDefense = Math.max(0, Math.floor(calculatedDefense));
        const reducedDamage = Math.max(1, damage - Math.floor(totalDefense / 2));
        
        this.health.current = Math.max(0, this.health.current - reducedDamage);

        // Sauvegarde silencieuse de l'inventaire
        if (this.inventory && typeof this.inventory.save === "function") {
            this.inventory.save(items); 
        }

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
            id: this.id, name: this.name, classId: this.classId, level: this.level, locationId: this.location, gold: this.gold,
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