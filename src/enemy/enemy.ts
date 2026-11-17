import { DEFAULT_BALANCE, type BalanceConfig } from "../balance/balance.js";
import { PHYSICAL, defenseFactor, penetrate, resistanceFactor, type DamageType } from "../balance/formulas.js";
import { Item } from "../inventory/inventory.interface.js";
import { createLogger } from "../utils/logger.js";
const log = createLogger("enemy");


export interface EnemyStats {
    name: string;
    health: number;
    maxHealth: number;
    strength: number;
    defense: number;
    experience: number;
}

/**
 * How a blow meets an enemy.
 */
export interface EnemyDamageOptions {
    /** Type of the damage. @defaultValue "physical" */
    readonly damageType?: DamageType;
    /** Armor penetration of the attacker, in percent of the enemy defense. */
    readonly armorPenetration?: number;
    /** Balance factors. @defaultValue DEFAULT_BALANCE */
    readonly balance?: BalanceConfig;
}

export interface LootItem extends Item {
    minQuantity: number;
    maxQuantity: number;
    dropRate: number; // Stored as a percentage (0 - 100)
}

export interface EnemyDrop {
    loot: LootItem;
    quantity: number;
}

export default class EnemyEntity {
    public droppedLootList: EnemyDrop[] = [];
    /**
     * Loot luck in percent of whoever fights the enemy: every drop rate is multiplied by `1 + luck / 100` (capped at 100%).
     * Set by the combat before the blow that kills the enemy.
     */
    public dropLuckPercent = 0;
    private hasDroppedLoot = false;

    constructor(
        public readonly type: string,
        public readonly name: string,
        public health: number,
        public readonly maxHealth: number,
        public readonly strength: number,
        public readonly defense: number,
        public readonly experience: number,
        public readonly gold: number,
        private readonly lootTable: readonly LootItem[] = [],
        /** Difficulty tier of the species (`beginner`, `boss`...), when known. */
        public readonly tier?: string,
        /** Resistances by damage type, in percent (negative = weakness). */
        public readonly resistances: Readonly<Record<string, number>> = {},
        /** Type of the damage of its attacks. */
        public readonly damageType: DamageType = PHYSICAL
    ) {}

    public takeDamage(incomingDamage: number, options: EnemyDamageOptions = {}): number {
        if (incomingDamage < 0) {
            log.warn(`Invalid negative damage value (${incomingDamage}) applied to enemy ${this.name}.`);
            return 0;
        }

        const balance = options.balance ?? DEFAULT_BALANCE;
        const damageType = options.damageType ?? PHYSICAL;
        // Physical damage meets the defense (after the armor penetration); other types meet the resistance of their type.
        const afterDefense = damageType === PHYSICAL
            ? incomingDamage * defenseFactor(balance, penetrate(balance, this.defense, options.armorPenetration ?? 0), balance.defense.enemyConstant)
            : incomingDamage;
        const afterResistance = afterDefense * resistanceFactor(balance, this.resistances[damageType] ?? 0);
        const calculatedFinalDamage = Math.max(1, Math.floor(afterResistance));
        const previousHealthPoints = this.health;
        this.health = Math.max(0, this.health - calculatedFinalDamage);

        if (previousHealthPoints > 0 && !this.isAlive() && !this.hasDroppedLoot) {
            this.triggerDeathDrops();
        }

        return calculatedFinalDamage;
    }

    private triggerDeathDrops(): void {
        this.hasDroppedLoot = true;
        this.droppedLootList = this.rollDrops();
    }

    public heal(restoreAmount: number): number {
        if (restoreAmount < 0) {
            log.warn(`Invalid negative heal amount (${restoreAmount}) applied to enemy ${this.name}.`);
            return this.health;
        }

        this.health = Math.min(this.maxHealth, this.health + restoreAmount);
        return this.health;
    }

    public resetHealth(): number {
        this.health = this.maxHealth;
        this.hasDroppedLoot = false;
        this.droppedLootList = [];
        return this.health;
    }

    public isAlive(): boolean {
        return this.health > 0;
    }

    public get healthRatio(): number {
        if (this.maxHealth <= 0) {
            log.warn(`Enemy ${this.name} has invalid maxHealth (${this.maxHealth}); healthRatio defaulted to 0.`);
            return 0;
        }
        return this.health / this.maxHealth;
    }

    private rollItemQuantity(lootItem: LootItem): number {
        return Math.floor(Math.random() * (lootItem.maxQuantity - lootItem.minQuantity + 1)) + lootItem.minQuantity;
    }

    public rollDrops(): EnemyDrop[] {
        const droppedItemsList: EnemyDrop[] = [];
        for (const lootItem of this.lootTable) {
            const effectiveDropRate = Math.min(100, lootItem.dropRate * (1 + Math.max(0, this.dropLuckPercent) / 100));
            if (Math.random() * 100 <= effectiveDropRate) {
                const quantity = this.rollItemQuantity(lootItem);
                droppedItemsList.push({ loot: lootItem, quantity });
            }
        }

        log.success(`Rolled ${droppedItemsList.length} drops for ${this.name}.`);
        return droppedItemsList;
    }
}