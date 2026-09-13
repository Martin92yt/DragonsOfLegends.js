import { EnemyType } from "./enemy.type.js";
import { Logger } from "../utils/logger.js";
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
    dropRate: number;
}

export interface EnemyDrop {
    itemId: string;
    quantity: number;
}

const ENEMY_LOOT_TABLES: Readonly<Record<EnemyType, readonly LootItem[]>> = {
    [EnemyType.Slime]: [{ itemId: "bave_de_slime", name: "Slime Ooze", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 35 }, { itemId: "noyau_gelatineux", name: "Gelatinous Core", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 1, dropRate: 5 }],
    [EnemyType.Skeleton]: [{ itemId: "os", name: "Bone", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 3, dropRate: 50 }, { itemId: "crane_fissure", name: "Cracked Skull", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 15 }, { itemId: "arc_ancien", name: "Ancient Bow", category: ItemCategory.Weapons, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 }],
    [EnemyType.Goblin]: [{ itemId: "dague_rouillee", name: "Rusty Dagger", category: ItemCategory.Weapons, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 20 }, { itemId: "oreille_gobelin", name: "Goblin Ear", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 40 }, { itemId: "bourse_de_trous", name: "Pouch of Holes", category: ItemCategory.Valuables, rarity: ItemRarity.Uncommon, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10 }],
    [EnemyType.Wolf]: [{ itemId: "fourrure_loup", name: "Wolf Fur", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 45 }, { itemId: "croc_de_loup", name: "Wolf Fang", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 35 }, { itemId: "viande_crue", name: "Raw Meat", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 60 }],
    [EnemyType.Bandit]: [{ itemId: "piece_or", name: "Gold Coin", category: ItemCategory.Valuables, rarity: ItemRarity.Common, maxStack: 999, minQuantity: 2, maxQuantity: 8, dropRate: 70 }, { itemId: "dague_rouillee", name: "Rusty Dagger", category: ItemCategory.Weapons, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 15 }, { itemId: "chapeau_dechire", name: "Torn Hat", category: ItemCategory.Armor, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10 }],
    [EnemyType.GiantRat]: [{ itemId: "queue_de_rat", name: "Rat Tail", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 50 }, { itemId: "viande_crue", name: "Raw Meat", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 30 }],
    [EnemyType.WildBoar]: [{ itemId: "viande_crue", name: "Raw Meat", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 70 }, { itemId: "defense_sanglier", name: "Boar Tusk", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 30 }, { itemId: "cuir_epais", name: "Thick Leather", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 25 }],
    [EnemyType.Spider]: [{ itemId: "venin_araignee", name: "Spider Venom", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 16, minQuantity: 1, maxQuantity: 1, dropRate: 35 }, { itemId: "soie_araignee", name: "Spider Silk", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 3, dropRate: 50 }],
    [EnemyType.Orc]: [{ itemId: "hache_orc", name: "Orc Axe", category: ItemCategory.Weapons, rarity: ItemRarity.Uncommon, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 12 }, { itemId: "dent_orque", name: "Orc Tooth", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 40 }, { itemId: "viande_crue", name: "Raw Meat", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 50 }],
    [EnemyType.Ghost]: [{ itemId: "ectoplasme", name: "Ectoplasm", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 40 }, { itemId: "poussiere_spectrale", name: "Spectral Dust", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 20 }],
    [EnemyType.Zombie]: [{ itemId: "chair_putrefiee", name: "Rotten Flesh", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 60 }, { itemId: "os", name: "Bone", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 30 }, { itemId: "chapeau_dechire", name: "Torn Hat", category: ItemCategory.Armor, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10 }],
    [EnemyType.DarkCultist]: [{ itemId: "robe_sombre", name: "Dark Robe", category: ItemCategory.Armor, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 15 }, { itemId: "grimoire_maudit", name: "Cursed Grimoire", category: ItemCategory.Valuables, rarity: ItemRarity.Epic, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8 }, { itemId: "bougie_noire", name: "Black Candle", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 3, dropRate: 45 }],
    [EnemyType.Troll]: [{ itemId: "masse_en_pierre", name: "Stone Mace", category: ItemCategory.Weapons, rarity: ItemRarity.Uncommon, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 15 }, { itemId: "sang_de_troll", name: "Troll Blood", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 50 }, { itemId: "pepite_pierre", name: "Stone Nugget", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 2, maxQuantity: 5, dropRate: 60 }],
    [EnemyType.Minotaur]: [{ itemId: "hache_minotaure", name: "Minotaur Axe", category: ItemCategory.Weapons, rarity: ItemRarity.Epic, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10 }, { itemId: "corne_minotaure", name: "Minotaur Horn", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 40 }, { itemId: "cuir_epais", name: "Thick Leather", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 2, maxQuantity: 4, dropRate: 70 }],
    [EnemyType.Vampire]: [{ itemId: "cape_satin_noir", name: "Black Satin Cape", category: ItemCategory.Armor, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 15 }, { itemId: "crocs_vampire", name: "Vampire Fangs", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 35 }, { itemId: "fiole_sang_pur", name: "Pure Blood Vial", category: ItemCategory.Consumables, rarity: ItemRarity.Epic, maxStack: 8, minQuantity: 1, maxQuantity: 1, dropRate: 25 }],
    [EnemyType.Witch]: [{ itemId: "potion_magique", name: "Magic Potion", category: ItemCategory.Consumables, rarity: ItemRarity.Uncommon, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 40 }, { itemId: "plante_veneneuse", name: "Poisonous Plant", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 3, dropRate: 50 }, { itemId: "chapeau_sorciere", name: "Witch Hat", category: ItemCategory.Armor, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10 }],
    [EnemyType.StoneGolem]: [{ itemId: "pierre_magique", name: "Magic Stone", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 64, minQuantity: 1, maxQuantity: 3, dropRate: 60 }, { itemId: "fragment_golem", name: "Golem Fragment", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 40 }, { itemId: "noyau_elementaire", name: "Elemental Core", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 4, minQuantity: 1, maxQuantity: 1, dropRate: 5 }],
    [EnemyType.Lich]: [{ itemId: "phylactere_brise", name: "Broken Phylactery", category: ItemCategory.Valuables, rarity: ItemRarity.Legendary, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 5 }, { itemId: "baton_sombre", name: "Dark Staff", category: ItemCategory.Weapons, rarity: ItemRarity.Epic, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10 }, { itemId: "poussiere_detite", name: "Stardust", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 64, minQuantity: 2, maxQuantity: 5, dropRate: 80 }],
    [EnemyType.DemonLord]: [{ itemId: "coeur_demon", name: "Demon Heart", category: ItemCategory.Materials, rarity: ItemRarity.Legendary, maxStack: 4, minQuantity: 1, maxQuantity: 1, dropRate: 25 }, { itemId: "epee_demoniaque", name: "Demonic Sword", category: ItemCategory.Weapons, rarity: ItemRarity.Legendary, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10 }, { itemId: "fragment_infernal", name: "Infernal Fragment", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 32, minQuantity: 2, maxQuantity: 6, dropRate: 90 }],
    [EnemyType.AncientDragon]: [{ itemId: "ecailles_dragon", name: "Dragon Scales", category: ItemCategory.Materials, rarity: ItemRarity.Legendary, maxStack: 64, minQuantity: 3, maxQuantity: 8, dropRate: 100 }, { itemId: "griffe_dragon", name: "Dragon Claw", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 50 }, { itemId: "orbe_draconique", name: "Draconic Orb", category: ItemCategory.Valuables, rarity: ItemRarity.Legendary, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 15 }],
    [EnemyType.Hydra]: [{ itemId: "ecaille_hydre", name: "Hydra Scale", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 32, minQuantity: 2, maxQuantity: 5, dropRate: 80 }, { itemId: "venin_mortel", name: "Deadly Venom", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 16, minQuantity: 1, maxQuantity: 3, dropRate: 60 }, { itemId: "dent_hydre", name: "Hydra Tooth", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 40 }]
};

