import type EnemyEntity from "../enemy/enemy.js";
import type { InventoryItemRecord } from "../inventory/inventory.interface.js";
import type { EquipmentSlot, ItemCategory } from "../inventory/item.enum.js";
import type PlayerEntity from "../player/player.entity.js";
import type World from "../world.js";

/**
 * Identifier of an enchantment (e.g. `"lifesteal"`, `"mypack:frost"`).
 */
export type EnchantmentId = string;

/**
 * Key of the item data (NBT) that holds the enchantments of an item, as `{ [enchantmentId]: level }`.
 * Items carrying item data never stack, so every enchanted item is its own record.
 */
export const ENCHANTMENTS_NBT_KEY = "enchantments";

/**
 * Key of the item data that holds the maximum durability of an item (set by the crafting engine).
 * When it is missing, the maximum durability is the `durability` of the item definition (`defaultNbt`).
 */
export const MAX_DURABILITY_NBT_KEY = "maxDurability";

/**
 * Identifier of the official job whose level gates the enchantments.
 */
export const ENCHANTING_JOB_ID = "enchanting";

/**
 * An amount of one item, used for costs.
 */
export interface EnchantmentMaterial {
    readonly itemId: string;
    /** Positive integer. */
    readonly quantity: number;
}

/**
 * Requirements and price of one level of an enchantment.
 */
export interface EnchantmentLevelSpec {
    /** Level of the enchanter job required to apply this level. @defaultValue 1 */
    readonly requiredJobLevel?: number;
    /** Items consumed from the inventory. */
    readonly materials?: readonly EnchantmentMaterial[];
    /** Gold consumed from the wallet. */
    readonly gold?: number;
    /** Experience points consumed from the player's current experience (never causes a level loss). */
    readonly playerXp?: number;
    /** Enchanter experience granted when this level is applied. @defaultValue 10 times the level */
    readonly jobXp?: number;
}

/**
 * Which items an enchantment can be applied to.
 */
export interface EnchantmentTargets {
    /** Item categories accepted (e.g. weapons, armor, tools). Every category is accepted when omitted. */
    readonly categories?: readonly ItemCategory[];
}

/**
 * An equipped item that carries an enchantment, with the level of that enchantment.
 */
export interface EnchantedItem {
    readonly item: InventoryItemRecord;
    readonly level: number;
}

/**
 * What every hook of an enchantment receives.
 */
export interface EnchantmentContext {
    readonly world: World;
    readonly player: PlayerEntity;
    readonly definition: Readonly<EnchantmentDefinition>;
    /**
     * The equipped items that carry the enchantment. The records are live: change their item data in place and call
     * {@link EnchantmentContext.markDirty} so the inventory is saved.
     */
    readonly carriers: readonly EnchantedItem[];
    /** Sum of the levels of the carriers (the enchantment stacks across worn items). */
    readonly totalLevel: number;
    /** Tells the engine that the item data of a carrier changed and must be persisted. */
    markDirty(): void;
}

/**
 * Context of the `onAttack` hook: the player has just hit an enemy.
 */
export interface AttackEnchantmentContext extends EnchantmentContext {
    readonly enemy: EnemyEntity;
    /** Damage actually inflicted to the enemy by the blow. */
    readonly damage: number;
}

/**
 * Context of the `onExperienceGain` hook: the player has just gained experience.
 */
export interface ExperienceEnchantmentContext extends EnchantmentContext {
    /** Experience points gained. */
    readonly amount: number;
}

/**
 * Behaviour of an enchantment. A hook runs only when at least one equipped item carries the enchantment.
 * Failures are logged and never interrupt the game action that triggered the hook.
 */
export interface EnchantmentHooks {
    /** Runs after the player's blow has been resolved (before the enemy answers). */
    readonly onAttack?: (context: AttackEnchantmentContext) => void | Promise<void>;
    /** Runs when the player gains experience. */
    readonly onExperienceGain?: (context: ExperienceEnchantmentContext) => void | Promise<void>;
}

/**
 * Definition of an enchantment, fully configurable by the game developer. Register it with
 * `world.enchantments.register(...)` or through a content pack (`enchantments`).
 */
export interface EnchantmentDefinition {
    /** Unique identifier. */
    readonly id: EnchantmentId;
    /** Display name. */
    readonly name: string;
    readonly description?: string;
    /** What the enchantment can be applied to. */
    readonly appliesTo: EnchantmentTargets;
    /** Identifiers of the enchantments that cannot be combined with this one on the same item. */
    readonly conflictsWith?: readonly EnchantmentId[];
    /**
     * One entry per level: `levels[0]` is level 1, so the maximum level is `levels.length`.
     */
    readonly levels: readonly EnchantmentLevelSpec[];
    /** Free numeric tuning read by the hooks (e.g. a heal percentage), so a pack can rebalance without rewriting code. */
    readonly params?: Readonly<Record<string, number>>;
    /** Behaviour of the enchantment. */
    readonly hooks?: EnchantmentHooks;
}

/**
 * Where to find the item to enchant: an item of the inventory, worn or not.
 */
export interface EnchantTarget {
    /** Identifier of the item. */
    readonly itemId: string;
    /** When set, targets the item worn in this slot; otherwise the first unequipped item of that identifier. */
    readonly slot?: EquipmentSlot;
}

/**
 * Result of an enchanting attempt.
 */
export interface EnchantResult {
    /** `true` when the enchantment was applied. */
    readonly enchanted: boolean;
    /** `true` when an `itemEnchant` listener cancelled the attempt (nothing was consumed). */
    readonly cancelled: boolean;
    /** Reason given by the listener that cancelled the attempt, if any. */
    readonly cancelReason?: string;
    readonly enchantmentId: EnchantmentId;
    readonly itemId: string;
    readonly previousLevel: number;
    /** Level of the enchantment after the attempt (unchanged when cancelled). */
    readonly level: number;
    /** Enchanter experience granted. */
    readonly xpGained: number;
    /** Level of the enchanter job after the attempt. */
    readonly jobLevel: number;
}

/**
 * Reads the enchantments of an item record, ignoring malformed values.
 *
 * @param record The inventory record.
 * @returns A copy of `{ enchantmentId: level }` (empty when the item is not enchanted).
 */
export function readEnchantments(record: Pick<InventoryItemRecord, "itemNbtData">): Record<EnchantmentId, number> {
    const raw: unknown = record.itemNbtData?.[ENCHANTMENTS_NBT_KEY];
    const enchantments: Record<EnchantmentId, number> = {};
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return enchantments;
    for (const [id, level] of Object.entries(raw)) {
        if (typeof level === "number" && Number.isInteger(level) && level > 0) enchantments[id] = level;
    }
    return enchantments;
}

/**
 * Builds the item data of an enchanted item (merge it into the `nbt` of a recipe result or an item definition).
 *
 * @param enchantments The enchantments and their levels.
 * @returns Item data holding the enchantments.
 */
export function createEnchantmentsNbt(enchantments: Readonly<Record<EnchantmentId, number>>): Record<string, unknown> {
    return { [ENCHANTMENTS_NBT_KEY]: { ...enchantments } };
}
