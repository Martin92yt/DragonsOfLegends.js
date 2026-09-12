import { EnemyType } from "./enemy.type.js";
import { Logger } from "../utils/logger.js";

export interface EnemyStats {
    name: string;
    health: number;
    maxHealth: number;
    strength: number;
    defense: number;
    experience: number;
}

export interface LootItem {
    itemId: string;
    minQuantity: number;
    maxQuantity: number;
    dropRate: number; // en pourcent, ex: 0.12 = 0.12%
}

// Table de loot associée à chaque type de monstre
const ENEMY_LOOT_TABLES: Record<EnemyType, LootItem[]> = {
    [EnemyType.Slime]: [
        { itemId: "bave_de_slime", minQuantity: 1, maxQuantity: 1, dropRate: 0.12 }
    ],
    [EnemyType.Skeleton]: [
        { itemId: "os", minQuantity: 1, maxQuantity: 2, dropRate: 2.1 },
        { itemId: "arc", minQuantity: 1, maxQuantity: 1, dropRate: 1.8 }
    ],
    [EnemyType.Goblin]: [
        { itemId: "dague_rouillee", minQuantity: 1, maxQuantity: 1, dropRate: 1.5 },
        { itemId: "oreille_gobelin", minQuantity: 1, maxQuantity: 1, dropRate: 15.0 }
    ],
    [EnemyType.Wolf]: [
        { itemId: "fourrure_loup", minQuantity: 1, maxQuantity: 1, dropRate: 5.0 },
        { itemId: "croc_de_loup", minQuantity: 1, maxQuantity: 2, dropRate: 3.5 }
    ],
    [EnemyType.Bandit]: [],
    [EnemyType.GiantRat]: [],
    [EnemyType.WildBoar]: [],
    [EnemyType.Spider]: [],
    [EnemyType.Orc]: [],
    [EnemyType.Ghost]: [],
    [EnemyType.Zombie]: [],
    [EnemyType.DarkCultist]: [],
    [EnemyType.Troll]: [],
    [EnemyType.Minotaur]: [],
    [EnemyType.Vampire]: [],
    [EnemyType.Witch]: [],
    [EnemyType.StoneGolem]: [],
    [EnemyType.Lich]: [],
    [EnemyType.DemonLord]: [],
    [EnemyType.AncientDragon]: [],
    [EnemyType.Hydra]: []
};

export default class EnemyEntity {
    private readonly logger = new Logger({ context: "EnemyEntity" });

    // Stocke les loots générés automatiquement lorsque le monstre meurt
    public drops: { itemId: string; quantity: number }[] = [];
    private hasDropped: boolean = false;

    constructor(
        public readonly type: EnemyType,
        public readonly name: string,
        public health: number,
        public readonly maxHealth: number,
        public readonly strength: number,
        public readonly defense: number,
        public readonly experience: number
    ) {}

    public takeDamage(damage: number): number {
        const finalDamage = Math.max(1, damage - Math.floor(this.defense / 2));
        const previousHealth = this.health;
        this.health = Math.max(0, this.health - finalDamage);
        

        // AUTOMATIQUE : Si le monstre vient de mourir (PV <= 0 et était en vie avant)
        if (previousHealth > 0 && !this.isAlive() && !this.hasDropped) {
            this.hasDropped = true;
            this.drops = this.rollDrops();
        }

        return finalDamage;
    }

    public heal(amount: number): void { 
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.logger.debug(`${this.name} heals for ${amount} HP (current HP: ${this.health}/${this.maxHealth}).`);
    }

    public resetHealth(): void {
        this.health = this.maxHealth;
        this.hasDropped = false;
        this.drops = [];
        this.logger.debug(`${this.name}'s health has been fully reset to ${this.maxHealth} HP.`);
    }

    public isAlive(): boolean { 
        return this.health > 0; 
    }

    public get healthRatio(): number { 
        return this.health / this.maxHealth; 
    }

    /**
     * Calcule et génère automatiquement le loot lorsque ce monstre est vaincu.
     */
    public rollDrops(): { itemId: string; quantity: number }[] {
        const possibleLoots = ENEMY_LOOT_TABLES[this.type] || [];
        const droppedItems: { itemId: string; quantity: number }[] = [];

        for (const loot of possibleLoots) {
            const roll = Math.random() * 100;
            if (roll <= loot.dropRate) {
                const quantity = Math.floor(Math.random() * (loot.maxQuantity - loot.minQuantity + 1)) + loot.minQuantity;
                droppedItems.push({ itemId: loot.itemId, quantity });
                this.logger.debug(`${this.name} dropped ${quantity}x ${loot.itemId} (roll=${roll.toFixed(2)}, chance=${loot.dropRate})`);
            }
        }

        return droppedItems;
    }
}