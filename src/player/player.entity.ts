    import { handlePlayerDeath, DeathResult } from "./Player.death.js";
import { PlayerClass } from "./player.class.js";
import { consola } from "consola";
import { PlayerExperience, PlayerHealth, PlayerAttributes, ClassStats, PlayerSnapshot } from "./player.interface.js";
import { InventoryEntity } from "../inventory/inventory.class.js";
import { EnemyType } from "../enemy/enemy.type.js";
import { ExplorationResult, GainExperienceResult, DamageResult } from "../types/result.js";
import { MoveInCombatError, NoAttributePointsError, PlayerAlreadyTravellingError, UnknownPlayerClassError } from "../types/error.js";
import World from "../world.js";
import PlayerMarriage from "./player.marriage.js";
import EnemyEntity from "../enemy/enemy.class.js";

export type Attribute = "strength" | "agility" | "intelligence" | "defense";

export default class PlayerEntity {
    // Rationale: Rebalanced base values and scaling to prevent excessive health pools and smooth out early-to-mid game progression spikes.
    private static readonly BASE_HEALTH = 85;
    private static readonly HP_PER_LEVEL = 9;
    private static readonly XP_PER_LEVEL = 110;
    private static readonly BASE_TRAVEL_TIME_MS = 1000;
    private static readonly TRAVEL_DISTANCE_MULTIPLIER = 900;
    private static readonly BASE_AMBUSH_CHANCE = 0.10;
    private static readonly DANGER_AMBUSH_MULTIPLIER = 0.035;
    private static readonly MAX_AMBUSH_CHANCE = 0.70;

    // Rationale: Adjusted durability damage multipliers to make equipment wear more predictable and balanced across rarities.
    private static readonly RARITY_MULTIPLIERS: Record<string, number> = {
    common: 1.25,
        uncommon: 1.0,
        rare: 0.75,
        epic: 0.45,
        legendary: 0.20
    };

    public readonly worldInstance: World;
    public level: number;
    public gold: number;
    public experience: PlayerExperience;
    public health: PlayerHealth;
    public attributes: PlayerAttributes;
    public bankGold: number;
    public bankUnlocked: boolean;
    public readonly inventory: InventoryEntity;
    public marriage: PlayerMarriage;
    public isTravelling = false;
    public inCombat = false;
    public isDead = false;
    
    /**
     * Creates a player entity.
     *
     * @param worldInstance The world instance associated with the player.
     * @param id The unique player identifier.
     * @param name The player name.
     * @param classId The player class identifier.
     * @param location The current player location identifier.
     * @param level The initial player level.
     * @param experience The initial experience amount.
     * @param health The initial health amount.
     * @param maxHealth The initial maximum health amount.
     * @param partnerId The partner player identifier, if any.
     * @param strength The initial strength value.
     * @param agility The initial agility value.
     * @param intelligence The initial intelligence value.
     * @param defense The initial defense value.
     * @param attributePoints The initial available attribute points.
     * @param gold The initial gold amount.
     * @param bankGold The initial bank gold amount.
     * @param bankUnlocked Whether the bank account is unlocked.
     * @returns void
     */
    public constructor(
        worldInstance: World,
        public readonly id: string,
        public name: string,
        public readonly classId: PlayerClass,
        public location: string,
        level = 1,
        experience = 0,
        health = PlayerEntity.BASE_HEALTH,
        maxHealth = PlayerEntity.BASE_HEALTH,
        partnerId = "",
        gold = 0,
        strength?: number,
        agility?: number,
        intelligence?: number,
        defense?: number,
        attributePoints = 0,
        bankGold = 0,
        bankUnlocked = false
    ) {
        this.worldInstance = worldInstance;
        this.level = Math.max(1, level);
        this.gold = Math.max(0, gold);
        this.bankGold = Math.max(0, bankGold);
        this.bankUnlocked = bankUnlocked;

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
        this.marriage = new PlayerMarriage(this, partnerId);
        this.updateMaxHealth();
    }

    /**
     * Moves the player to a destination and handles potential ambushes.
     *
     * @param destinationId The destination location identifier.
     * @param distance The travel distance.
     * @param danger The travel danger level.
     * @returns A promise that resolves to the exploration result.
     * @throws PlayerAlreadyTravellingError If the player is already travelling.
     * @throws MoveInCombatError If the player is currently in combat.
     */
    public async moveTo(destinationId: string, distance = 1, danger = 1): Promise<ExplorationResult> {
        this.validateTravelState();
        this.isTravelling = true;

        try {
            const { travelDurationMs, willBeAmbushed } = this.calculateTravelParameters(distance, danger);

            await new Promise<void>(resolve => setTimeout(resolve, travelDurationMs));

            if (willBeAmbushed) {
                return this.handleAmbush(destinationId, travelDurationMs);
            }

            this.location = destinationId;
            consola.success(`Player ${this.name} arrived at ${destinationId}.`);

            return {
                arrived: true,
                attacked: false,
                travelDurationMs,
                locationId: this.location
            };
        } finally {
            this.isTravelling = false;
        }
    }

