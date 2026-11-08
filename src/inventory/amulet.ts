import type { InventoryItemRecord, ItemNBT } from "./inventory.interface.js";

/**
 * Keys used in the item data of an amulet.
 *
 * `luckBonus` and `experienceBonus` are percentages (`15` = +15%). `critRateBonus` is the absolute
 * critical-hit chance added in combat (`0.05` = +5 points), the unit the combat engine already reads
 * on every equipped item.
 */
export const AMULET_NBT_KEYS = {
    luck: "luckBonus",
    experience: "experienceBonus",
    critRate: "critRateBonus"
} as const;

/**
 * Modifiers granted by the amulets a player currently wears.
 */
export interface AmuletModifiers {
    /** Loot luck in percent: boosts drop rates and the weight of rare loot. */
    readonly luckPercent: number;
    /** Bonus experience in percent. */
    readonly xpPercent: number;
    /** Absolute critical-hit chance added (`0.05` = +5 points). */
    readonly critRateBonus: number;
}

/** Modifiers of a player wearing no amulet. */
export const NO_AMULET_MODIFIERS: AmuletModifiers = { luckPercent: 0, xpPercent: 0, critRateBonus: 0 };

/**
 * Builds the item data of an amulet. Use it as the `defaultNbt` of an item of the `amulet` category.
 *
 * @param modifiers The bonuses, all in percent (`critRatePercent: 5` adds 5 points of critical chance).
 * @returns Item data to attach to an amulet.
 */
export function createAmuletNbt(modifiers: Partial<{ luckPercent: number; xpPercent: number; critRatePercent: number }> = {}): ItemNBT {
    const nbt: ItemNBT = {};
    if (modifiers.luckPercent) nbt[AMULET_NBT_KEYS.luck] = modifiers.luckPercent;
    if (modifiers.xpPercent) nbt[AMULET_NBT_KEYS.experience] = modifiers.xpPercent;
    // Integer percent arithmetic avoids floating-point drift (5 / 100 is exact, 0.05 * 100 is not).
    if (modifiers.critRatePercent) nbt[AMULET_NBT_KEYS.critRate] = modifiers.critRatePercent / 100;
    return nbt;
}

/**
 * Sums the modifiers of the items worn in the amulet slots, ignoring malformed values.
 * Only the amulet slots count: a tool or a weapon carrying the same keys does not grant a global bonus.
 *
 * @param records The inventory records of the player.
 * @returns The total amulet modifiers (all zero without amulet).
 */
export function readAmuletModifiers(records: readonly InventoryItemRecord[]): AmuletModifiers {
    let luckPercent = 0;
    let xpPercent = 0;
    let critRateBonus = 0;

    for (const record of records) {
        if (!record.isEquipped || !record.equipmentSlot?.startsWith("amulet") || !record.itemNbtData) continue;
        const read = (key: string): number => {
            const value: unknown = record.itemNbtData?.[key];
            return typeof value === "number" && Number.isFinite(value) ? value : 0;
        };
        luckPercent += read(AMULET_NBT_KEYS.luck);
        xpPercent += read(AMULET_NBT_KEYS.experience);
        critRateBonus += read(AMULET_NBT_KEYS.critRate);
    }

    return { luckPercent, xpPercent, critRateBonus };
}
