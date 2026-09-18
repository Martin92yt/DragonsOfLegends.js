import { EnemyType } from "./enemy.type.js";
import { consola } from "consola";
import { Item } from "../inventory/inventory.interface.js";
import { ItemCategory, ItemRarity } from "../inventory/item.enum.js";

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

// Rebalanced loot rates and stack quantities to prevent economic imbalance and material oversaturation.
const ENEMY_LOOT_TABLE_REGISTRY: Readonly<Record<EnemyType, readonly LootItem[]>> = {
    [EnemyType.Slime]: [
        { itemId: "bave_de_slime", name: "Slime Ooze", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 35 },
        { itemId: "noyau_gelatineux", name: "Gelatinous Core", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 1, dropRate: 4 }
    ],
    [EnemyType.Skeleton]: [
        { itemId: "os", name: "Bone", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 45 },
        { itemId: "crane_fissure", name: "Cracked Skull", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 12 },
        { itemId: "arc_ancien", name: "Ancient Bow", category: ItemCategory.Weapons, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 6 }
    ],
    [EnemyType.Goblin]: [
        { itemId: "dague_rouillee", name: "Rusty Dagger", category: ItemCategory.Weapons, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 15 },
        { itemId: "oreille_gobelin", name: "Goblin Ear", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 35 },
        { itemId: "bourse_de_trous", name: "Pouch of Holes", category: ItemCategory.Valuables, rarity: ItemRarity.Uncommon, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 }
    ],
    [EnemyType.Wolf]: [
        { itemId: "fourrure_loup", name: "Wolf Fur", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 40 },
        { itemId: "croc_de_loup", name: "Wolf Fang", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 30 },
        { itemId: "viande_crue", name: "Raw Meat", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 50 }
    ],
    [EnemyType.Bandit]: [
        { itemId: "piece_or", name: "Gold Coin", category: ItemCategory.Valuables, rarity: ItemRarity.Common, maxStack: 999, minQuantity: 1, maxQuantity: 5, dropRate: 60 },
        { itemId: "dague_rouillee", name: "Rusty Dagger", category: ItemCategory.Weapons, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 12 },
        { itemId: "chapeau_dechire", name: "Torn Hat", category: ItemCategory.Armor, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 }
    ],
    [EnemyType.GiantRat]: [
        { itemId: "queue_de_rat", name: "Rat Tail", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 45 },
        { itemId: "viande_crue", name: "Raw Meat", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 25 }
    ],
    [EnemyType.WildBoar]: [
        { itemId: "viande_crue", name: "Raw Meat", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 60 },
        { itemId: "defense_sanglier", name: "Boar Tusk", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 25 },
        { itemId: "cuir_epais", name: "Thick Leather", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 20 }
    ],
    [EnemyType.Spider]: [
        { itemId: "venin_araignee", name: "Spider Venom", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 16, minQuantity: 1, maxQuantity: 1, dropRate: 30 },
        { itemId: "soie_araignee", name: "Spider Silk", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 45 }
    ],
    [EnemyType.Orc]: [
        { itemId: "hache_orc", name: "Orc Axe", category: ItemCategory.Weapons, rarity: ItemRarity.Uncommon, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10 },
        { itemId: "dent_orque", name: "Orc Tooth", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 35 },
        { itemId: "viande_crue", name: "Raw Meat", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 40 }
    ],
    [EnemyType.Ghost]: [
        { itemId: "ectoplasme", name: "Ectoplasm", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 35 },
        { itemId: "poussiere_spectrale", name: "Spectral Dust", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 15 }
    ],
    [EnemyType.Zombie]: [
        { itemId: "chair_putrefiee", name: "Rotten Flesh", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 50 },
        { itemId: "os", name: "Bone", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 25 },
        { itemId: "chapeau_dechire", name: "Torn Hat", category: ItemCategory.Armor, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 }
    ],
    [EnemyType.DarkCultist]: [
        { itemId: "robe_sombre", name: "Dark Robe", category: ItemCategory.Armor, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 12 },
        { itemId: "grimoire_maudit", name: "Cursed Grimoire", category: ItemCategory.Valuables, rarity: ItemRarity.Epic, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 6 },
        { itemId: "bougie_noire", name: "Black Candle", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 40 }
    ],
    [EnemyType.Troll]: [
        { itemId: "masse_en_pierre", name: "Stone Mace", category: ItemCategory.Weapons, rarity: ItemRarity.Uncommon, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 12 },
        { itemId: "sang_de_troll", name: "Troll Blood", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 40 },
        { itemId: "pepite_pierre", name: "Stone Nugget", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 3, dropRate: 50 }
    ],
    [EnemyType.Minotaur]: [
        { itemId: "hache_minotaure", name: "Minotaur Axe", category: ItemCategory.Weapons, rarity: ItemRarity.Epic, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 },
        { itemId: "corne_minotaure", name: "Minotaur Horn", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 30 },
        { itemId: "cuir_epais", name: "Thick Leather", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 3, dropRate: 50 }
    ],
    [EnemyType.Vampire]: [
        { itemId: "cape_satin_noir", name: "Black Satin Cape", category: ItemCategory.Armor, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 12 },
        { itemId: "crocs_vampire", name: "Vampire Fangs", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 28 },
        { itemId: "fiole_sang_pur", name: "Pure Blood Vial", category: ItemCategory.Consumables, rarity: ItemRarity.Epic, maxStack: 8, minQuantity: 1, maxQuantity: 1, dropRate: 18 }
    ],
    [EnemyType.Witch]: [
        { itemId: "potion_magique", name: "Magic Potion", category: ItemCategory.Consumables, rarity: ItemRarity.Uncommon, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 35 },
        { itemId: "plante_veneneuse", name: "Poisonous Plant", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 40 },
        { itemId: "chapeau_sorciere", name: "Witch Hat", category: ItemCategory.Armor, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 }
    ],
    [EnemyType.StoneGolem]: [
        { itemId: "pierre_magique", name: "Magic Stone", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 50 },
        { itemId: "fragment_golem", name: "Golem Fragment", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 30 },
        { itemId: "noyau_elementaire", name: "Elemental Core", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 4, minQuantity: 1, maxQuantity: 1, dropRate: 4 }
    ],
    [EnemyType.Lich]: [
        { itemId: "phylactere_brise", name: "Broken Phylactery", category: ItemCategory.Valuables, rarity: ItemRarity.Legendary, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 4 },
        { itemId: "baton_sombre", name: "Dark Staff", category: ItemCategory.Weapons, rarity: ItemRarity.Epic, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 },
        { itemId: "poussiere_detite", name: "Stardust", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 64, minQuantity: 1, maxQuantity: 3, dropRate: 65 }
    ],
    [EnemyType.DemonLord]: [
        { itemId: "coeur_demon", name: "Demon Heart", category: ItemCategory.Materials, rarity: ItemRarity.Legendary, maxStack: 4, minQuantity: 1, maxQuantity: 1, dropRate: 18 },
        { itemId: "epee_demoniaque", name: "Demonic Sword", category: ItemCategory.Weapons, rarity: ItemRarity.Legendary, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 },
        { itemId: "fragment_infernal", name: "Infernal Fragment", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 32, minQuantity: 1, maxQuantity: 4, dropRate: 75 }
    ],
    [EnemyType.AncientDragon]: [
        { itemId: "ecailles_dragon", name: "Dragon Scales", category: ItemCategory.Materials, rarity: ItemRarity.Legendary, maxStack: 64, minQuantity: 2, maxQuantity: 5, dropRate: 85 },
        { itemId: "griffe_dragon", name: "Dragon Claw", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 40 },
        { itemId: "orbe_draconique", name: "Draconic Orb", category: ItemCategory.Valuables, rarity: ItemRarity.Legendary, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10 }
    ],
    [EnemyType.Hydra]: [
        { itemId: "ecaille_hydre", name: "Hydra Scale", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 32, minQuantity: 1, maxQuantity: 3, dropRate: 65 },
        { itemId: "venin_mortel", name: "Deadly Venom", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 45 },
        { itemId: "dent_hydre", name: "Hydra Tooth", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 30 }
    ]
};

export default class EnemyEntity {
    public droppedLootList: EnemyDrop[] = [];
    private hasDroppedLoot = false;

    constructor(
        public readonly type: EnemyType,
        public readonly name: string,
        public health: number,
        public readonly maxHealth: number,
        public readonly strength: number,
        public readonly defense: number,
        public readonly experience: number,
        public readonly gold: number
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
        const enemyLootTable = ENEMY_LOOT_TABLE_REGISTRY[this.type];
        if (!enemyLootTable) {
            consola.error(`Failed to roll drops: unknown loot table for enemy type ${this.type}.`);
            return [];
        }

        const droppedItemsList: EnemyDrop[] = [];
        for (const lootItem of enemyLootTable) {
            if (Math.random() * 100 <= lootItem.dropRate) {
                const quantity = this.rollItemQuantity(lootItem);
                droppedItemsList.push({ loot: lootItem, quantity });
            }
        }

        consola.success(`Rolled ${droppedItemsList.length} drops for ${this.name}.`);
        return droppedItemsList;
    }
}