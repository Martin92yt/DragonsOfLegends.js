import { PlayerClass } from "./player.class.js";
import { Logger } from "../utils/logger.js";
import { PlayerExperience, PlayerHealth, PlayerAttributes, ClassStats, PlayerSnapshot } from "./player.interface.js";
import { InventoryEntity } from "../inventory/inventory.entity.js";
import EnemyEntity from "../enemy/enemy.entity.js";
import { EnemyType } from "../enemy/enemy.type.js";
import { ExplorationResult, GainExperienceResult, DamageResult } from "../types/result.js";
import { MoveInCombatError, NoAttributePointsError, PlayerAlreadyTravellingError, UnknownPlayerClassError } from "../types/error.js";
import World from "../world.js";
import PlayerMarriage from "./player.marriage.js";

export type Attribute = "strength" | "agility" | "intelligence" | "defense";

export default class PlayerEntity {
    private static readonly BASE_HEALTH = 100;
    private static readonly HP_PER_LEVEL = 10;
    private static readonly XP_PER_LEVEL = 100;
    private static readonly BASE_TRAVEL_TIME_MS = 1000;
    private static readonly TRAVEL_DISTANCE_MULTIPLIER = 1000;
    private static readonly BASE_AMBUSH_CHANCE = 0.15;
    private static readonly DANGER_AMBUSH_MULTIPLIER = 0.05;
    private static readonly MAX_AMBUSH_CHANCE = 0.9;
    readonly #logger = new Logger({ context: "Player" });
    private readonly rpg: World;
    public level: number;
    public gold: number;
    public experience: PlayerExperience;
    public health: PlayerHealth;
    public attributes: PlayerAttributes;
    public readonly inventory: InventoryEntity;
    public marriage: PlayerMarriage;
    public isTravelling = false;
    public inCombat = false;

    /**
     * Creates a player entity.
     *
     * @param rpg World instance.
     * @param id Player identifier.
     * @param name Player name.
     * @param classId Player class.
     * @param location Player location identifier.
     * @param level Initial player level.
     * @param experience Initial experience amount.
     * @param health Initial health amount.
     * @param maxHealth Initial maximum health.
     * @param partener Partner player identifier.
     * @param strength Initial strength value.
     * @param agility Initial agility value.
     * @param intelligence Initial intelligence value.
     * @param defense Initial defense value.
     * @param attributePoints Initial available attribute points.
     * @param gold Initial gold amount.
     */
    public constructor(
        rpg: World,
        public readonly id: string,
        public name: string,
        public readonly classId: PlayerClass,
        public location: string,
        level = 1,
        experience = 0,
        health = PlayerEntity.BASE_HEALTH,
        maxHealth = PlayerEntity.BASE_HEALTH,
        partener = "",
        strength?: number,
        agility?: number,
        intelligence?: number,
        defense?: number,
        attributePoints = 0,
        gold = 0
    ) {
        this.rpg = rpg;
        this.level = Math.max(1, level);
        this.gold = Math.max(0, gold);

        const baseStats = this.generateBaseStats();

        this.experience = {
            current: Math.max(0, experience),
            required: this.level * PlayerEntity.XP_PER_LEVEL
        };

        this.health = {
            current: Math.max(0, Math.min(health, maxHealth)),
            max: Math.max(1, maxHealth)
        };

        this.attributes = {
            points: Math.max(0, attributePoints),
            strength: strength ?? baseStats.strength,
            agility: agility ?? baseStats.agility,
            intelligence: intelligence ?? baseStats.intelligence,
            defense: defense ?? baseStats.defense
        };

        this.inventory = new InventoryEntity(this.id, this);
        this.marriage = new PlayerMarriage(this, partener);
        this.updateMaxHealth();
        this.#logger.debug(`Player entity initialized for ${this.name} (ID: ${this.id}).`);
    }

