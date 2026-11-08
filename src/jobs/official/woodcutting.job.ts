import { ItemCategory, ItemRarity } from "../../inventory/item.enum.js";
import type { JobDefinition } from "../job.types.js";
import { item, toolReward } from "./official-items.js";

/**
 * Woodcutting: `/chop` for logs, `/gather_branches` for branches and forest by-products.
 * Axes improve luck (rarer woods), yield, experience and cooldown.
 */
export const WOODCUTTING_JOB: JobDefinition = {
    id: "woodcutting",
    name: "Woodcutting",
    description: "Fell trees and gather what the forest offers.",
    actions: [
        {
            id: "chop",
            name: "Chop",
            description: "Fell a nearby tree.",
            // Rationale: 15s, the fastest official loop, because logs are the lowest value resource.
            cooldownMs: 15_000,
            xp: 8,
            loot: [
                { item: item("oak_log", "Oak Log", ItemCategory.Materials, ItemRarity.Common, 64), weight: 50, minQuantity: 1, maxQuantity: 4 },
                { item: item("birch_log", "Birch Log", ItemCategory.Materials, ItemRarity.Common, 64), weight: 30, minQuantity: 1, maxQuantity: 3 },
                { item: item("pine_log", "Pine Log", ItemCategory.Materials, ItemRarity.Uncommon, 64), weight: 14, minQuantity: 1, maxQuantity: 3, minLevel: 3 },
                { item: item("ironwood_log", "Ironwood Log", ItemCategory.Valuables, ItemRarity.Rare, 32), weight: 5, minQuantity: 1, maxQuantity: 2, minLevel: 8 },
                { item: item("heartwood_log", "Ancient Heartwood", ItemCategory.Valuables, ItemRarity.Legendary, 8), weight: 1, minQuantity: 1, maxQuantity: 1, minLevel: 25 }
            ]
        },
        {
            id: "gather_branches",
            name: "Gather branches",
            description: "Collect branches, bark and resin without felling a tree.",
            cooldownMs: 10_000,
            xp: 4,
            loot: [
                { item: item("branch", "Branch", ItemCategory.Materials, ItemRarity.Common, 64), weight: 65, minQuantity: 2, maxQuantity: 6 },
                { item: item("bark", "Bark", ItemCategory.Materials, ItemRarity.Common, 64), weight: 25, minQuantity: 1, maxQuantity: 3 },
                { item: item("resin", "Resin", ItemCategory.Materials, ItemRarity.Uncommon, 64), weight: 8, minQuantity: 1, maxQuantity: 2, minLevel: 2 },
                { item: item("amber", "Amber", ItemCategory.Valuables, ItemRarity.Epic, 16), weight: 2, minQuantity: 1, maxQuantity: 1, minLevel: 12 }
            ]
        }
    ],
    levelRewards: [
        { level: 2, rewards: [toolReward("woodcutting", "wooden_axe", "Wooden Axe", ItemRarity.Common, "Yield +10%", { yieldBonus: 10 })] },
        { level: 5, rewards: [{ kind: "gold", amount: 100 }, toolReward("woodcutting", "iron_axe", "Iron Axe", ItemRarity.Uncommon, "Luck +10%, yield +15%", { luck: 10, yieldBonus: 15 })] },
        {
            level: 10,
            rewards: [
                { kind: "gold", amount: 300 },
                toolReward("woodcutting", "steel_axe", "Steel Axe", ItemRarity.Rare, "Luck +20%, yield +25%, cooldown -10%", { luck: 20, yieldBonus: 25, cooldownReduction: 10 })
            ]
        },
        {
            level: 20,
            rewards: [
                { kind: "gold", amount: 1000 },
                toolReward("woodcutting", "worldtree_axe", "Worldtree Axe", ItemRarity.Legendary, "Luck +40%, yield +50%, XP +25%, cooldown -20%", { luck: 40, yieldBonus: 50, xpBonus: 25, cooldownReduction: 20 })
            ]
        }
    ]
};
