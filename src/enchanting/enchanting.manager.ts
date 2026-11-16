import type EnemyEntity from "../enemy/enemy.js";
import type { InventoryItemRecord } from "../inventory/inventory.interface.js";
import { countAvailable } from "../inventory/item-stacks.js";
import type PlayerEntity from "../player/player.entity.js";
import { EnchantingError, InsufficientFundsError, MissingIngredientsError, RecipeLevelTooLowError } from "../types/error.js";
import AsyncQueue from "../utils/async-queue.js";
import type World from "../world.js";
import EnchantmentRegistry from "./enchantment.registry.js";
import {
    ENCHANTING_JOB_ID,
    ENCHANTMENTS_NBT_KEY,
    MAX_DURABILITY_NBT_KEY,
    readEnchantments,
    type EnchantedItem,
    type EnchantmentContext,
    type EnchantmentDefinition,
    type EnchantmentHooks,
    type EnchantResult,
    type EnchantTarget
} from "./enchantment.types.js";
import { createLogger } from "../utils/logger.js";
const log = createLogger("enchanting");


/**
 * Enchanting engine: applies enchantments on items (cost in items, gold and/or player experience, gated by the
 * enchanter level) and runs their hooks (attack, experience gain) for the equipped items that carry them.
 */
export default class EnchantingManager extends EnchantmentRegistry {
    private readonly queues = new Map<string, AsyncQueue>();

    /**
     * Creates the enchanting engine and subscribes to the game events its hooks depend on.
     *
     * @param world The world.
     */
    public constructor(private readonly world: World) {
        super();
        // `playerExperienceGain` is emitted by the synchronous `addXP`; the hook runs right after it.
        world.events.on("playerExperienceGain", (event) => this.runExperienceHooks(event.player, event.amount));
    }

    /**
     * Gets the maximum durability of an item record (`maxDurability` data, else the durability of its definition).
     *
     * @param record The inventory record.
     * @returns The maximum durability, or undefined when the item has no durability.
     */
    public getMaxDurability(record: InventoryItemRecord): number | undefined {
        const stored = record.itemNbtData?.[MAX_DURABILITY_NBT_KEY];
        if (typeof stored === "number") return stored;
        const base = this.world.items.get(record.itemId)?.defaultNbt?.durability;
        return typeof base === "number" ? base : undefined;
    }

    /**
     * Applies an enchantment to an item of the inventory (worn or not). Nothing is consumed unless the whole
     * enchantment succeeds; the cancellable `itemEnchant` event is emitted before anything is paid.
     *
     * @param player The player.
     * @param target The item to enchant.
     * @param enchantmentId The enchantment identifier.
     * @param level The level to reach. @defaultValue the next level of the item
     * @returns The result; `cancelled` is `true` when a listener cancelled the enchantment.
     * @throws {EnchantingError} If the item, the enchantment or the level is invalid or incompatible.
     * @throws {RecipeLevelTooLowError} If the enchanter level is too low.
     * @throws {MissingIngredientsError} If the materials are missing.
     * @throws {InsufficientFundsError} If gold or experience is missing.
     */
    public async enchant(player: PlayerEntity, target: EnchantTarget, enchantmentId: string, level?: number): Promise<EnchantResult> {
        player.assertCanAct("enchanting.enchant");
        let queue = this.queues.get(player.id);
        if (!queue) this.queues.set(player.id, (queue = new AsyncQueue()));
        const outcome = await queue.run(() => this.execute(player, target, enchantmentId, level));
        if (!outcome.enchanted) return outcome;
        const spec = this.require(enchantmentId).levels[outcome.level - 1];
        const progress = await player.jobs.addExperience(ENCHANTING_JOB_ID, spec?.jobXp ?? 10 * outcome.level);
        return { ...outcome, xpGained: progress.xpGained, jobLevel: progress.level };
    }

