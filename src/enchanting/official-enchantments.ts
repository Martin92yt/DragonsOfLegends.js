import { ItemCategory } from "../inventory/item.enum.js";
import { ENCHANTING_JOB_ID, type EnchantmentDefinition } from "./enchantment.types.js";
import type { JobDefinition } from "../jobs/job.types.js";

/**
 * Lifesteal: each blow heals the player by a percentage of the enemy's maximum health, per level carried.
 * The percentage is the `percentOfEnemyMaxHealth` parameter (3), so a pack can rebalance it without new code.
 */
export const LIFESTEAL: EnchantmentDefinition = {
    id: "lifesteal",
    name: "Lifesteal",
    description: "Heals you for 3% of the enemy's health per level each time you strike.",
    appliesTo: { categories: [ItemCategory.Weapons] },
    params: { percentOfEnemyMaxHealth: 3 },
    levels: [
        { requiredJobLevel: 1, gold: 150, playerXp: 20 },
        { requiredJobLevel: 5, gold: 600, playerXp: 80, materials: [{ itemId: "resin", quantity: 3 }] },
        { requiredJobLevel: 10, gold: 2000, playerXp: 250, materials: [{ itemId: "amber", quantity: 1 }] }
    ],
    hooks: {
        onAttack: ({ player, enemy, totalLevel, definition }) => {
            const percent = definition.params?.["percentOfEnemyMaxHealth"] ?? 3;
            const amount = Math.max(1, Math.floor((enemy.maxHealth * percent * totalLevel) / 100));
            player.heal(amount, "enchantment:lifesteal");
        }
    }
};

/**
 * Mending: gaining experience repairs the worn items that carry it, `repairPerXp` durability points per experience
 * point and per level.
 */
export const MENDING: EnchantmentDefinition = {
    id: "mending",
    name: "Mending",
    description: "Experience you gain repairs this item.",
    appliesTo: { categories: [ItemCategory.Weapons, ItemCategory.Armor, ItemCategory.Tool] },
    params: { repairPerXp: 2 },
    levels: [
        { requiredJobLevel: 3, playerXp: 50, materials: [{ itemId: "resin", quantity: 2 }] },
        { requiredJobLevel: 8, playerXp: 200, materials: [{ itemId: "resin", quantity: 5 }, { itemId: "amber", quantity: 1 }] }
    ],
    hooks: {
        onExperienceGain: async ({ world, player, carriers, definition, amount, markDirty }) => {
            const perXp = definition.params?.["repairPerXp"] ?? 2;
            for (const { item, level } of carriers) {
                if ((await world.enchanting.repair(player, item, amount * perXp * level, "enchantment:mending")) > 0) markDirty();
            }
        }
    }
};

export const OFFICIAL_ENCHANTMENTS: readonly EnchantmentDefinition[] = [LIFESTEAL, MENDING];

/**
 * The enchanter trade: its experience comes from enchanting items.
 */
export const ENCHANTING_JOB: JobDefinition = {
    id: ENCHANTING_JOB_ID,
    name: "Enchanting",
    description: "Imbue equipment with magic. Experience comes from enchanting items.",
    passive: true,
    actions: []
};