    /**
     * Moves the player to a destination and handles potential ambushes.
     *
     * @param destinationId Destination location identifier.
     * @param distance Travel distance.
     * @param danger Travel danger level.
     * @returns The result of the exploration.
     * @throws PlayerAlreadyTravellingError If the player is already travelling.
     * @throws MoveInCombatError If the player is currently in combat.
     */
    public async moveTo(destinationId: string, distance = 1, danger = 1): Promise<ExplorationResult> {
        if (this.isTravelling) {
            throw new PlayerAlreadyTravellingError();
        }

        if (this.inCombat) {
            throw new MoveInCombatError();
        }

        this.isTravelling = true;
        this.#logger.debug(`${this.name} travelling to ${destinationId} (distance: ${distance}, danger: ${danger}).`);

        try {
            const randomTravelTime = Math.floor(Math.random() * 2001);
            const baseTravelTime = randomTravelTime + PlayerEntity.BASE_TRAVEL_TIME_MS;
            let travelTimeMs = baseTravelTime + distance * PlayerEntity.TRAVEL_DISTANCE_MULTIPLIER;
            const ambushChance = Math.min(
                PlayerEntity.BASE_AMBUSH_CHANCE + danger * PlayerEntity.DANGER_AMBUSH_MULTIPLIER,
                PlayerEntity.MAX_AMBUSH_CHANCE
            );
            const willBeAmbushed = Math.random() < ambushChance;

            if (willBeAmbushed) {
                travelTimeMs = Math.floor(travelTimeMs / 2.1);
            }

            await new Promise<void>((resolve) => setTimeout(resolve, travelTimeMs));

            if (willBeAmbushed) {
                return this.handleAmbush(destinationId, travelTimeMs);
            }

            this.location = destinationId;
            this.#logger.debug(`${this.name} arrived at ${destinationId} in ${travelTimeMs}ms.`);

            return {
                arrived: true,
                attacked: false,
                travelTimeMs,
                locationId: this.location
            };
        } finally {
            this.isTravelling = false;
        }
    }

    /**
     * Adds experience to the player and processes level-ups.
     *
     * @param amount Experience amount to add.
     * @returns The experience gain result.
     */
    public addXP(amount: number): GainExperienceResult {
        if (amount <= 0) {
            return {
                amount: 0,
                total: this.experience.current,
                leveledUp: false,
                level: this.level
            };
        }

        const previousExperience = this.experience.current;
        const totalExperience = previousExperience + amount;

        this.experience.current = totalExperience;

        let leveledUp = false;

        while (this.experience.current >= this.experience.required) {
            this.experience.current -= this.experience.required;
            this.levelUp();
            leveledUp = true;
        }

        if (leveledUp) {
            this.#logger.info(`${this.name} gained ${amount} XP (${previousExperience} → ${totalExperience}), Level ${this.level}.`);
        } else {
            this.#logger.info(`${this.name} gained ${amount} XP (${previousExperience} → ${totalExperience} / ${this.experience.required}).`);
        }

        return {
            amount,
            total: this.experience.current,
            leveledUp,
            level: this.level
        };
    }

    /**
     * Applies damage to the player after calculating equipment and attribute defenses.
     *
     * @param damage Raw incoming damage.
     * @returns The damage result, or null if no damage can be applied.
     */
    public takeDamage(damage: number): DamageResult | null {
        if (damage <= 0 || !this.isAlive()) {
            return null;
        }

        let flatDefense = 0;
        let percentDefense = 0;
        const items = this.inventory.getItems();

        for (const item of items.filter((item) => item.isEquipped)) {
            if (!item.data) {
                continue;
            }

            const defenseBonus = item.data.defenseBonus ?? item.data.defense;

            if (typeof defenseBonus === "number") {
                flatDefense += defenseBonus;
            }

            if (typeof item.data.armorBonusPercent === "number") {
                percentDefense += item.data.armorBonusPercent / 100;
            }

            if (typeof item.data.durability === "number" && item.data.durability > 0 && (typeof defenseBonus === "number" || typeof item.data.armorBonusPercent === "number")) {
                const rarityMultipliers: Record<string, number> = {
                    common: 1.5,
                    uncommon: 1.2,
                    rare: 1,
                    epic: 0.7,
                    legendary: 0.3
                };

                const multiplier = rarityMultipliers[item.rarity?.toLowerCase() ?? ""] ?? 1;
                const durabilityLoss = Math.max(1, Math.floor(damage * 0.1 * multiplier));
                const previousDurability = item.data.durability;

                item.data.durability = Math.max(0, previousDurability - durabilityLoss);

                this.#logger.debug(
                    `${item.name} lost ${previousDurability - item.data.durability} durability (${previousDurability} → ${item.data.durability}).`
                );

                if (item.data.durability === 0) {
                    this.#logger.debug(`${item.name} is completely broken!`);
                }
            }
        }

        const totalDefense = Math.max(0, Math.floor((this.attributes.defense + flatDefense) * (1 + percentDefense)));
        const reducedDamage = Math.max(1, damage - Math.floor(totalDefense / 2));

        this.health.current = Math.max(0, this.health.current - reducedDamage);
        this.inventory.save(items);

