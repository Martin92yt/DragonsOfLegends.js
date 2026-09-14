import Player from "../player/player.entity.js";
import Enemy from "../enemy/enemy.class.js";
import { Logger } from "../utils/logger.js";
import { CombatResult } from "../types/result.js";
import { ItemNBT, InventoryItemRecord } from "../inventory/inventory.interface.js";

export default class Combat {
readonly #logger = new Logger({ context: "Combat" });
private static readonly BASE_CRIT_RATE = 0.15;
private static readonly CRIT_MULTIPLIER = 1.5;
private static readonly RARITY_DURABILITY_MULTIPLIERS: Readonly<Record<string, number>> = {
common: 1.5,
uncommon: 1.2,
rare: 1,
epic: 0.7,
legendary: 0.4
};

/**
 * Creates a combat instance.
 *
 * @param player The player participating in the combat.
 * @param enemy The enemy participating in the combat.
 */
public constructor(public readonly player: Player, public readonly enemy: Enemy) {}

/**
 * Executes one combat turn.
 *
 * @returns The result of the combat turn.
 */
public attack(): CombatResult {
    const rawPlayerDamage = this.getPlayerDamage();
    const previousEnemyHealth = this.enemy.health;
    const enemyDamage = this.enemy.takeDamage(rawPlayerDamage);

    this.#logger.debug(`${this.player.name} dealt ${enemyDamage} damage to ${this.enemy.name} (${previousEnemyHealth} -> ${this.enemy.health} HP).`);

    if (!this.enemy.isAlive()) {
        this.player.addXP(this.enemy.experience);
        this.player.gold += this.enemy.gold;
        this.#logger.info(`${this.player.name} defeated ${this.enemy.name}.`);

        return {
            playerDamage: 0,
            enemyDamage,
            enemyHealth: 0,
            victory: true,
            defeat: false,
            enemy: this.enemy
        };
    }

    const enemyAttackDamage = Math.max(1, this.enemy.strength);
    const previousPlayerHealth = this.player.health.current;
    const damageResult = this.player.takeDamage(enemyAttackDamage);
    const playerDamage = damageResult?.reducedDamage ?? enemyAttackDamage;
    const defeat = !this.player.isAlive();

    this.#logger.debug(`${this.enemy.name} dealt ${playerDamage} damage to ${this.player.name} (${previousPlayerHealth} -> ${this.player.health.current} HP).`);

    if (defeat) {
        this.#logger.info(`${this.player.name} was defeated by ${this.enemy.name}.`);
    }

    return {
        playerDamage,
        enemyDamage,
        enemyHealth: this.enemy.health,
        victory: false,
        defeat,
        enemy: this.enemy
    };
}

/**
 * Calculates the damage dealt by the player.
 *
 * @returns The final calculated damage.
 */
private getPlayerDamage(): number {
    const baseStat = this.getPlayerAttackStat();
    const roll = Math.floor(Math.random() * 6) - 2;
    let totalDamage = baseStat + roll;
    let flatBonus = 0;
    let percentageBonus = 0;
    let critRate = Combat.BASE_CRIT_RATE;
    const items = this.player.inventory?.getItems() ?? [];

    for (const item of items) {
        if (!item.isEquipped || !item.data) {
            continue;
        }

        const bonuses = this.getItemDamageBonuses(item);
        flatBonus += bonuses.flatBonus;
        percentageBonus += bonuses.percentageBonus;
        critRate += bonuses.critRateBonus;

        if (bonuses.contributesToAttack) {
            this.applyItemDurability(item);
        }
    }

    totalDamage += flatBonus;
    totalDamage *= 1 + percentageBonus;

    if (items.length > 0) {
        this.player.inventory?.save(items);
    }

    const isCritical = Math.random() < critRate;

    if (isCritical) {
        totalDamage *= Combat.CRIT_MULTIPLIER;
        this.#logger.debug(`${this.player.name} landed a critical hit for x${Combat.CRIT_MULTIPLIER} damage.`);
    }

    const finalDamage = Math.max(1, Math.floor(totalDamage));

    this.#logger.debug(
        `${this.player.name} attack: base=${baseStat}, roll=${roll}, equipment=+${flatBonus} (+${percentageBonus * 100}%), critRate=${(critRate * 100).toFixed(1)}%, crit=${isCritical}, final=${finalDamage}.`
    );

    return finalDamage;
}

/**
 * Gets the player's base attack stat according to their class.
 *
 * @returns The base attack stat.
 */
private getPlayerAttackStat(): number {
    const statMap: Readonly<Record<string, number>> = {
        warrior: this.player.attributes.strength,
        explorer: this.player.attributes.agility,
        mage: this.player.attributes.intelligence
    };

    return statMap[this.player.classId] ?? this.player.attributes.strength;
}

/**
 * Extracts combat bonuses from an equipped item.
 *
 * @param item The equipped inventory item.
 * @returns The combat bonuses provided by the item.
 */
private getItemDamageBonuses(item: InventoryItemRecord): {
    flatBonus: number;
    percentageBonus: number;
    critRateBonus: number;
    contributesToAttack: boolean;
} {
    const data: ItemNBT = item.data ?? {};
    const flatDamage = data.damageBonus ?? (data["flatDamage"] as number | undefined);
    const percentageDamage = data["damageBonusPercent"] as number | undefined;
    const critChance = data.critRateBonus ?? (data["critChance"] as number | undefined);
    const flatBonus = typeof flatDamage === "number" ? flatDamage : 0;
    const percentageBonus = typeof percentageDamage === "number" ? percentageDamage / 100 : 0;
    const critRateBonus = typeof critChance === "number" ? critChance : 0;
    const contributesToAttack = flatBonus !== 0 || percentageBonus !== 0 || critRateBonus !== 0;

    if (flatBonus !== 0) {
        this.#logger.debug(`[${item.name}] Damage bonus: +${flatBonus}.`);
    }

    if (percentageBonus !== 0) {
        this.#logger.debug(`[${item.name}] Damage percentage bonus: +${percentageBonus * 100}%.`);
    }

    if (critRateBonus !== 0) {
        this.#logger.debug(`[${item.name}] Critical chance bonus: +${(critRateBonus * 100).toFixed(1)}%.`);
    }

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
 * @param item The equipped inventory item.
 */
private applyItemDurability(item: InventoryItemRecord): void {
    const data = item.data;

    if (!data || data.durability === undefined || data.durability <= 0) {
        return;
    }

    const rarity = String(item.rarity).toLowerCase();
    const durabilityMultiplier = Combat.RARITY_DURABILITY_MULTIPLIERS[rarity] ?? 1;
    const durabilityLoss = Math.max(1, Math.floor(durabilityMultiplier));
    const previousDurability = data.durability;

    data.durability = Math.max(0, data.durability - durabilityLoss);

    this.#logger.debug(`[${item.name}] Durability: ${previousDurability} -> ${data.durability}.`);

    if (data.durability === 0) {
        this.#logger.debug(`[${item.name}] Equipment is broken.`);
    }
}

/**
 * Checks whether the combat has ended.
 *
 * @returns True when either participant is no longer alive.
 */
public isFinished(): boolean {
    return !this.player.isAlive() || !this.enemy.isAlive();
}


}