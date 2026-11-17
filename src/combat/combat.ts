import PlayerEntity from "../player/player.entity.js";
import EnemyEntity from "../enemy/enemy.js";
import { CombatResult } from "../types/result.js";
import { ItemCategory } from "../inventory/item.enum.js";
import { ItemNBT, InventoryItemRecord } from "../inventory/inventory.interface.js";
import { PHYSICAL, criticalMultiplier, criticalRate, variance } from "../balance/formulas.js";
import { createLogger } from "../utils/logger.js";
const log = createLogger("combat");


interface ItemDamageBonuses {
    flatBonus: number;
    percentageBonus: number;
    critRateBonus: number;
    /** Added to the critical multiplier (`critDamageBonus`). */
    critDamageBonus: number;
    /** Armor penetration in percent (`armorPenetration`). */
    armorPenetration: number;
    /** Damage type of the weapon (`damageType`), when it sets one. */
    damageType?: string;
    contributesToAttack: boolean;
}

/** A blow of the player, ready to be applied to the enemy. */
interface PlayerBlow {
    damage: number;
    damageType: string;
    armorPenetration: number;
    critical: boolean;
}

export default class Combat {

    private static readonly RARITY_DURABILITY_MULTIPLIERS: Readonly<Record<string, number>> = {
        common: 1.4,
        uncommon: 1.1,
        rare: 1.0,
        epic: 0.65,
        legendary: 0.35
    };

    public constructor(public readonly playerEntity: PlayerEntity, public readonly enemyEntity: EnemyEntity) {}

    /**
     * Executes one combat turn.
     */
    public async attack(): Promise<CombatResult> {
        this.playerEntity.assertCanAct("combat.attack");
        const inflictedEnemyDamage = await this.executePlayerTurn();

        const result = this.enemyEntity.isAlive()
            ? await this.executeEnemyTurn(inflictedEnemyDamage)
            : await this.handleEnemyDefeat(inflictedEnemyDamage);

        await this.playerEntity.worldInstance.events.emitAsync("combatTurn", {
            playerId: this.playerEntity.id,
            player: this.playerEntity,
            combat: this,
            enemy: this.enemyEntity,
            result
        });
        return result;
    }

    /**
     * Executes the player's attack action.
     */
    private async executePlayerTurn(): Promise<number> {
        // Rationale: the loot of an enemy is rolled when it dies, so the luck of the killer must be known before the blow.
        this.enemyEntity.dropLuckPercent = (await this.playerEntity.getModifiers()).luckPercent;
        const blow = await this.getPlayerDamage();
        const inflicted = this.enemyEntity.takeDamage(blow.damage, {
            damageType: blow.damageType,
            armorPenetration: blow.armorPenetration,
            balance: this.playerEntity.worldInstance.balance
        });
        // Enchantments of the worn equipment (e.g. Lifesteal) react to the blow before the enemy answers.
        await this.playerEntity.worldInstance.enchanting.runAttackHooks(this.playerEntity, this.enemyEntity, inflicted);
        return inflicted;
    }

    /**
     * Handles rewards and state when the enemy is defeated.
     */
    private async handleEnemyDefeat(inflictedEnemyDamage: number): Promise<CombatResult> {
        // Amulets and potions boost the experience (the event below reports the experience actually gained).
        const { gainedAmount: experience } = await this.playerEntity.gainXP(this.enemyEntity.experience);
        this.playerEntity.gold += this.enemyEntity.gold;
        log.success(`${this.playerEntity.name} defeated ${this.enemyEntity.name}.`);
        await this.collectLoot();

        // Listeners (bestiary, achievements...) are awaited so their effects are visible when the result is returned.
        await this.playerEntity.worldInstance.events.emitAsync("enemyDefeat", {
            playerId: this.playerEntity.id,
            player: this.playerEntity,
            combat: this,
            enemy: this.enemyEntity,
            // Rationale: the identifier of the species (registry id), not the display name ("★ Goblin (Elite)").
            enemyId: this.enemyEntity.type,
            enemyType: this.enemyEntity.type,
            tier: this.enemyEntity.tier,
            locationId: this.playerEntity.location,
            experience,
            gold: this.enemyEntity.gold
        });

        return {
            playerDamage: 0,
            enemyDamage: inflictedEnemyDamage,
            enemyHealth: 0,
            victory: true,
            defeat: false,
            enemy: this.enemyEntity
        };
    }