    private findTarget(records: InventoryItemRecord[], target: EnchantTarget): InventoryItemRecord | undefined {
        return target.slot
            ? records.find((record) => record.itemId === target.itemId && record.isEquipped && record.equipmentSlot === target.slot)
            : records.find((record) => record.itemId === target.itemId && !record.isEquipped);
    }

    private async execute(player: PlayerEntity, target: EnchantTarget, enchantmentId: string, requested: number | undefined): Promise<EnchantResult> {
        player.assertCanAct("enchanting.enchant");
        const definition = this.require(enchantmentId);
        const records = await player.inventory.getItems();
        const record = this.findTarget(records, target);
        if (!record) throw new EnchantingError(`Item "${target.itemId}" was not found in the inventory.`);
        if (definition.appliesTo.categories && !definition.appliesTo.categories.includes(record.category)) {
            throw new EnchantingError(`"${definition.name}" cannot be applied to ${record.category}.`);
        }

        const current = readEnchantments(record);
        const previousLevel = current[enchantmentId] ?? 0;
        const level = requested ?? previousLevel + 1;
        if (!Number.isInteger(level) || level < 1 || level > definition.levels.length) throw new EnchantingError(`"${definition.name}" has no level ${level} (maximum ${definition.levels.length}).`);
        if (level <= previousLevel) throw new EnchantingError(`"${record.name}" already has "${definition.name}" at level ${previousLevel}.`);
        for (const other of Object.keys(current)) {
            if (definition.conflictsWith?.includes(other) || this.get(other)?.conflictsWith?.includes(enchantmentId)) {
                throw new EnchantingError(`"${definition.name}" conflicts with "${other}".`);
            }
        }

        const spec = definition.levels[level - 1];
        if (!spec) throw new EnchantingError(`"${definition.name}" has no level ${level}.`);
        const jobLevel = player.jobs.getLevel(ENCHANTING_JOB_ID);
        const requiredJobLevel = spec.requiredJobLevel ?? 1;
        if (jobLevel < requiredJobLevel) throw new RecipeLevelTooLowError(`${enchantmentId}:${level}`, requiredJobLevel, jobLevel);

        const missing = (spec.materials ?? [])
            .map((material) => ({ itemId: material.itemId, required: material.quantity, available: countAvailable(records, material.itemId) }))
            .filter((entry) => entry.available < entry.required);
        if (missing.length > 0) throw new MissingIngredientsError(missing);
        if ((spec.gold ?? 0) > player.gold) throw new InsufficientFundsError(`Not enough gold (${spec.gold} required).`);
        if ((spec.playerXp ?? 0) > player.experience.current) throw new InsufficientFundsError(`Not enough experience (${spec.playerXp} required).`);

        const event = await this.world.events.emitCancellable("itemEnchant", {
            playerId: player.id,
            player,
            itemId: record.itemId,
            ...(target.slot ? { slot: target.slot } : {}),
            enchantmentId,
            previousLevel,
            level
        });
        const result = { enchantmentId, itemId: record.itemId, previousLevel, xpGained: 0, jobLevel };
        if (event.isCancelled) {
            return { enchanted: false, cancelled: true, ...(event.cancelReason !== undefined ? { cancelReason: event.cancelReason } : {}), level: previousLevel, ...result };
        }

        for (const material of spec.materials ?? []) await player.inventory.remove(material.itemId, material.quantity);
        player.gold -= spec.gold ?? 0;
        player.experience.current -= spec.playerXp ?? 0;

        // Re-read the inventory: removing the materials may have rewritten the records.
        const fresh = await player.inventory.getItems();
        const freshRecord = this.findTarget(fresh, target);
        if (!freshRecord) throw new EnchantingError(`Item "${target.itemId}" is no longer in the inventory.`);
        freshRecord.itemNbtData = { ...(freshRecord.itemNbtData ?? {}), [ENCHANTMENTS_NBT_KEY]: { ...current, [enchantmentId]: level } };
        await player.inventory.save(fresh);
        await this.world.players.save(player);
        log.success(`${player.name} enchanted ${record.itemId} with ${enchantmentId} ${level}.`);
        return { enchanted: true, cancelled: false, level, ...result };
    }

