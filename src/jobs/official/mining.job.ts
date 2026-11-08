import { ItemCategory, ItemRarity } from "../../inventory/item.enum.js";
import type { JobDefinition } from "../job.types.js";
import { item, toolReward } from "./official-items.js";

/**
 * Mining: `/mine` for common ores, `/deep_mine` (level 10, pickaxe required) for precious ones.
 * Pickaxes improve luck (rarer ores), yield (more ore per swing), experience and cooldown.
 */
export const MINING_JOB: JobDefinition = {
    id: "mining",
    name: "Mining",
    description: "Dig for ore, from humble coal to gleaming titanium.",
    actions: [
        {
            id: "mine",
            name: "Mine",
            description: "Swing your pickaxe at the nearest vein.",
            // Rationale: 20s keeps mining slightly faster than fishing, since ore stacks are lower value.
            cooldownMs: 20_000,
            xp: 12,
            loot: [
                { item: item("stone", "Stone", ItemCategory.Materials, ItemRarity.Common, 64), weight: 45, minQuantity: 2, maxQuantity: 5 },
                { item: item("coal", "Coal", ItemCategory.Materials, ItemRarity.Common, 64), weight: 30, minQuantity: 1, maxQuantity: 3 },
                { item: item("copper_ore", "Copper Ore", ItemCategory.Materials, ItemRarity.Uncommon, 64), weight: 15, minQuantity: 1, maxQuantity: 2 },
                { item: item("iron_ore", "Iron Ore", ItemCategory.Materials, ItemRarity.Uncommon, 64), weight: 8, minQuantity: 1, maxQuantity: 2, minLevel: 3 },
                { item: item("gold_ore", "Gold Ore", ItemCategory.Valuables, ItemRarity.Rare, 32), weight: 5, minQuantity: 1, maxQuantity: 1, minLevel: 6 },
                { item: item("titanium_ore", "Titanium Ore", ItemCategory.Valuables, ItemRarity.Epic, 16), weight: 2, minQuantity: 1, maxQuantity: 1, minLevel: 15 },
                { item: item("star_diamond", "Star Diamond", ItemCategory.Valuables, ItemRarity.Legendary, 8), weight: 1, minQuantity: 1, maxQuantity: 1, minLevel: 25 }
            ]
        },
        {
            id: "deep_mine",
            name: "Deep mine",
            description: "Descend into the deep galleries. Requires a pickaxe.",
            // Rationale: a long cooldown, three rolls and a pickaxe requirement make it a high-risk, high-reward burst action.
            cooldownMs: 120_000,
            xp: 45,
            requiredLevel: 10,
            requiresTool: true,
            rolls: 3,
            loot: [
                { item: item("iron_ore", "Iron Ore", ItemCategory.Materials, ItemRarity.Uncommon, 64), weight: 40, minQuantity: 2, maxQuantity: 4 },
                { item: item("gold_ore", "Gold Ore", ItemCategory.Valuables, ItemRarity.Rare, 32), weight: 30, minQuantity: 1, maxQuantity: 3 },
                { item: item("titanium_ore", "Titanium Ore", ItemCategory.Valuables, ItemRarity.Epic, 16), weight: 15, minQuantity: 1, maxQuantity: 2, minLevel: 15 },
                { item: item("star_diamond", "Star Diamond", ItemCategory.Valuables, ItemRarity.Legendary, 8), weight: 3, minQuantity: 1, maxQuantity: 1, minLevel: 25 }
            ]
        }
    ],
    levelRewards: [
        { level: 2, rewards: [toolReward("mining", "wooden_pickaxe", "Wooden Pickaxe", ItemRarity.Common, "Yield +10%", { yieldBonus: 10 })] },
        { level: 5, rewards: [{ kind: "gold", amount: 100 }, toolReward("mining", "iron_pickaxe", "Iron Pickaxe", ItemRarity.Uncommon, "Luck +10%, yield +15%", { luck: 10, yieldBonus: 15 })] },
        {
            level: 10,
            rewards: [
                { kind: "gold", amount: 300 },
                toolReward("mining", "golden_pickaxe", "Golden Pickaxe", ItemRarity.Rare, "Luck +20%, yield +25%, cooldown -10%", { luck: 20, yieldBonus: 25, cooldownReduction: 10 })
            ]
        },
        {
            level: 20,
            rewards: [
                { kind: "gold", amount: 1000 },
                toolReward("mining", "titanium_pickaxe", "Titanium Pickaxe", ItemRarity.Legendary, "Luck +40%, yield +50%, XP +25%, cooldown -20%", { luck: 40, yieldBonus: 50, xpBonus: 25, cooldownReduction: 20 })
            ]
        }
    ]
};
