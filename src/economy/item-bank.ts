import { InventoryEntity } from "../inventory/inventory.js";
import type { InventoryItemRecord } from "../inventory/inventory.interface.js";
import { addToStacks, countAvailable, takeFromStacks } from "../inventory/item-stacks.js";
import type PlayerEntity from "../player/player.entity.js";
import { BankCapacityError, BankItemNotFoundError, BankLockedError, InvalidAmountError, InvalidBankCapacityError } from "../types/error.js";
import AsyncQueue from "../utils/async-queue.js";

/**
 * Default number of slots of an item bank (one slot = one stack of up to `maxStack` items).
 */
// Rationale: 40 slots hold a full set of gear plus consumables and materials without making the
// bank unlimited, so deciding what to protect from death penalties stays a meaningful choice.
export const DEFAULT_ITEM_BANK_CAPACITY_SLOTS = 40;

/**
 * Result of an item bank transfer.
 */
export interface ItemBankTransferResult {
    /** The transferred item identifier. */
    readonly itemId: string;
    /** The transferred quantity. */
    readonly quantity: number;
    /** The number of slots used in the bank after the transfer. */
    readonly usedSlots: number;
    /** The total number of slots of the bank. */
    readonly capacity: number;
}

/**
 * Validates a configured capacity.
 *
 * @param capacity The configured capacity, or undefined to use the default.
 * @returns The capacity to use.
 * @throws {InvalidBankCapacityError} If the capacity is not a positive integer.
 */
export function resolveItemBankCapacity(capacity: number | undefined): number {
    if (capacity === undefined) return DEFAULT_ITEM_BANK_CAPACITY_SLOTS;
    if (!Number.isInteger(capacity) || capacity <= 0) throw new InvalidBankCapacityError(capacity);
    return capacity;
}

/**
 * Item storage of a player. Banked items are not part of the player's inventory, so they are
 * never affected by death penalties (item loss, hardcore wipe aside).
 *
 * Transfers are serialized per player and keep item data (durability, bonuses) intact.
 */
export default class ItemBank {
    /** Prefix of the storage namespace used in the inventory database. */
    public static readonly NAMESPACE_PREFIX = "bank:";

    private readonly queue = new AsyncQueue();
    private storage: InventoryEntity | undefined;

    /**
     * Creates the item bank of a player.
     *
     * @param player The owning player.
     * @returns void
     */
    public constructor(private readonly player: PlayerEntity) {}

    /**
     * Builds the storage namespace of a player.
     *
     * @param playerId The player identifier.
     * @returns The namespaced identifier under which the bank items are stored.
     */
    public static namespaceFor(playerId: string): string {
        return `${ItemBank.NAMESPACE_PREFIX}${playerId}`;
    }

    /**
     * Gets the total number of slots (`bankCapacitySlots` world option, 40 by default).
     *
     * @returns The capacity in slots.
     */
    public getCapacity(): number {
        return resolveItemBankCapacity(this.player.worldInstance.initializationOptions.bankCapacitySlots);
    }

    /**
     * Lists the banked stacks.
     *
     * @returns The banked item records.
     * @throws {BankLockedError} If the bank is not unlocked.
     */
    public async list(): Promise<InventoryItemRecord[]> {
        this.ensureUnlocked();
        return this.queue.run(() => this.getStorage().load());
    }

    /**
     * Counts the used slots.
     *
     * @returns The number of banked stacks.
     * @throws {BankLockedError} If the bank is not unlocked.
     */
    public async getUsedSlots(): Promise<number> {
        return (await this.list()).length;
    }

    /**
     * Counts the banked quantity of an item (every stack).
     *
     * @param itemId The item identifier.
     * @returns The banked quantity.
     * @throws {BankLockedError} If the bank is not unlocked.
     */
    public async count(itemId: string): Promise<number> {
        return countAvailable(await this.list(), itemId);
    }