    /**
     * Hands the loot rolled on the enemy over to the winner.
     * A failure on one item is logged and never cancels the victory.
     */
    private async collectLoot(): Promise<void> {
        for (const drop of this.enemyEntity.droppedLootList) {
            try {
                await this.playerEntity.inventory.add(drop.loot, drop.quantity);
            } catch (error) {
                log.error(`Failed to give ${drop.quantity}x ${drop.loot.itemId} to ${this.playerEntity.name}.`, error);
            }
        }
    }

    /**
     * Executes the enemy's counter-attack action.
     */
    private async executeEnemyTurn(inflictedEnemyDamage: number): Promise<CombatResult> {
        const balance = this.playerEntity.worldInstance.balance;
        // An enemy attack varies a little and can be critical; the player may dodge it (see PlayerEntity.takeDamage).
        const enemyCritical = Math.random() < balance.enemyAttack.criticalRate;
        const rawEnemyAttackDamage = Math.max(
            1,
            Math.floor(this.enemyEntity.strength * variance(balance.enemyAttack.varianceMin, balance.enemyAttack.varianceMax) * (enemyCritical ? balance.enemyAttack.criticalMultiplier : 1))
        );

        const playerDamageReductionResult = await this.playerEntity.takeDamage(rawEnemyAttackDamage, { damageType: this.enemyEntity.damageType, dodgeable: true });
        const finalPlayerDamageTaken = playerDamageReductionResult?.reducedDamage ?? rawEnemyAttackDamage;
        const isPlayerDefeated = !this.playerEntity.isAlive();

        if (isPlayerDefeated) {
            log.success(`${this.playerEntity.name} was defeated by ${this.enemyEntity.name}.`);
        }

        return {
            playerDamage: finalPlayerDamageTaken,
            enemyDamage: inflictedEnemyDamage,
            enemyHealth: this.enemyEntity.health,
            victory: false,
            defeat: isPlayerDefeated,
            enemy: this.enemyEntity
        };
    }

    /**
     * Calculates the damage dealt by the player.
     */
    private async getPlayerDamage(): Promise<PlayerBlow> {
        const balance = this.playerEntity.worldInstance.balance;
        const basePlayerAttackStat = this.getPlayerAttackStat();

        const equippedInventoryItems = await this.playerEntity.inventory?.getItems() ?? [];
        const bonuses = this.aggregateItemBonuses(equippedInventoryItems);
        const passives = this.playerEntity.getClassPassives();

        // (attack stat + flat bonuses) x (1 + item %) x (1 + class %) x random variance.
        let damage = (basePlayerAttackStat + bonuses.flatBonus) * (1 + bonuses.percentageBonus) * (1 + passives.damagePercent / 100);
        damage *= variance(balance.damage.varianceMin, balance.damage.varianceMax);

        if (equippedInventoryItems.length > 0) {
            await this.playerEntity.inventory?.save(equippedInventoryItems);
        }

        // Rationale: worn amulets are already counted in the item bonuses; only the temporary effects are added here.
        const critical = Math.random() < criticalRate(
            balance,
            this.playerEntity.attributes.agility,
            bonuses.critRateBonus + passives.critRateBonus + this.playerEntity.effects.getModifiers().critRateBonus
        );
        if (critical) {
            damage *= criticalMultiplier(balance, passives.critMultiplierBonus + bonuses.critDamageBonus);
        }

        return {
            damage: Math.max(1, Math.floor(damage)),
            damageType: bonuses.damageType ?? PHYSICAL,
            armorPenetration: bonuses.armorPenetration,
            critical
        };
    }

    /**
     * Aggregates combat bonuses and handles item durability updates across all equipped items.
     */
    private aggregateItemBonuses(inventoryItemRecords: InventoryItemRecord[]): ItemDamageBonuses {
        let totalFlatBonus = 0;
        let totalPercentageBonus = 0;
        let totalCritRateBonus = 0;
        let totalCritDamageBonus = 0;
        let totalPenetration = 0;
        let damageType: string | undefined;

        for (const inventoryItemRecord of inventoryItemRecords) {
            if (!inventoryItemRecord.isEquipped || !inventoryItemRecord.itemNbtData) {
                continue;
            }

            // Rationale: a broken item (durability 0) gives no bonus anymore.
            const { durability } = inventoryItemRecord.itemNbtData;
            if (typeof durability === "number" && durability <= 0) {
                continue;
            }

            const currentItemBonuses = this.getItemDamageBonuses(inventoryItemRecord);
            // Affinity of the class with weapons: their bonuses are amplified.
            const affinity = inventoryItemRecord.category === ItemCategory.Weapons ? 1 + this.playerEntity.getClassPassives().weaponAffinityPercent / 100 : 1;
            totalFlatBonus += currentItemBonuses.flatBonus * affinity;
            totalPercentageBonus += currentItemBonuses.percentageBonus * affinity;
            totalCritRateBonus += currentItemBonuses.critRateBonus * affinity;
            totalCritDamageBonus += currentItemBonuses.critDamageBonus;
            totalPenetration += currentItemBonuses.armorPenetration;
            // The first worn weapon that sets a damage type decides the type of the blow.
            if (damageType === undefined && inventoryItemRecord.category === ItemCategory.Weapons) damageType = currentItemBonuses.damageType;

            if (currentItemBonuses.contributesToAttack) {
                this.applyItemDurability(inventoryItemRecord);
            }
        }

        return { 
            flatBonus: totalFlatBonus, 
            percentageBonus: totalPercentageBonus, 
            critRateBonus: totalCritRateBonus,
            critDamageBonus: totalCritDamageBonus,
            armorPenetration: totalPenetration,
            ...(damageType !== undefined ? { damageType } : {}),
            contributesToAttack: false
        };
    }

