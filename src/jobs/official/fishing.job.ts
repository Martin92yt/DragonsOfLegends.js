import { ItemCategory, ItemRarity } from "../../inventory/item.enum.js";
import type { JobDefinition } from "../job.types.js";
import { item, toolReward } from "./official-items.js";

/**
 * Fishing: the `/fish` action, with rods that improve luck, experience and cooldown.
 */
export const FISHING_JOB: JobDefinition = {
    id: "fishing",
    name: "Fishing",
    description: "Cast your line and see what bites.",
    actions: [
        {
            id: "fish",
            name: "Fish",
            description: "Throw a line in the nearest water.",
            // Rationale: 30s between casts keeps the loop relaxed for a chat bot without allowing spam farming.
            cooldownMs: 30_000,
            xp: 10,
            loot: [
                { item: item("raw_fish", "Raw Fish", ItemCategory.Materials, ItemRarity.Common, 64), weight: 60, minQuantity: 1, maxQuantity: 3 },
                { item: item("river_trout", "River Trout", ItemCategory.Materials, ItemRarity.Uncommon, 64), weight: 25, minQuantity: 1, maxQuantity: 2 },
                { item: item("golden_carp", "Golden Carp", ItemCategory.Valuables, ItemRarity.Rare, 32), weight: 10, minQuantity: 1, maxQuantity: 1, minLevel: 3 },
                { item: item("abyssal_eel", "Abyssal Eel", ItemCategory.Valuables, ItemRarity.Epic, 16), weight: 4, minQuantity: 1, maxQuantity: 1, minLevel: 10 },
                { item: item("leviathan_pearl", "Leviathan Pearl", ItemCategory.Valuables, ItemRarity.Legendary, 8), weight: 1, minQuantity: 1, maxQuantity: 1, minLevel: 20 }
            ]
        }
    ],
    levelRewards: [
        { level: 2, rewards: [toolReward("fishing", "wooden_fishing_rod", "Wooden Fishing Rod", ItemRarity.Common, "Luck +5%", { luck: 5 })] },
        { level: 5, rewards: [{ kind: "gold", amount: 100 }, toolReward("fishing", "iron_fishing_rod", "Iron Fishing Rod", ItemRarity.Uncommon, "Luck +10%", { luck: 10 })] },
        { level: 10, rewards: [{ kind: "gold", amount: 300 }, toolReward("fishing", "golden_fishing_rod", "Golden Fishing Rod", ItemRarity.Rare, "Luck +25%, cooldown -10%", { luck: 25, cooldownReduction: 10 })] },
        {
            level: 20,
            rewards: [
                { kind: "gold", amount: 1000 },
                toolReward("fishing", "legendary_fishing_rod", "Legendary Fishing Rod", ItemRarity.Legendary, "Luck +50%, XP +25%, cooldown -20%", { luck: 50, xpBonus: 25, cooldownReduction: 20 })
            ]
        }
    ]
};