    /**
     * Adds experience to the player and processes level-ups.
     *
     * @param amount The experience amount to add.
     * @returns The experience gain result.
     */
    public addXP(amount: number): GainExperienceResult {
        if (amount <= 0) {
            consola.warn(`Player ${this.name} received invalid or zero experience amount: ${amount}.`);
            return {
                gainedAmount: 0,
                totalExperience: this.experience.current,
                isLeveledUp: false,
                currentLevel: this.level
            };
        }

        this.experience.current += amount;
        let isLeveledUp = false;

        while (this.experience.current >= this.experience.required) {
            this.experience.current -= this.experience.required;
            this.levelUp();
            isLeveledUp = true;
        }

        return {
            gainedAmount: amount,
            totalExperience: this.experience.current,
            isLeveledUp,
            currentLevel: this.level
        };
    }

    /**
     * Applies damage to the player after calculating equipment and attribute defenses.
     *
     * @param damage The raw incoming damage amount.
     * @returns The damage result, or null if no damage can be applied.
     */
    public takeDamage(damage: number): (DamageResult & { death?: DeathResult }) | null {
        if (damage <= 0 || !this.isAlive()) {
            return null;
        }

        const items = this.inventory.getItems();
        const { flatDefense, percentDefense } = this.processEquipmentStats(items, damage);
        
        const totalDefense = Math.max(0, Math.floor((this.attributes.defense + flatDefense) * (1 + percentDefense)));
        const mitigationFactor = 100 / (100 + totalDefense * 2.5);
        const reducedDamage = Math.max(1, Math.floor(damage * mitigationFactor));

        this.health.current = Math.max(0, this.health.current - reducedDamage);

        let deathResult: DeathResult | null = null;
        
        // 🚨 VÉRIFICATION DE LA MORT (Sécurisé avec <= 0)
        if (this.health.current <= 0) {
            deathResult = handlePlayerDeath(this);
        }

        this.inventory.save(items);

        return {
            reducedDamage,
            currentHealth: this.health.current,
            rawDamage: damage,
            // On inclut les détails de la mort dans le retour si le joueur est mort
            ...(deathResult ? { death: deathResult } : {})
        };
    }

    /**
     * Checks whether the player is alive.
     *
     * @returns True if the player's current health is above zero, false otherwise.
     */
    public isAlive(): boolean {
        return this.health.current > 0;
    }

    /**
     * Allocates an attribute point to the specified attribute.
     *
     * @param attribute The attribute to increase.
     * @returns void
     * @throws NoAttributePointsError If no attribute points are available.
     */
    public levelUpSkill(attribute: Attribute): void {
        if (this.attributes.points <= 0) {
            consola.warn(`Player ${this.name} attempted to upgrade attribute without available points.`);
            throw new NoAttributePointsError();
        }

        this.attributes[attribute]++;
        this.attributes.points--;
        consola.success(`Player ${this.name} upgraded attribute ${attribute}.`);
    }

    /**
     * Creates a serializable snapshot of the player.
     *
     * @returns A player snapshot object.
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
     *
     * @returns void
     */
    public updateMaxHealth(): void {
        const baseMaxHealth = PlayerEntity.BASE_HEALTH + this.level * PlayerEntity.HP_PER_LEVEL;
        const bonusHealth = this.inventory
            .getItems()
            .filter(item => item.isEquipped)
            .reduce((total, item) => total + (typeof item.itemNbtData?.healthBonus === "number" ? item.itemNbtData.healthBonus : 0), 0);

        this.health.max = Math.max(1, baseMaxHealth + bonusHealth);
        this.health.current = Math.min(this.health.current, this.health.max);
    }

    /**
     * Validates if the player can initiate movement.
     */
    private validateTravelState(): void {
        if (this.isTravelling) {
            consola.warn(`Player ${this.name} attempted to move while already travelling.`);
            throw new PlayerAlreadyTravellingError();
        }

        if (this.inCombat) {
            consola.warn(`Player ${this.name} attempted to move while in combat.`);
            throw new MoveInCombatError();
        }
    }

