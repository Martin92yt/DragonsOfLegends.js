    import { handlePlayerDeath, DeathResult } from "./Player.death.js";
import type { PlayerClassId } from "./player.class.js";
import { consola } from "consola";
import { PlayerExperience, PlayerHealth, PlayerAttributes, ClassStats, PlayerSnapshot } from "./player.interface.js";
import { InventoryEntity } from "../inventory/inventory.js";
import type { InventoryItemRecord, ItemNBT } from "../inventory/inventory.interface.js";
import type { AmbushZone, EnemyDefinition } from "../enemy/enemy.definition.js";
import { ExplorationResult, GainExperienceResult, DamageResult } from "../types/result.js";
import { MoveInCombatError, NoAttributePointsError, PlayerAlreadyTravellingError, UnknownLocationError } from "../types/error.js";
import { LocationFlags, hasFlag } from "../location/location.flags.js";
import World from "../world.js";
import PlayerMarriage from "./player.marriage.js";
import PlayerTitles from "./player.titles.js";
import PlayerBestiary from "./player.bestiary.js";
import PlayerJobs from "./player.jobs.js";
import PlayerLife from "./player.life.js";
import PlayerEffects from "./player.effects.js";
import { readAmuletModifiers } from "../inventory/amulet.js";
import { resolvePlayerModifiers, scaleExperience, type PlayerModifiers } from "./player.modifiers.js";
import ItemBank from "../economy/item-bank.js";
import EnemyEntity from "../enemy/enemy.js";
import type Combat from "../combat/combat.js";

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
    private goldBalance: number;
    public experience: PlayerExperience;
    public health: PlayerHealth;
    public attributes: PlayerAttributes;
    public bankGold: number;
    public bankUnlocked: boolean;
    public readonly inventory: InventoryEntity;
    public marriage: PlayerMarriage;
    public readonly titles: PlayerTitles;
    public readonly itemBank: ItemBank;
    public readonly bestiary: PlayerBestiary;
    public readonly jobs: PlayerJobs;
    public isTravelling = false;
    public inCombat = false;
    /** Life state: the single source of truth for whether the player can act (see {@link PlayerEntity.assertCanAct}). */
    public readonly life: PlayerLife;
    /** Temporary effects (potions, buffs, damage or heal over time). */
    public readonly effects: PlayerEffects;
    
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
     * @param titles The identifiers of the owned titles.
     * @param equippedTitleId The identifier of the equipped title, or an empty string.
     * @param bestiaryState The saved bestiary state (validated).
     * @param jobsState The saved jobs state (validated).
     * @param deadUntil The persisted respawn timestamp (ms), or null if the player is alive.
     * @param effectsState The saved effects state (validated).
     * @returns void
     */
    public constructor(
        worldInstance: World,
        public readonly id: string,
        public name: string,
        public readonly classId: PlayerClassId,
        public location: string,
        level = 1,
        experience = 0,
        health = PlayerEntity.BASE_HEALTH,
        maxHealth = PlayerEntity.BASE_HEALTH,
        partnerId = "",
        gold = 0,
        bankGold = 0,
        bankUnlocked = false,
        strength?: number,
        agility?: number,
        intelligence?: number,
        defense?: number,
        attributePoints = 0,
        titles: readonly string[] = [],
        equippedTitleId = "",
        bestiaryState: unknown = {},
        jobsState: unknown = {},
        deadUntil: number | null = null,
        effectsState: unknown = {}
    ) {
        this.worldInstance = worldInstance;
        this.level = Math.max(1, level);
        this.goldBalance = Math.max(0, gold);
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
        this.titles = new PlayerTitles(this, titles, equippedTitleId);
        this.itemBank = new ItemBank(this);
        this.bestiary = new PlayerBestiary(bestiaryState, worldInstance.enemies);
        this.jobs = new PlayerJobs(this, jobsState);
        this.life = new PlayerLife(this, deadUntil);
        this.effects = new PlayerEffects(this, effectsState);
        this.updateMaxHealth();
    }

    /**
     * Gold carried by the player (the wallet).
     */
    public get gold(): number {
        return this.goldBalance;
    }

    /**
     * Sets the wallet and emits `playerGoldChange` when the value changes.
     *
     * The setter cannot be awaited, so the event is emitted fire-and-forget: asynchronous listeners are not awaited.
     */
    public set gold(value: number) {
        const previous = this.goldBalance;
        if (value === previous) return;
        this.goldBalance = value;
        this.worldInstance.events.emit("playerGoldChange", {
            playerId: this.id,
            player: this,
            previous,
            current: value,
            delta: value - previous
        });
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
     * @throws PlayerDeadError If the player is dead.
     */
    public async moveTo(destinationId: string, distance = 1, danger = 1): Promise<ExplorationResult> {
        this.assertCanAct("player.moveTo");
        this.validateTravelState();
        if (!this.worldInstance.location.has(destinationId)) {
            throw new UnknownLocationError(destinationId);
        }
        this.isTravelling = true;

        try {
            const { travelDurationMs, willBeAmbushed } = this.calculateTravelParameters(distance, danger);
            const originId = this.location;
            const { events } = this.worldInstance;

            // Fire-and-forget on purpose: the travel timer must be armed in the same tick as the call.
            events.emit("travelStart", {
                playerId: this.id,
                player: this,
                fromId: originId,
                toId: destinationId,
                distance,
                danger,
                durationMs: travelDurationMs
            });
            await new Promise<void>(resolve => setTimeout(resolve, travelDurationMs));

            if (willBeAmbushed) {
                const ambush = this.handleAmbush(destinationId, travelDurationMs);
                if (ambush) {
                    await events.emitAsync("travelAmbush", {
                        playerId: this.id,
                        player: this,
                        fromId: originId,
                        toId: destinationId,
                        enemy: ambush.enemy,
                        combat: ambush.combat
                    });
                    return ambush.exploration;
                }
            }

            this.location = destinationId;
            consola.success(`Player ${this.name} arrived at ${destinationId}.`);
            await events.emitAsync("travelComplete", {
                playerId: this.id,
                player: this,
                fromId: originId,
                toId: destinationId,
                distance,
                durationMs: travelDurationMs
            });

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
        let levelsGained = 0;

        while (this.experience.current >= this.experience.required) {
            this.experience.current -= this.experience.required;
            this.levelUp();
            isLeveledUp = true;
            levelsGained++;
        }

        // Fire-and-forget: addXP is synchronous, so asynchronous listeners are not awaited.
        this.worldInstance.events.emit("playerExperienceGain", {
            playerId: this.id,
            player: this,
            amount,
            experience: this.experience.current,
            required: this.experience.required,
            levelsGained
        });

        return {
            gainedAmount: amount,
            totalExperience: this.experience.current,
            isLeveledUp,
            currentLevel: this.level
        };
    }

    /**
     * Adds experience boosted by the amulets and the active effects (see {@link PlayerEntity.getModifiers}).
     * Use it for gameplay rewards; `addXP` adds the exact amount.
     *
     * @param baseAmount The experience before the bonuses.
     * @returns The experience gain result (`gainedAmount` is the boosted amount).
     */
    public async gainXP(baseAmount: number): Promise<GainExperienceResult> {
        const { xpMultiplier } = await this.getModifiers();
        return this.addXP(scaleExperience(baseAmount, xpMultiplier));
    }

    /**
     * Applies damage to the player after calculating equipment and attribute defenses.
     *
     * @param damage The raw incoming damage amount.
     * @returns The damage result, or null if no damage can be applied.
     */
    public async takeDamage(damage: number): Promise<(DamageResult & { death?: DeathResult }) | null> {
        if (damage <= 0 || !this.isAlive()) {
            return null;
        }

        // 1. Ajouter 'await' ici
        const items = await this.inventory.getItems();
        const { flatDefense, percentDefense } = this.processEquipmentStats(items, damage);
        
        const totalDefense = Math.max(0, Math.floor((this.attributes.defense + flatDefense) * (1 + percentDefense)));
        const mitigationFactor = 100 / (100 + totalDefense * 2.5);
        const reducedDamage = Math.max(1, Math.floor(damage * mitigationFactor));

        this.health.current = Math.max(0, this.health.current - reducedDamage);
        await this.worldInstance.events.emitAsync("playerDamage", {
            playerId: this.id,
            player: this,
            rawDamage: damage,
            damage: reducedDamage,
            health: this.health.current,
            maxHealth: this.health.max
        });

        let deathResult: DeathResult | null = null;
        
        // 🚨 VÉRIFICATION DE LA MORT (Sécurisé avec <= 0)
        if (this.health.current <= 0) {
            deathResult = await handlePlayerDeath(this);
        }

        // 2. Ne pas réécrire l'instantané `items` après une mort : il écraserait la perte d'objets déjà persistée
        if (!deathResult) {
            await this.inventory.save(items);
        }

        return {
            reducedDamage,
            currentHealth: this.health.current,
            rawDamage: damage,
            // On inclut les détails de la mort dans le retour si le joueur est mort
            ...(deathResult ? { death: deathResult } : {})
        };
    }

    /**
     * Whether the player is dead (respawn cooldown running, or permanently dead). An elapsed cooldown revives the player.
     */
    public get isDead(): boolean {
        return this.life.isDead;
    }

    /**
     * Strict gate of every player action: refuses the action of a dead player.
     * It is called first in each action (move, combat, inventory, bank, jobs, marriage, titles...).
     *
     * @param action The name of the action, reported in the error (e.g. `combat.attack`).
     * @returns void
     * @throws {PlayerDeadError} If the player is dead, with the time left before the respawn.
     */
    public assertCanAct(action: string): void {
        this.life.assertCanAct(action);
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
     * Restores health, capped at the maximum health. A dead player cannot be healed (see `life.revive`).
     *
     * @param amount The health points to restore (> 0).
     * @param source Where the healing comes from (`item:<id>`, `effect:<id>`...), reported by the `playerHeal` event.
     * @returns The health points actually restored (0 when the amount is invalid, the player is dead or already at full health).
     */
    public heal(amount: number, source?: string): number {
        if (!(amount > 0) || this.isDead) {
            return 0;
        }

        const previousHealth = this.health.current;
        this.health.current = Math.min(this.health.max, previousHealth + amount);
        const healed = this.health.current - previousHealth;
        if (healed > 0) {
            // Fire-and-forget: heal is synchronous, so asynchronous listeners are not awaited.
            this.worldInstance.events.emit("playerHeal", {
                playerId: this.id,
                player: this,
                amount,
                healed,
                health: this.health.current,
                maxHealth: this.health.max,
                ...(source !== undefined ? { source } : {})
            });
        }
        return healed;
    }

    /**
     * Computes the passive modifiers of the player: worn amulets combined with active effects.
     *
     * @returns The experience multiplier, the loot luck and the critical-hit bonus.
     */
    public async getModifiers(): Promise<PlayerModifiers> {
        return resolvePlayerModifiers(readAmuletModifiers(await this.inventory.getItems()), this.effects.getModifiers());
    }

    /**
     * Allocates an attribute point to the specified attribute.
     *
     * @param attribute The attribute to increase.
     * @returns void
     * @throws NoAttributePointsError If no attribute points are available.
     */
    public levelUpSkill(attribute: Attribute): void {
        this.assertCanAct("player.levelUpSkill");
        if (this.attributes.points <= 0) {
            consola.warn(`Player ${this.name} attempted to upgrade attribute without available points.`);
            throw new NoAttributePointsError();
        }

        this.attributes[attribute]++;
        this.attributes.points--;
        this.worldInstance.events.emit("playerAttributeUpgrade", {
            playerId: this.id,
            player: this,
            attribute,
            value: this.attributes[attribute],
            remainingPoints: this.attributes.points
        });
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
            attributes: { ...this.attributes },
            title: this.titles.getEquipped() ?? null
        };
    }

    /**
     * Updates the player's maximum health based on level and equipment.
     *
     * @returns void
     */
    public async updateMaxHealth(): Promise<void> {
        const baseMaxHealth = PlayerEntity.BASE_HEALTH + this.level * PlayerEntity.HP_PER_LEVEL;
        
        // Ajout du 'await' ici pour récupérer les items de l'inventaire
        const items = await this.inventory.getItems();
        const bonusHealth = items
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
    private processEquipmentStats(items: InventoryItemRecord[], damage: number): { flatDefense: number; percentDefense: number } {
        let flatDefense = 0;
        let percentDefense = 0;

        for (const item of items) {
            // Rationale: the item data lives in `itemNbtData`; a broken piece (durability 0) protects no more.
            const data = item.itemNbtData;
            if (!item.isEquipped || !data) {
                continue;
            }
            if (typeof data.durability === "number" && data.durability <= 0) {
                continue;
            }

            const defenseBonus = data.defenseBonus ?? data["defense"];
            if (typeof defenseBonus === "number") {
                flatDefense += defenseBonus;
            }

            const armorBonusPercent = data["armorBonusPercent"];
            if (typeof armorBonusPercent === "number") {
                percentDefense += armorBonusPercent / 100;
            }

            this.processItemDurability(item, data, damage, typeof defenseBonus === "number" || typeof armorBonusPercent === "number");
        }

        return { flatDefense, percentDefense };
    }

    /**
     * Wears an individual item down (the inventory snapshot is saved by the caller).
     */
    private processItemDurability(item: InventoryItemRecord, data: ItemNBT, damage: number, providesDefense: boolean): void {
        if (typeof data.durability !== "number" || data.durability <= 0 || !providesDefense) {
            return;
        }

        const multiplier = PlayerEntity.RARITY_MULTIPLIERS[String(item.rarity).toLowerCase()] ?? 1;
        const durabilityLoss = Math.max(1, Math.floor(damage * 0.06 * multiplier));

        data.durability = Math.max(0, data.durability - durabilityLoss);
    }

    /**
     * Picks the enemy of an ambush among the registered enemies able to ambush in a zone.
     *
     * @param zone The zone of the destination.
     * @returns The picked species, or undefined if none is registered for the zone.
     */
    private pickAmbusher(zone: AmbushZone): Readonly<EnemyDefinition> | undefined {
        const candidates = this.worldInstance.enemies.listAmbushers(zone);
        const weightOf = (definition: Readonly<EnemyDefinition>): number => definition.ambush?.[zone]?.weight ?? 1;
        const total = candidates.reduce((sum, definition) => sum + weightOf(definition), 0);

        let threshold = Math.random() * total;
        for (const candidate of candidates) {
            threshold -= weightOf(candidate);
            if (threshold < 0) return candidate;
        }
        return candidates[candidates.length - 1];
    }

    /**
     * Handles an ambush encountered during travel.
     *
     * @param destinationId The destination location identifier.
     * @param travelDurationMs The travel time before the ambush.
     * @returns The exploration result containing the spawned enemy, or undefined when no registered enemy can
     * ambush in the zone (the player then arrives safely).
     */
    private handleAmbush(destinationId: string, travelDurationMs: number): { exploration: ExplorationResult; combat: Combat; enemy: EnemyEntity } | undefined {
        // Rationale: the zone comes from the OnWater flag of the map, not from a guess on the name ("Palace" contains "lac").
        const destination = this.worldInstance.location.get(destinationId);
        const isWaterArea = destination !== undefined && hasFlag(destination.locationFlags, LocationFlags.OnWater);
        const ambusher = this.pickAmbusher(isWaterArea ? "water" : "land");
        if (!ambusher) return undefined;

        const enemyType = ambusher.id;
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
            enemyGoldReward,
            ambusher.loot ?? [],
            ambusher.tier
        );

        const combat = this.worldInstance.combat.startWithEnemy(this, enemy);

        return {
            exploration: {
                arrived: false,
                attacked: true,
                travelDurationMs,
                locationId: this.location,
                enemy
            },
            combat,
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
        // Rationale: raise the maximum right away, then re-read the equipment bonuses; the player ends at the new maximum.
        this.health.max += PlayerEntity.HP_PER_LEVEL;
        this.health.current = this.health.max;
        void this.updateMaxHealth()
            .then(() => {
                this.health.current = this.health.max;
            })
            .catch((error: unknown) => consola.error(`Failed to refresh the maximum health of ${this.id}.`, error));
        this.attributes.strength++;
        this.attributes.agility++;
        this.attributes.intelligence++;
        this.attributes.defense++;
        this.attributes.points++;
        this.experience.required = this.level * PlayerEntity.XP_PER_LEVEL;
        consola.success(`Player ${this.name} reached level ${this.level}.`);
        this.worldInstance.events.emit("playerLevelUp", {
            playerId: this.id,
            player: this,
            previousLevel: this.level - 1,
            level: this.level,
            attributePoints: this.attributes.points
        });
    }

    /**
     * Generates randomized base attributes according to the player's class.
     *
     * @returns Generated class statistics.
     * @throws UnknownPlayerClassError If the player class is unknown.
     */
    private generateBaseStats(): ClassStats {
        // Throws UnknownPlayerClassError when the class is not registered in the world.
        const { baseStats } = this.worldInstance.classes.require(this.classId);

        const randomize = (value: number): number => Math.max(1, Math.round(value * (0.9 + Math.random() * 0.2)));

        return {
            strength: randomize(baseStats.strength),
            agility: randomize(baseStats.agility),
            intelligence: randomize(baseStats.intelligence),
            defense: randomize(baseStats.defense)
        };
    }
}