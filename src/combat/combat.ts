import PlayerEntity from "../player/player.entity.js";
import EnemyEntity from "../enemy/enemy.class.js";
import { consola } from "consola";
import { CombatResult } from "../types/result.js";
import { ItemNBT, InventoryItemRecord } from "../inventory/inventory.interface.js";

interface ItemDamageBonuses {
    flatBonus: number;
    percentageBonus: number;
    critRateBonus: number;
    contributesToAttack: boolean;
}

export default class Combat {
    // Rebalanced base critical parameters and added a maximum critical cap to prevent overpowered builds.
    private static readonly BASE_CRIT_RATE = 0.10;
    private static readonly MAX_CRIT_RATE = 0.75;
    private static readonly CRIT_MULTIPLIER = 1.45;

    private static readonly RARITY_DURABILITY_MULTIPLIERS: Readonly<Record<string, number>> = {
        common: 1.4,
        uncommon: 1.1,
        rare: 1.0,
        epic: 0.65,
        legendary: 0.35
    };

    /**
     * Creates a combat instance.
     *
     * @param playerEntity The player participating in the combat.
     * @param enemyEntity The enemy participating in the combat.
     * @returns void
     */
    public constructor(public readonly playerEntity: PlayerEntity, public readonly enemyEntity: EnemyEntity) {}

    /**
     * Executes one combat turn.
     *
     * @returns The result of the combat turn.
     */
    public attack(): CombatResult {
        const inflictedEnemyDamage = this.executePlayerTurn();

        if (!this.enemyEntity.isAlive()) {
            return this.handleEnemyDefeat(inflictedEnemyDamage);
        }

        return this.executeEnemyTurn(inflictedEnemyDamage);
    }

    /**
     * Executes the player's attack action.
     */
    private executePlayerTurn(): number {
        const rawPlayerDamageOutput = this.getPlayerDamage();
        return this.enemyEntity.takeDamage(rawPlayerDamageOutput);
    }