    /**
     * Lists the equipped, unbroken items of a player that carry an enchantment.
     *
     * @param records The inventory records of the player.
     * @param enchantmentId The enchantment identifier.
     * @returns The carriers with their level.
     */
    public collectCarriers(records: readonly InventoryItemRecord[], enchantmentId: string): EnchantedItem[] {
        const carriers: EnchantedItem[] = [];
        for (const item of records) {
            if (!item.isEquipped) continue;
            const durability = item.itemNbtData?.durability;
            if (typeof durability === "number" && durability <= 0) continue; // a broken item gives no bonus
            const level = readEnchantments(item)[enchantmentId];
            if (level) carriers.push({ item, level });
        }
        return carriers;
    }

    /**
     * Runs the `onAttack` hooks of the enchantments worn by a player. Called by the combat after a blow.
     *
     * @param player The attacking player.
     * @param enemy The enemy that was hit.
     * @param damage The damage inflicted.
     * @returns void
     */
    public async runAttackHooks(player: PlayerEntity, enemy: EnemyEntity, damage: number): Promise<void> {
        await this.runHooks(player, "onAttack", (context) => ({ ...context, enemy, damage }));
    }

    private async runExperienceHooks(player: PlayerEntity, amount: number): Promise<void> {
        await this.runHooks(player, "onExperienceGain", (context) => ({ ...context, amount }));
    }

    private async runHooks<K extends keyof EnchantmentHooks>(player: PlayerEntity, hook: K, extend: (context: EnchantmentContext) => never | object): Promise<void> {
        const hooked = this.filter((definition) => definition.hooks?.[hook] !== undefined);
        if (hooked.length === 0) return;
        const records = await player.inventory.getItems();
        let dirty = false;
        for (const definition of hooked) {
            const carriers = this.collectCarriers(records, definition.id);
            if (carriers.length === 0) continue;
            const context: EnchantmentContext = {
                world: this.world,
                player,
                definition: definition as Readonly<EnchantmentDefinition>,
                carriers,
                totalLevel: carriers.reduce((sum, carrier) => sum + carrier.level, 0),
                markDirty: () => {
                    dirty = true;
                }
            };
            try {
                // The hook type is selected by the key; the extended context matches it by construction.
                await (definition.hooks?.[hook] as ((value: object) => void | Promise<void>) | undefined)?.(extend(context));
            } catch (error) {
                log.error(`Enchantment "${definition.id}" failed in ${hook}.`, error);
            }
        }
        if (dirty) await player.inventory.save(records);
    }

    /**
     * Repairs an item (used by enchantments such as Mending). Emits `itemRepair`.
     *
     * @param player The owner.
     * @param record The inventory record (live; the caller saves the inventory).
     * @param amount The durability to give back (never above the maximum).
     * @param source The origin of the repair.
     * @returns The durability actually repaired.
     */
    public async repair(player: PlayerEntity, record: InventoryItemRecord, amount: number, source: string): Promise<number> {
        const durability = record.itemNbtData?.durability;
        const max = this.getMaxDurability(record);
        if (typeof durability !== "number" || max === undefined || durability >= max || amount <= 0) return 0;
        const repaired = Math.min(max - durability, Math.floor(amount));
        if (repaired <= 0) return 0;
        record.itemNbtData = { ...(record.itemNbtData ?? {}), durability: durability + repaired };
        await this.world.events.emitAsync("itemRepair", {
            playerId: player.id,
            player,
            itemId: record.itemId,
            ...(record.equipmentSlot ? { slot: record.equipmentSlot } : {}),
            repaired,
            durability: durability + repaired,
            source
        });
        return repaired;
    }
}
