import type { EffectDefinition } from "../effects/effect.types.js";
import { createAmuletNbt } from "../inventory/amulet.js";
import type { Item } from "../inventory/inventory.interface.js";
import { ItemCategory, ItemRarity } from "../inventory/item.enum.js";
import type { LootboxDefinition } from "../lootbox/lootbox.types.js";
import type { ShopDefinition } from "../shop/shop.types.js";

/**
 * Official temporary effects. A potion is an item pointing at one of them (`use.effects`).
 */
export const OFFICIAL_EFFECTS: readonly EffectDefinition[] = [
    {
        id: "regeneration",
        name: "Regeneration",
        description: "Restores 10 health points every second for 60 seconds.",
        durationMs: 60_000,
        tick: { intervalMs: 1_000, heal: 10 }
    },
    {
        id: "xp_boost",
        name: "Experience Boost",
        description: "Doubles the experience gained for 15 minutes.",
        durationMs: 15 * 60_000,
        modifiers: { xpMultiplier: 2 }
    }
];

/**
 * Official items: the starter equipment, potions, amulets and lootboxes (mystery pouches).
 */
export const OFFICIAL_ITEMS: readonly Item[] = [
    // Starter equipment (the default `starterItems` of a world).
    {
        itemId: "health_potion",
        name: "Health Potion",
        category: ItemCategory.Consumables,
        rarity: ItemRarity.Common,
        maxStack: 16,
        description: "Instantly restores 30 health points.",
        use: { heal: 30 }
    },
    {
        itemId: "rusty_sword",
        name: "Rusty Sword",
        category: ItemCategory.Weapons,
        rarity: ItemRarity.Common,
        maxStack: 1,
        description: "A worn blade, better than bare hands.",
        defaultNbt: { damageBonus: 2, durability: 100 }
    },
    {
        itemId: "iron_sword",
        name: "Iron Sword",
        category: ItemCategory.Weapons,
        rarity: ItemRarity.Uncommon,
        maxStack: 1,
        description: "A reliable iron blade.",
        defaultNbt: { damageBonus: 6, durability: 100 }
    },
    {
        itemId: "steel_sword",
        name: "Steel Sword",
        category: ItemCategory.Weapons,
        rarity: ItemRarity.Rare,
        maxStack: 1,
        description: "A well-balanced steel blade.",
        defaultNbt: { damageBonus: 12, durability: 150 }
    },
    // Potions.
    {
        itemId: "regeneration_potion",
        name: "Regeneration Potion",
        category: ItemCategory.Consumables,
        rarity: ItemRarity.Uncommon,
        maxStack: 16,
        description: "Restores 10 health points per second for 60 seconds.",
        use: { effects: ["regeneration"] }
    },
    {
        itemId: "xp_boost_potion",
        name: "Experience Potion",
        category: ItemCategory.Consumables,
        rarity: ItemRarity.Rare,
        maxStack: 16,
        description: "Doubles the experience gained for 15 minutes.",
        use: { effects: ["xp_boost"] }
    },
    // Amulets (worn in the amulet slots).
    {
        itemId: "luck_amulet",
        name: "Amulet of Luck",
        category: ItemCategory.Amulet,
        rarity: ItemRarity.Uncommon,
        maxStack: 1,
        description: "+10% luck: better loot and rarer drops.",
        defaultNbt: createAmuletNbt({ luckPercent: 10 })
    },
    {
        itemId: "xp_amulet",
        name: "Amulet of Wisdom",
        category: ItemCategory.Amulet,
        rarity: ItemRarity.Uncommon,
        maxStack: 1,
        description: "+10% experience gained while worn.",
        defaultNbt: createAmuletNbt({ xpPercent: 10 })
    },
    {
        itemId: "critical_amulet",
        name: "Amulet of Precision",
        category: ItemCategory.Amulet,
        rarity: ItemRarity.Rare,
        maxStack: 1,
        description: "+5% critical hit chance.",
        defaultNbt: createAmuletNbt({ critRatePercent: 5 })
    },
    // Lootboxes (mystery pouches): opened with `inventory.use`.
    ...(["common", "rare", "epic", "legendary"] as const).map((tier): Item => ({
        itemId: `pouch_${tier}`,
        name: `${tier[0]?.toUpperCase()}${tier.slice(1)} Pouch`,
        category: ItemCategory.Consumables,
        rarity: tier === "common" ? ItemRarity.Common : (tier as ItemRarity),
        maxStack: 32,
        description: "A mystery pouch: open it to discover what is inside.",
        use: { lootbox: `pouch_${tier}` }
    }))
];

/**
 * Official lootboxes: the higher the tier, the better the table (weights are relative, not percentages).
 */