    /**
     * Moves unequipped items from the inventory to the bank.
     *
     * @param itemId The item identifier.
     * @param quantity The quantity to deposit.
     * @returns The transfer result.
     * @throws {BankLockedError} If the bank is not unlocked.
     * @throws {InvalidAmountError} If the quantity is not a positive integer.
     * @throws {BankItemNotFoundError} If the inventory holds fewer unequipped items than requested.
     * @throws {BankCapacityError} If the bank has not enough free slots.
     */
    public async deposit(itemId: string, quantity = 1): Promise<ItemBankTransferResult> {
        this.player.assertCanAct("itemBank.deposit");
        this.validate(quantity);
        const result = await this.queue.run(() => {
            this.player.assertCanAct("itemBank.deposit"); // re-checked: the player may have died while queued
            return this.transfer("deposit", itemId, quantity);
        });
        await this.player.worldInstance.events.emitAsync("itemBankDeposit", { playerId: this.player.id, player: this.player, itemId, quantity });
        return result;
    }

    /**
     * Moves items from the bank back to the inventory.
     *
     * @param itemId The item identifier.
     * @param quantity The quantity to withdraw.
     * @returns The transfer result.
     * @throws {BankLockedError} If the bank is not unlocked.
     * @throws {InvalidAmountError} If the quantity is not a positive integer.
     * @throws {BankItemNotFoundError} If the bank holds fewer items than requested.
     */
    public async withdraw(itemId: string, quantity = 1): Promise<ItemBankTransferResult> {
        this.player.assertCanAct("itemBank.withdraw");
        this.validate(quantity);
        const result = await this.queue.run(() => {
            this.player.assertCanAct("itemBank.withdraw"); // re-checked: the player may have died while queued
            return this.transfer("withdraw", itemId, quantity);
        });
        await this.player.worldInstance.events.emitAsync("itemBankWithdraw", { playerId: this.player.id, player: this.player, itemId, quantity });
        return result;
    }

    /**
     * Empties the bank (used when a player is deleted). Does not require an unlocked bank.
     *
     * @returns True if something was removed.
     */
    public async clear(): Promise<boolean> {
        return this.queue.run(() => this.getStorage().clear());
    }

    private validate(quantity: number): void {
        this.ensureUnlocked();
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new InvalidAmountError("Item quantity must be a positive integer.");
        }
    }

    private ensureUnlocked(): void {
        if (!this.player.bankUnlocked) throw new BankLockedError();
    }

    private getStorage(): InventoryEntity {
        this.storage ??= new InventoryEntity(ItemBank.namespaceFor(this.player.id), this.player);
        return this.storage;
    }

    private async transfer(direction: "deposit" | "withdraw", itemId: string, quantity: number): Promise<ItemBankTransferResult> {
        const inventory = this.player.inventory;
        const storage = this.getStorage();
        const capacity = this.getCapacity();

        const targetOwner = direction === "deposit" ? ItemBank.namespaceFor(this.player.id) : this.player.id;
        const source = direction === "deposit" ? inventory : storage;
        const target = direction === "deposit" ? storage : inventory;

        const sourceRecords = await source.load();
        const targetRecords = await target.load();
        const available = countAvailable(sourceRecords, itemId);
        if (available < quantity) throw new BankItemNotFoundError(itemId, quantity, available);

        const nextSource = sourceRecords.map((record) => ({ ...record }));
        const nextTarget = targetRecords.map((record) => ({ ...record }));
        for (const chunk of takeFromStacks(nextSource, itemId, quantity)) {
            addToStacks(nextTarget, chunk, targetOwner);
        }

        const remainingSource = nextSource.filter((record) => record.quantity > 0);
        if (direction === "deposit" && nextTarget.length > capacity) {
            throw new BankCapacityError(capacity, nextTarget.length);
        }

        // Rationale: the destination is written first, so a crash in between duplicates items instead of
        // destroying them; a failing source write is compensated by restoring the destination.
        await target.save(nextTarget);
        try {
            await source.save(remainingSource);
        } catch (error) {
            await target.save(targetRecords);
            throw error;
        }

        const usedSlots = direction === "deposit" ? nextTarget.length : remainingSource.length;
        return { itemId, quantity, usedSlots, capacity };
    }
}
