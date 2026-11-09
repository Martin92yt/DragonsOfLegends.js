import PlayerEntity from "../player/player.entity.js";
import EnemyEntity from "../enemy/enemy.js";
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
        const rawPlayerDamageOutput = await this.getPlayerDamage();
        return this.enemyEntity.takeDamage(rawPlayerDamageOutput);
    }

    /**
     * Handles rewards and state when the enemy is defeated.
     */
    private async handleEnemyDefeat(inflictedEnemyDamage: number): Promise<CombatResult> {
        // Amulets and potions boost the experience (the event below reports the experience actually gained).
        const { gainedAmount: experience } = await this.playerEntity.gainXP(this.enemyEntity.experience);
        this.playerEntity.gold += this.enemyEntity.gold;
        consola.success(`${this.playerEntity.name} defeated ${this.enemyEntity.name}.`);
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
                consola.error(`Failed to give ${drop.quantity}x ${drop.loot.itemId} to ${this.playerEntity.name}.`, error);
            }
        }
    }

    /**
     * Executes the enemy's counter-attack action.
     */
    private async executeEnemyTurn(inflictedEnemyDamage: number): Promise<CombatResult> {
        const rawEnemyAttackDamage = Math.max(1, this.enemyEntity.strength);
        
        // 🛡️ Ajout du 'await' indispensable ici
        const playerDamageReductionResult = await this.playerEntity.takeDamage(rawEnemyAttackDamage);
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
     */
    private async getPlayerDamage(): Promise<number> {
        const basePlayerAttackStat = this.getPlayerAttackStat();
        const randomDamageRoll = Math.floor(Math.random() * 5) - 2;
        let totalCalculatedDamage = basePlayerAttackStat + randomDamageRoll;

        const equippedInventoryItems = await this.playerEntity.inventory?.getItems() ?? [];
        const accumulatedItemBonuses = this.aggregateItemBonuses(equippedInventoryItems);

        totalCalculatedDamage += accumulatedItemBonuses.flatBonus;
        totalCalculatedDamage *= 1 + accumulatedItemBonuses.percentageBonus;

        if (equippedInventoryItems.length > 0) {
            await this.playerEntity.inventory?.save(equippedInventoryItems);
        }

        const totalCriticalRate = Math.min(
            Combat.MAX_CRIT_RATE,
            // Rationale: worn amulets are already counted in the item bonuses; only the temporary effects are added here.
            Combat.BASE_CRIT_RATE + accumulatedItemBonuses.critRateBonus + this.playerEntity.effects.getModifiers().critRateBonus
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

            // Rationale: a broken item (durability 0) gives no bonus anymore.
            const { durability } = inventoryItemRecord.itemNbtData;
            if (typeof durability === "number" && durability <= 0) {
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
     */
    private getPlayerAttackStat(): number {
        const classDefinition = this.playerEntity.worldInstance.classes.get(this.playerEntity.classId);
        if (!classDefinition) {
            consola.warn(`Unknown player class identifier '${this.playerEntity.classId}'; defaulting attack stat to strength.`);
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
     */
    public isFinished(): boolean {
        return !this.playerEntity.isAlive() || !this.enemyEntity.isAlive();
    }
}