import type { InventoryItemRecord } from "./inventory.interface.js";

/**
 * Stats a player needs to wear an item. Every field is optional; a missing field means "no requirement".
 * Declare it in the item data: `defaultNbt: { damageBonus: 6, requirements: { intelligence: 10 } }`.
 */
export interface EquipRequirements {
    /** Minimum player level. */
    readonly level?: number;
    readonly strength?: number;
    readonly agility?: number;
    readonly intelligence?: number;
    readonly defense?: number;
}

/** The stats an equip requirement can target. */
export type RequirementStat = keyof EquipRequirements;

/** Key of the item data that holds the {@link EquipRequirements} of an item. */
export const EQUIP_REQUIREMENTS_NBT_KEY = "requirements";

const REQUIREMENT_STATS: readonly RequirementStat[] = ["level", "strength", "agility", "intelligence", "defense"];

/**
 * One requirement the player does not meet.
 */
export interface UnmetRequirement {
    readonly stat: RequirementStat;
    /** The minimum the item asks for. */
    readonly required: number;
    /** What the player has. */
    readonly actual: number;
}

/**
 * Reads the requirements of an item (record or item data), ignoring malformed values.
 *
 * @param source The inventory record, or its item data.
 * @returns The valid requirements (empty when the item has none).
 */
export function readEquipRequirements(source: Pick<InventoryItemRecord, "itemNbtData"> | Record<string, unknown> | undefined): EquipRequirements {
    const nbt = (source && "itemNbtData" in source ? source.itemNbtData : source) as Record<string, unknown> | undefined;
    const raw = nbt?.[EQUIP_REQUIREMENTS_NBT_KEY];
    const requirements: Partial<Record<RequirementStat, number>> = {};
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return requirements;
    for (const stat of REQUIREMENT_STATS) {
        const value = (raw as Record<string, unknown>)[stat];
        if (typeof value === "number" && Number.isFinite(value) && value > 0) requirements[stat] = value;
    }
    return requirements;
}

/**
 * Lists the requirements a player does not meet.
 *
 * @param requirements The requirements of the item.
 * @param player The stats of the player (level and attributes).
 * @returns The unmet requirements, empty when the player may wear the item.
 */
export function findUnmetRequirements(
    requirements: EquipRequirements,
    player: { readonly level: number; readonly attributes: Readonly<Record<"strength" | "agility" | "intelligence" | "defense", number>> }
): UnmetRequirement[] {
    const unmet: UnmetRequirement[] = [];
    for (const stat of REQUIREMENT_STATS) {
        const required = requirements[stat];
        if (required === undefined) continue;
        const actual = stat === "level" ? player.level : player.attributes[stat];
        if (actual < required) unmet.push({ stat, required, actual });
    }
    return unmet;
}