    /**
     * Calculates travel time and ambush status.
     */
    private calculateTravelParameters(distance: number, danger: number): { travelDurationMs: number; willBeAmbushed: boolean } {
        const randomTravelTime = Math.floor(Math.random() * 1500);
        const baseTravelTime = randomTravelTime + PlayerEntity.BASE_TRAVEL_TIME_MS;
        let travelDurationMs = baseTravelTime + distance * PlayerEntity.TRAVEL_DISTANCE_MULTIPLIER;
        
        const ambushChance = Math.min(
            PlayerEntity.BASE_AMBUSH_CHANCE + danger * PlayerEntity.DANGER_AMBUSH_MULTIPLIER,
            PlayerEntity.MAX_AMBUSH_CHANCE
        );
        const willBeAmbushed = Math.random() < ambushChance;

        if (willBeAmbushed) {
            travelDurationMs = Math.floor(travelDurationMs / 2);
        }

        return { travelDurationMs, willBeAmbushed };
    }

    /**
     * Processes equipped item stats and durability changes.
     */
    private processEquipmentStats(items: any[], damage: number): { flatDefense: number; percentDefense: number } {
        let flatDefense = 0;
        let percentDefense = 0;

        for (const item of items) {
            if (!item.isEquipped || !item.data) {
                continue;
            }

            const defenseBonus = item.data.defenseBonus ?? item.data.defense;
            if (typeof defenseBonus === "number") {
                flatDefense += defenseBonus;
            }

            if (typeof item.data.armorBonusPercent === "number") {
                percentDefense += item.data.armorBonusPercent / 100;
            }

            this.processItemDurability(item, damage, defenseBonus);
        }

        return { flatDefense, percentDefense };
    }

    /**
     * Updates an individual item's durability.
     */
    private processItemDurability(item: any, damage: number, defenseBonus: unknown): void {
        const hasDurability = typeof item.data.durability === "number" && item.data.durability > 0;
        const providesDefense = typeof defenseBonus === "number" || typeof item.data.armorBonusPercent === "number";

        if (!hasDurability || !providesDefense) {
            return;
        }

        const rarityKey = item.rarity?.toLowerCase() ?? "";
        const multiplier = PlayerEntity.RARITY_MULTIPLIERS[rarityKey] ?? 1;
        const durabilityLoss = Math.max(1, Math.floor(damage * 0.06 * multiplier));
        
        item.data.durability = Math.max(0, item.data.durability - durabilityLoss);
    }

    /**
     * Handles an ambush encountered during travel.
     *
     * @param destinationId The destination location identifier.
     * @param travelDurationMs The travel time before the ambush.
     * @returns The exploration result containing the spawned enemy.
     */
    private handleAmbush(destinationId: string, travelDurationMs: number): ExplorationResult {
        const isWaterArea = /water|sea|ocean|lake|river|lac|eau/i.test(destinationId);
        const enemyTypes = isWaterArea
            ? [EnemyType.Hydra, EnemyType.GiantRat]
            : [EnemyType.Slime, EnemyType.Goblin, EnemyType.Wolf, EnemyType.Bandit, EnemyType.WildBoar, EnemyType.Skeleton];

        const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        const enemyName = `${enemyType.charAt(0).toUpperCase()}${enemyType.slice(1)}`;
        
        const baseHealth = 30 + this.level * 7;
        const enemyGoldReward = Math.max(2, Math.floor(4 + this.level * 2.5));

        const enemy = new EnemyEntity(
            enemyType,
            enemyName,
            baseHealth,
            baseHealth,
            5 + this.level * 1.2,
            1 + this.level * 0.7,
            8 * this.level,
            enemyGoldReward
        );

        this.worldInstance.combat.startWithEnemy(this, enemy);

        return {
            arrived: false,
            attacked: true,
            travelDurationMs,
            locationId: this.location,
            enemy
        };
    }

    /**
     * Increases the player's level and improves their attributes.
     *
     * @returns void
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
        consola.success(`Player ${this.name} reached level ${this.level}.`);
    }

    /**
     * Generates randomized base attributes according to the player's class.
     *
     * @returns Generated class statistics.
     * @throws UnknownPlayerClassError If the player class is unknown.
     */
    private generateBaseStats(): ClassStats {
        const stats: Record<PlayerClass, ClassStats> = {
            [PlayerClass.Warrior]: { strength: 10, agility: 4, intelligence: 3, defense: 8 },
            [PlayerClass.Explorer]: { strength: 6, agility: 8, intelligence: 6, defense: 5 },
            [PlayerClass.Rogue]: { strength: 5, agility: 10, intelligence: 4, defense: 4 }
        };

        const baseStats = stats[this.classId];
        if (!baseStats) {
            throw new UnknownPlayerClassError(this.classId);
        }

        const randomize = (value: number): number => Math.max(1, Math.round(value * (0.9 + Math.random() * 0.2)));

        return {
            strength: randomize(baseStats.strength),
            agility: randomize(baseStats.agility),
            intelligence: randomize(baseStats.intelligence),
            defense: randomize(baseStats.defense)
        };
    }
}