    /**
     * Gets the player's base attack stat according to their class.
     */
    private getPlayerAttackStat(): number {
        const classDefinition = this.playerEntity.worldInstance.classes.get(this.playerEntity.classId);
        if (!classDefinition) {
            log.warn(`Unknown player class identifier '${this.playerEntity.classId}'; defaulting attack stat to strength.`);
            return this.playerEntity.attributes.strength;
        }

        const resolvedPlayerStat = this.playerEntity.attributes[classDefinition.attackStat ?? "strength"];
        return resolvedPlayerStat;
    }

    /**
     * Extracts combat bonuses from an equipped item.
     */
    private getItemDamageBonuses(inventoryItemRecord: InventoryItemRecord): ItemDamageBonuses {
        const itemDataNBT: ItemNBT = inventoryItemRecord.itemNbtData ?? {};
        const flatDamageBonus = itemDataNBT.damageBonus ?? (itemDataNBT["flatDamage"] as number | undefined);
        const percentageDamageBonus = itemDataNBT["damageBonusPercent"] as number | undefined;
        const criticalRateBonusValue = itemDataNBT.critRateBonus ?? (itemDataNBT["critChance"] as number | undefined);
        
        const flatBonus = typeof flatDamageBonus === "number" ? flatDamageBonus : 0;
        const percentageBonus = typeof percentageDamageBonus === "number" ? percentageDamageBonus / 100 : 0;
        const critRateBonus = typeof criticalRateBonusValue === "number" ? criticalRateBonusValue : 0;
        const readNumber = (key: string): number => (typeof itemDataNBT[key] === "number" ? (itemDataNBT[key] as number) : 0);
        const critDamageBonus = readNumber("critDamageBonus");
        const armorPenetration = readNumber("armorPenetration");
        const weaponDamageType = typeof itemDataNBT["damageType"] === "string" ? (itemDataNBT["damageType"] as string) : undefined;
        const contributesToAttack = flatBonus !== 0 || percentageBonus !== 0 || critRateBonus !== 0 || critDamageBonus !== 0 || armorPenetration !== 0;

        return {
            flatBonus,
            percentageBonus,
            critRateBonus,
            critDamageBonus,
            armorPenetration,
            ...(weaponDamageType !== undefined ? { damageType: weaponDamageType } : {}),
            contributesToAttack
        };
    }

    /**
     * Applies durability loss to an equipped item that contributes to combat.
     */
    private applyItemDurability(inventoryItemRecord: InventoryItemRecord): void {
        const itemDataNBT = inventoryItemRecord.itemNbtData;

        if (!itemDataNBT || itemDataNBT.durability === undefined || itemDataNBT.durability <= 0) {
            if (itemDataNBT && itemDataNBT.durability !== undefined && itemDataNBT.durability < 0) {
                log.warn(`Item ${inventoryItemRecord.name} has invalid negative durability (${itemDataNBT.durability}).`);
            }
            return;
        }

        const itemRarityString = String(inventoryItemRecord.rarity).toLowerCase();
        const durabilityMultiplier = Combat.RARITY_DURABILITY_MULTIPLIERS[itemRarityString] ?? 1;
        const calculatedDurabilityLoss = Math.max(1, Math.floor(durabilityMultiplier));

        itemDataNBT.durability = Math.max(0, itemDataNBT.durability - calculatedDurabilityLoss);

        if (itemDataNBT.durability === 0) {
            log.success(`Equipment broken: ${inventoryItemRecord.name}.`);
        }
    }

    /**
     * Checks whether the combat has ended.
     */
    public isFinished(): boolean {
        return !this.playerEntity.isAlive() || !this.enemyEntity.isAlive();
    }
}