    /**
     * Handles rewards and state when the enemy is defeated.
     */
    private handleEnemyDefeat(inflictedEnemyDamage: number): CombatResult {
        this.playerEntity.addXP(this.enemyEntity.experience);
        this.playerEntity.gold += this.enemyEntity.gold;
        consola.success(`${this.playerEntity.name} defeated ${this.enemyEntity.name}.`);

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
     * Executes the enemy's counter-attack action.
     */
    private executeEnemyTurn(inflictedEnemyDamage: number): CombatResult {
        const rawEnemyAttackDamage = Math.max(1, this.enemyEntity.strength);
        const playerDamageReductionResult = this.playerEntity.takeDamage(rawEnemyAttackDamage);
        const finalPlayerDamageTaken = playerDamageReductionResult?.reducedDamage ?? rawEnemyAttackDamage;
        const isPlayerDefeated = !this.playerEntity.isAlive();

        if (isPlayerDefeated) {
            consola.success(`${this.playerEntity.name} was defeated by ${this.enemyEntity.name}.`);
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
     *
     * @returns The final calculated damage.
     */
    private getPlayerDamage(): number {
        const basePlayerAttackStat = this.getPlayerAttackStat();
        const randomDamageRoll = Math.floor(Math.random() * 5) - 2;
        let totalCalculatedDamage = basePlayerAttackStat + randomDamageRoll;

        const equippedInventoryItems = this.playerEntity.inventory?.getItems() ?? [];
        const accumulatedItemBonuses = this.aggregateItemBonuses(equippedInventoryItems);

        totalCalculatedDamage += accumulatedItemBonuses.flatBonus;
        totalCalculatedDamage *= 1 + accumulatedItemBonuses.percentageBonus;

        if (equippedInventoryItems.length > 0) {
            this.playerEntity.inventory?.save(equippedInventoryItems);
        }

        const totalCriticalRate = Math.min(
            Combat.MAX_CRIT_RATE,
            Combat.BASE_CRIT_RATE + accumulatedItemBonuses.critRateBonus
        );

        if (Math.random() < totalCriticalRate) {
            totalCalculatedDamage *= Combat.CRIT_MULTIPLIER;
        }

        return Math.max(1, Math.floor(totalCalculatedDamage));
    }

    /**
     * Aggregates combat bonuses and handles item durability updates across all equipped items.
     */
    private aggregateItemBonuses(inventoryItemRecords: InventoryItemRecord[]): ItemDamageBonuses {
        let totalFlatBonus = 0;
        let totalPercentageBonus = 0;
        let totalCritRateBonus = 0;

        for (const inventoryItemRecord of inventoryItemRecords) {
            if (!inventoryItemRecord.isEquipped || !inventoryItemRecord.itemNbtData) {
                continue;
            }

            const currentItemBonuses = this.getItemDamageBonuses(inventoryItemRecord);
            totalFlatBonus += currentItemBonuses.flatBonus;
            totalPercentageBonus += currentItemBonuses.percentageBonus;
            totalCritRateBonus += currentItemBonuses.critRateBonus;

            if (currentItemBonuses.contributesToAttack) {
                this.applyItemDurability(inventoryItemRecord);
            }
        }

        return { 
            flatBonus: totalFlatBonus, 
            percentageBonus: totalPercentageBonus, 
            critRateBonus: totalCritRateBonus, 
            contributesToAttack: false 
        };
    }

    /**
     * Gets the player's base attack stat according to their class.
     *
     * @returns The base attack stat.
     */
    private getPlayerAttackStat(): number {
        const classAttributeMap: Readonly<Record<string, number>> = {
            warrior: this.playerEntity.attributes.strength,
            explorer: this.playerEntity.attributes.agility,
            mage: this.playerEntity.attributes.intelligence
        };

        const resolvedPlayerStat = classAttributeMap[this.playerEntity.classId];
        if (resolvedPlayerStat === undefined) {
            consola.warn(`Unknown player class identifier '${this.playerEntity.classId}'; defaulting attack stat to strength.`);
            return this.playerEntity.attributes.strength;
        }

        return resolvedPlayerStat;
    }

    /**
     * Extracts combat bonuses from an equipped item.
     *
     * @param inventoryItemRecord The equipped inventory item.
     * @returns The combat bonuses provided by the item.
     */
    private getItemDamageBonuses(inventoryItemRecord: InventoryItemRecord): ItemDamageBonuses {
        const itemDataNBT: ItemNBT = inventoryItemRecord.itemNbtData ?? {};
        const flatDamageBonus = itemDataNBT.damageBonus ?? (itemDataNBT["flatDamage"] as number | undefined);
        const percentageDamageBonus = itemDataNBT["damageBonusPercent"] as number | undefined;
        const criticalRateBonusValue = itemDataNBT.critRateBonus ?? (itemDataNBT["critChance"] as number | undefined);
        
        const flatBonus = typeof flatDamageBonus === "number" ? flatDamageBonus : 0;
        const percentageBonus = typeof percentageDamageBonus === "number" ? percentageDamageBonus / 100 : 0;
        const critRateBonus = typeof criticalRateBonusValue === "number" ? criticalRateBonusValue : 0;
        const contributesToAttack = flatBonus !== 0 || percentageBonus !== 0 || critRateBonus !== 0;

        return {
            flatBonus,
            percentageBonus,
            critRateBonus,
            contributesToAttack
        };
    }

    /**
     * Applies durability loss to an equipped item that contributes to combat.
     *
     * @param inventoryItemRecord The equipped inventory item.
     * @returns void
     */
    private applyItemDurability(inventoryItemRecord: InventoryItemRecord): void {
        const itemDataNBT = inventoryItemRecord.itemNbtData;

        if (!itemDataNBT || itemDataNBT.durability === undefined || itemDataNBT.durability <= 0) {
            if (itemDataNBT && itemDataNBT.durability !== undefined && itemDataNBT.durability < 0) {
                consola.warn(`Item ${inventoryItemRecord.name} has invalid negative durability (${itemDataNBT.durability}).`);
            }
            return;
        }

        const itemRarityString = String(inventoryItemRecord.rarity).toLowerCase();
        const durabilityMultiplier = Combat.RARITY_DURABILITY_MULTIPLIERS[itemRarityString] ?? 1;
        const calculatedDurabilityLoss = Math.max(1, Math.floor(durabilityMultiplier));

        itemDataNBT.durability = Math.max(0, itemDataNBT.durability - calculatedDurabilityLoss);

        if (itemDataNBT.durability === 0) {
            consola.success(`Equipment broken: ${inventoryItemRecord.name}.`);
        }
    }

    /**
     * Checks whether the combat has ended.
     *
     * @returns True when either participant is no longer alive, false otherwise.
     */
    public isFinished(): boolean {
        return !this.playerEntity.isAlive() || !this.enemyEntity.isAlive();
    }
}