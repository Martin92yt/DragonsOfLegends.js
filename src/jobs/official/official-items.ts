import type { Item } from "../../inventory/inventory.interface.js";
import { ItemCategory, ItemRarity } from "../../inventory/item.enum.js";
import { createJobToolNbt, type JobReward, type ToolModifiers } from "../job.types.js";

/**
 * Builds an item definition for the official jobs.
 *
 * @param itemId The item identifier.
 * @param name The display name.
 * @param category The item category.
 * @param rarity The item rarity (drives how much luck boosts the loot entry).
 * @param maxStack The maximum stack size.
 * @param description An optional description.
 * @returns The item.
 */
export function item(itemId: string, name: string, category: ItemCategory, rarity: ItemRarity, maxStack: number, description?: string): Item {
    return { itemId, name, category, rarity, maxStack, ...(description ? { description } : {}) };
}

/**
 * Builds a level reward granting one tool of a job.
 *
 * @param jobId The job the tool belongs to.
 * @param itemId The tool item identifier.
 * @param name The display name.
 * @param rarity The tool rarity.
 * @param description A human-readable summary of the modifiers.
 * @param modifiers The stat modifiers of the tool, in percent.
 * @returns A reward of kind `item`.
 */
export function toolReward(jobId: string, itemId: string, name: string, rarity: ItemRarity, description: string, modifiers: Partial<ToolModifiers>): JobReward {
    return { kind: "item", item: item(itemId, name, ItemCategory.Tool, rarity, 1, description), quantity: 1, nbt: createJobToolNbt(jobId, modifiers) };
}