        return {
            reducedDamage,
            currentHealth: this.health.current,
            rawDamage: damage
        };
    }

    /**
     * Checks whether the player is alive.
     *
     * @returns True if the player's current health is above zero.
     */
    public isAlive(): boolean {
        return this.health.current > 0;
    }

    /**
     * Allocates an attribute point to the specified attribute.
     *
     * @param attribute Attribute to increase.
     * @throws NoAttributePointsError If no attribute points are available.
     */
    public levelUpSkill(attribute: Attribute): void {
        if (this.attributes.points <= 0) {
            throw new NoAttributePointsError();
        }

        this.attributes[attribute]++;
        this.attributes.points--;
        this.#logger.info(`Player ${this.name} allocated a point to ${attribute} (New value: ${this.attributes[attribute]}).`);
    }

    /**
     * Creates a serializable snapshot of the player.
     *
     * @returns A player snapshot.
     */
    public toJSON(): PlayerSnapshot {
        return {
            id: this.id,
            name: this.name,
            classId: this.classId,
            level: this.level,
            locationId: this.location,
            gold: this.gold,
            experience: { ...this.experience },
            health: { ...this.health },
            attributes: { ...this.attributes }
        };
    }

    /**
     * Updates the player's maximum health based on level and equipment.
     */
    public updateMaxHealth(): void {
        const baseMaxHealth = PlayerEntity.BASE_HEALTH + this.level * PlayerEntity.HP_PER_LEVEL;
        const bonusHealth = this.inventory
            .getItems()
            .filter((item) => item.isEquipped)
            .reduce((total, item) => {
                return total + (typeof item.data?.healthBonus === "number" ? item.data.healthBonus : 0);
            }, 0);

        this.health.max = Math.max(1, baseMaxHealth + bonusHealth);
        this.health.current = Math.min(this.health.current, this.health.max);
    }

    /**
     * Handles an ambush encountered during travel.
     *
     * @param destinationId Destination location identifier.
     * @param travelTimeMs Travel time before the ambush.
     * @returns The exploration result containing the enemy.
     */
    private handleAmbush(destinationId: string, travelTimeMs: number): ExplorationResult {
        this.#logger.info(`${this.name} was ambushed on the road to ${destinationId}.`);

        const isWaterArea = /water|sea|ocean|lake|river|lac|eau/i.test(destinationId);
        const enemyTypes = isWaterArea
            ? [EnemyType.Hydra, EnemyType.GiantRat]
            : [EnemyType.Slime, EnemyType.Goblin, EnemyType.Wolf, EnemyType.Bandit, EnemyType.WildBoar, EnemyType.Skeleton];

        const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        const enemyName = `${enemyType.charAt(0).toUpperCase()}${enemyType.slice(1)}`;
        const baseHealth = 30 + this.level * 10;

        const enemy = new EnemyEntity(
            enemyType,
            enemyName,
            baseHealth,
            baseHealth,
            5 + this.level * 2,
            2 + this.level,
            15 * this.level,
            10 * this.gold
        );

        this.rpg.combat.startWithEnemy(this, enemy);

        return {
            arrived: false,
            attacked: true,
            travelTimeMs,
            locationId: this.location,
            enemy
        };
    }

    /**
     * Increases the player's level and improves their attributes.
     */
    private levelUp(): void {
        this.level++;
        this.updateMaxHealth();
        this.health.current = this.health.max;
        this.attributes.strength++;
        this.attributes.agility++;
        this.attributes.intelligence++;
        this.attributes.defense++;
        this.attributes.points++;
        this.experience.required = this.level * PlayerEntity.XP_PER_LEVEL;
        this.#logger.info(`${this.name} reached level ${this.level}!`);
    }

    /**
     * Generates randomized base attributes according to the player's class.
     *
     * @returns Generated class statistics.
     * @throws UnknownPlayerClassError If the player class is unknown.
     */
    private generateBaseStats(): ClassStats {
        const stats: Record<PlayerClass, ClassStats> = {
            [PlayerClass.Warrior]: {
                strength: 10,
                agility: 5,
                intelligence: 3,
                defense: 10
            },
            [PlayerClass.Explorer]: {
                strength: 6,
                agility: 10,
                intelligence: 6,
                defense: 5
            },
            [PlayerClass.Mage]: {
                strength: 3,
                agility: 5,
                intelligence: 12,
                defense: 4
            }
        };

        const baseStats = stats[this.classId];

        if (!baseStats) {
            throw new UnknownPlayerClassError(this.classId);
        }

        const randomize = (value: number): number => {
            return Math.max(1, Math.round(value * (0.8 + Math.random() * 0.4)));
        };

        return {
            strength: randomize(baseStats.strength),
            agility: randomize(baseStats.agility),
            intelligence: randomize(baseStats.intelligence),
            defense: randomize(baseStats.defense)
        };
    }
}