export default class EnemyEntity {
    readonly #logger = new Logger({ context: "EnemyEntity" });
    public drops: EnemyDrop[] = [];
    private hasDropped = false;

    constructor(public readonly type: EnemyType, public readonly name: string, public health: number, public readonly maxHealth: number, public readonly strength: number, public readonly defense: number, public readonly experience: number, public readonly gold: number) {}

    /**
     * Applies damage to the enemy and returns the actual damage dealt.
     * @param damage The incoming damage amount.
     * @returns The actual damage dealt.
     */
    public takeDamage(damage: number): number {
        const finalDamage = Math.max(1, damage - Math.floor(this.defense / 2));
        const previousHealth = this.health;
        this.health = Math.max(0, this.health - finalDamage);
        if (previousHealth > 0 && !this.isAlive() && !this.hasDropped) {
            this.hasDropped = true;
            this.drops = this.rollDrops();
        }
        return finalDamage;
    }

    /**
     * Restores the enemy's health.
     * @param amount The amount of health to restore.
     * @returns The enemy's current health.
     */
    public heal(amount: number): number {
        this.health = Math.min(this.maxHealth, this.health + Math.max(0, amount));
        this.#logger.debug(`${this.name} heals for ${amount} HP (current HP: ${this.health}/${this.maxHealth}).`);
        return this.health;
    }

    /**
     * Resets the enemy's health and loot state.
     * @returns The enemy's current health.
     */
    public resetHealth(): number {
        this.health = this.maxHealth;
        this.hasDropped = false;
        this.drops = [];
        this.#logger.debug(`${this.name}'s health has been fully reset to ${this.maxHealth} HP.`);
        return this.health;
    }

    /**
     * Checks whether the enemy is alive.
     * @returns True when the enemy has more than zero health.
     */
    public isAlive(): boolean {
        return this.health > 0;
    }

    /**
     * Gets the enemy's current health ratio.
     * @returns The current health ratio between 0 and 1.
     */
    public get healthRatio(): number {
        return this.maxHealth > 0 ? this.health / this.maxHealth : 0;
    }

    /**
     * Rolls the loot table for the enemy.
     * @returns The items dropped by the enemy.
     */
    public rollDrops(): EnemyDrop[] {
        const lootTable = ENEMY_LOOT_TABLES[this.type];
        if (!lootTable) {
            return [];
        }
        const droppedItems: EnemyDrop[] = [];
        for (const loot of lootTable) {
            if (Math.random() * 100 > loot.dropRate) {
                continue;
            }
            const quantity = Math.floor(Math.random() * (loot.maxQuantity - loot.minQuantity + 1)) + loot.minQuantity;
            droppedItems.push({ itemId: loot.itemId, quantity });
            this.#logger.debug(`${this.name} dropped ${quantity}x ${loot.itemId}.`);
        }
        return droppedItems;
    }
}