export const OFFICIAL_LOOTBOXES: readonly LootboxDefinition[] = [
    {
        id: "pouch_common",
        name: "Common Pouch",
        rarity: ItemRarity.Common,
        drops: [
            { kind: "gold", weight: 50, minAmount: 20, maxAmount: 60 },
            { kind: "item", itemId: "health_potion", weight: 30, minQuantity: 1, maxQuantity: 2 },
            { kind: "item", itemId: "regeneration_potion", weight: 12, minQuantity: 1, maxQuantity: 1 },
            { kind: "item", itemId: "luck_amulet", weight: 4, minQuantity: 1, maxQuantity: 1 },
            { kind: "item", itemId: "xp_amulet", weight: 4, minQuantity: 1, maxQuantity: 1 }
        ]
    },
    {
        id: "pouch_rare",
        name: "Rare Pouch",
        rarity: ItemRarity.Rare,
        drops: [
            { kind: "gold", weight: 40, minAmount: 100, maxAmount: 300 },
            { kind: "item", itemId: "regeneration_potion", weight: 22, minQuantity: 1, maxQuantity: 3 },
            { kind: "item", itemId: "xp_boost_potion", weight: 14, minQuantity: 1, maxQuantity: 1 },
            { kind: "item", itemId: "iron_sword", weight: 10, minQuantity: 1, maxQuantity: 1 },
            { kind: "item", itemId: "luck_amulet", weight: 5, minQuantity: 1, maxQuantity: 1 },
            { kind: "item", itemId: "xp_amulet", weight: 5, minQuantity: 1, maxQuantity: 1 },
            { kind: "item", itemId: "critical_amulet", weight: 4, minQuantity: 1, maxQuantity: 1 }
        ]
    },
    {
        id: "pouch_epic",
        name: "Epic Pouch",
        rarity: ItemRarity.Epic,
        rolls: 2,
        drops: [
            { kind: "gold", weight: 35, minAmount: 300, maxAmount: 800 },
            { kind: "item", itemId: "xp_boost_potion", weight: 22, minQuantity: 1, maxQuantity: 2 },
            { kind: "item", itemId: "steel_sword", weight: 15, minQuantity: 1, maxQuantity: 1 },
            { kind: "item", itemId: "critical_amulet", weight: 14, minQuantity: 1, maxQuantity: 1 },
            { kind: "item", itemId: "luck_amulet", weight: 7, minQuantity: 1, maxQuantity: 1 },
            { kind: "item", itemId: "xp_amulet", weight: 7, minQuantity: 1, maxQuantity: 1 }
        ]
    },
    {
        id: "pouch_legendary",
        name: "Legendary Pouch",
        rarity: ItemRarity.Legendary,
        rolls: 3,
        drops: [
            { kind: "gold", weight: 30, minAmount: 1_000, maxAmount: 3_000 },
            { kind: "item", itemId: "steel_sword", weight: 20, minQuantity: 1, maxQuantity: 1 },
            { kind: "item", itemId: "xp_boost_potion", weight: 20, minQuantity: 2, maxQuantity: 4 },
            { kind: "item", itemId: "critical_amulet", weight: 10, minQuantity: 1, maxQuantity: 1 },
            { kind: "item", itemId: "luck_amulet", weight: 10, minQuantity: 1, maxQuantity: 1 },
            { kind: "item", itemId: "xp_amulet", weight: 10, minQuantity: 1, maxQuantity: 1 }
        ]
    }
];

/**
 * Official shops. A sale price is always below the purchase price, so buying then selling never creates gold.
 */
export const OFFICIAL_SHOPS: readonly ShopDefinition[] = [
    {
        id: "general_store",
        name: "General Store",
        description: "Potions, basic equipment and mystery pouches.",
        listings: [
            { itemId: "health_potion", price: 25, sellPrice: 10 },
            { itemId: "regeneration_potion", price: 80, sellPrice: 30 },
            { itemId: "xp_boost_potion", price: 250, sellPrice: 100, minLevel: 3 },
            { itemId: "rusty_sword", price: 40, sellPrice: 15 },
            { itemId: "iron_sword", price: 250, sellPrice: 100, minLevel: 5 },
            { itemId: "luck_amulet", price: 500, sellPrice: 200, minLevel: 5 },
            { itemId: "xp_amulet", price: 500, sellPrice: 200, minLevel: 5 },
            { itemId: "critical_amulet", price: 700, sellPrice: 280, minLevel: 8 },
            { itemId: "pouch_common", price: 100, sellPrice: 40 },
            { itemId: "pouch_rare", price: 600, sellPrice: 250, minLevel: 10 }
        ]
    }
];
