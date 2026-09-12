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

// Table de loot associée à chaque type de monstre avec des objets de type LootItem complets
const ENEMY_LOOT_TABLES: Record<EnemyType, LootItem[]> = {
    [EnemyType.Slime]: [
        { itemId: "bave_de_slime", name: "Bave de slime", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 35.0 },
        { itemId: "noyau_gelatineux", name: "Noyau gélatineux", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 1, dropRate: 5.0 }
    ],
    [EnemyType.Skeleton]: [
        { itemId: "os", name: "Os", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 3, dropRate: 50.0 },
        { itemId: "crane_fissure", name: "Crâne fissuré", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 15.0 },
        { itemId: "arc_ancien", name: "Arc ancien", category: ItemCategory.Weapons, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8.0 }
    ],
    [EnemyType.Goblin]: [
        { itemId: "dague_rouillee", name: "Dague rouillée", category: ItemCategory.Weapons, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 20.0 },
        { itemId: "oreille_gobelin", name: "Oreille de gobelin", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 40.0 },
        { itemId: "bourse_de_trous", name: "Bourse de trous", category: ItemCategory.Valuables, rarity: ItemRarity.Uncommon, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10.0 }
    ],
    [EnemyType.Wolf]: [
        { itemId: "fourrure_loup", name: "Fourrure de loup", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 45.0 },
        { itemId: "croc_de_loup", name: "Croc de loup", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 35.0 },
        { itemId: "viande_crue", name: "Viande crue", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 60.0 }
    ],
    [EnemyType.Bandit]: [
        { itemId: "piece_or", name: "Pièce d'or", category: ItemCategory.Valuables, rarity: ItemRarity.Common, maxStack: 999, minQuantity: 2, maxQuantity: 8, dropRate: 70.0 },
        { itemId: "dague_rouillee", name: "Dague rouillée", category: ItemCategory.Weapons, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 15.0 },
        { itemId: "chapeau_dechire", name: "Chapeau déchiré", category: ItemCategory.Armor, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10.0 }
    ],
    [EnemyType.GiantRat]: [
        { itemId: "queue_de_rat", name: "Queue de rat", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 50.0 },
        { itemId: "viande_crue", name: "Viande crue", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 30.0 }
    ],
    [EnemyType.WildBoar]: [
        { itemId: "viande_crue", name: "Viande crue", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 70.0 },
        { itemId: "defense_sanglier", name: "Défense de sanglier", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 30.0 },
        { itemId: "cuir_epais", name: "Cuir épais", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 25.0 }
    ],
    [EnemyType.Spider]: [
        { itemId: "venin_araignee", name: "Venin d'araignée", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 16, minQuantity: 1, maxQuantity: 1, dropRate: 35.0 },
        { itemId: "soie_araignee", name: "Soie d'araignée", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 3, dropRate: 50.0 }
    ],
    [EnemyType.Orc]: [
        { itemId: "hache_orc", name: "Hache orque", category: ItemCategory.Weapons, rarity: ItemRarity.Uncommon, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 12.0 },
        { itemId: "dent_orque", name: "Dent d'orque", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 1, dropRate: 40.0 },
        { itemId: "viande_crue", name: "Viande crue", category: ItemCategory.Consumables, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 50.0 }
    ],
    [EnemyType.Ghost]: [
        { itemId: "ectoplasme", name: "Ectoplasme", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 40.0 },
        { itemId: "poussiere_spectrale", name: "Poussière spectrale", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 32, minQuantity: 1, maxQuantity: 1, dropRate: 20.0 }
    ],
    [EnemyType.Zombie]: [
        { itemId: "chair_putrefiee", name: "Chair putréfiée", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 60.0 },
        { itemId: "os", name: "Os", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 1, maxQuantity: 2, dropRate: 30.0 },
        { itemId: "chapeau_dechire", name: "Chapeau déchiré", category: ItemCategory.Armor, rarity: ItemRarity.Common, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10.0 }
    ],
    [EnemyType.DarkCultist]: [
        { itemId: "robe_sombre", name: "Robe sombre", category: ItemCategory.Armor, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 15.0 },
        { itemId: "grimoire_maudit", name: "Grimoire maudit", category: ItemCategory.Valuables, rarity: ItemRarity.Epic, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 8.0 },
        { itemId: "bougie_noire", name: "Bougie noire", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 3, dropRate: 45.0 }
    ],
    [EnemyType.Troll]: [
        { itemId: "masse_en_pierre", name: "Masse en pierre", category: ItemCategory.Weapons, rarity: ItemRarity.Uncommon, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 15.0 },
        { itemId: "sang_de_troll", name: "Sang de troll", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 50.0 },
        { itemId: "pepite_pierre", name: "Pépite de pierre", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 2, maxQuantity: 5, dropRate: 60.0 }
    ],
    [EnemyType.Minotaur]: [
        { itemId: "hache_minotaure", name: "Hache du minotaure", category: ItemCategory.Weapons, rarity: ItemRarity.Epic, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10.0 },
        { itemId: "corne_minotaure", name: "Corne de minotaure", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 40.0 },
        { itemId: "cuir_epais", name: "Cuir épais", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 32, minQuantity: 2, maxQuantity: 4, dropRate: 70.0 }
    ],
    [EnemyType.Vampire]: [
        { itemId: "cape_satin_noir", name: "Cape en satin noir", category: ItemCategory.Armor, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 15.0 },
        { itemId: "crocs_vampire", name: "Crocs de vampire", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 35.0 },
        { itemId: "fiole_sang_pur", name: "Fiole de sang pur", category: ItemCategory.Consumables, rarity: ItemRarity.Epic, maxStack: 8, minQuantity: 1, maxQuantity: 1, dropRate: 25.0 }
    ],
    [EnemyType.Witch]: [
        { itemId: "potion_magique", name: "Potion magique", category: ItemCategory.Consumables, rarity: ItemRarity.Uncommon, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 40.0 },
        { itemId: "plante_veneneuse", name: "Plante vénéneuse", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 32, minQuantity: 1, maxQuantity: 3, dropRate: 50.0 },
        { itemId: "chapeau_sorciere", name: "Chapeau de sorcière", category: ItemCategory.Armor, rarity: ItemRarity.Rare, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10.0 }
    ],
    [EnemyType.StoneGolem]: [
        { itemId: "pierre_magique", name: "Pierre magique", category: ItemCategory.Materials, rarity: ItemRarity.Uncommon, maxStack: 64, minQuantity: 1, maxQuantity: 3, dropRate: 60.0 },
        { itemId: "fragment_golem", name: "Fragment de golem", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 32, minQuantity: 1, maxQuantity: 2, dropRate: 40.0 },
        { itemId: "noyau_elementaire", name: "Noyau élémentaire", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 4, minQuantity: 1, maxQuantity: 1, dropRate: 5.0 }
    ],
    [EnemyType.Lich]: [
        { itemId: "phylactere_brise", name: "Phylactère brisé", category: ItemCategory.Valuables, rarity: ItemRarity.Legendary, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 5.0 },
        { itemId: "baton_sombre", name: "Bâton sombre", category: ItemCategory.Weapons, rarity: ItemRarity.Epic, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10.0 },
        { itemId: "poussiere_detite", name: "Poussière d'étoile", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 64, minQuantity: 2, maxQuantity: 5, dropRate: 80.0 }
    ],
    [EnemyType.DemonLord]: [
        { itemId: "coeur_demon", name: "Cœur de démon", category: ItemCategory.Materials, rarity: ItemRarity.Legendary, maxStack: 4, minQuantity: 1, maxQuantity: 1, dropRate: 25.0 },
        { itemId: "epee_demoniaque", name: "Épée démoniaque", category: ItemCategory.Weapons, rarity: ItemRarity.Legendary, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 10.0 },
        { itemId: "fragment_infernal", name: "Fragment infernal", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 32, minQuantity: 2, maxQuantity: 6, dropRate: 90.0 }
    ],
    [EnemyType.AncientDragon]: [
        { itemId: "ecailles_dragon", name: "Écailles de dragon", category: ItemCategory.Materials, rarity: ItemRarity.Legendary, maxStack: 64, minQuantity: 3, maxQuantity: 8, dropRate: 100.0 },
        { itemId: "griffe_dragon", name: "Griffe de dragon", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 50.0 },
        { itemId: "orbe_draconique", name: "Orbe draconique", category: ItemCategory.Valuables, rarity: ItemRarity.Legendary, maxStack: 1, minQuantity: 1, maxQuantity: 1, dropRate: 15.0 }
    ],
    [EnemyType.Hydra]: [
        { itemId: "ecaille_hydre", name: "Écaille d'hydre", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 32, minQuantity: 2, maxQuantity: 5, dropRate: 80.0 },
        { itemId: "venin_mortel", name: "Venin mortel", category: ItemCategory.Materials, rarity: ItemRarity.Epic, maxStack: 16, minQuantity: 1, maxQuantity: 3, dropRate: 60.0 },
        { itemId: "dent_hydre", name: "Dent d'hydre", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 16, minQuantity: 1, maxQuantity: 2, dropRate: 40.0 }
    ]
};

export default class EnemyEntity {
    private readonly logger = new Logger({ context: "EnemyEntity" });

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

    public rollDrops(): { itemId: string; quantity: number }[] {
        const possibleLoots = ENEMY_LOOT_TABLES[this.type] || [];
        const droppedItems: { itemId: string; quantity: number }[] = [];

        for (const loot of possibleLoots) {
            const roll = Math.random() * 100;
            if (roll <= loot.dropRate) {
                const quantity = Math.floor(Math.random() * (loot.maxQuantity - loot.minQuantity + 1)) + loot.minQuantity;
                droppedItems.push({ ...loot, quantity });
                this.logger.debug(`${this.name} dropped ${quantity}x ${loot.itemId} (roll=${roll.toFixed(2)}, chance=${loot.dropRate})`);
            }
        }

        return droppedItems;
    }
}