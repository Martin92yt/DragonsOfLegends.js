import { consola } from "consola";
import { Item } from "../inventory/inventory.interface.js";

export interface EnemyStats {
    name: string;
    health: number;
    maxHealth: number;
    strength: number;
    defense: number;
    experience: number;
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
        public readonly tier?: string
    ) {}

    public takeDamage(incomingDamage: number): number {
        if (incomingDamage < 0) {
            consola.warn(`Invalid negative damage value (${incomingDamage}) applied to enemy ${this.name}.`);
            return 0;
        }

        // Rebalanced mitigation curve to prevent flat hard scaling from stalling out player builds.
        const mitigation = Math.floor(this.defense * 0.4);
        const calculatedFinalDamage = Math.max(1, incomingDamage - mitigation);
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
            consola.warn(`Invalid negative heal amount (${restoreAmount}) applied to enemy ${this.name}.`);
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
            consola.warn(`Enemy ${this.name} has invalid maxHealth (${this.maxHealth}); healthRatio defaulted to 0.`);
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

        consola.success(`Rolled ${droppedItemsList.length} drops for ${this.name}.`);
        return droppedItemsList;
    }
}