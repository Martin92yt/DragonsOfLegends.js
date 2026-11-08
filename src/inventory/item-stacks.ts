import type { InventoryItemRecord } from "./inventory.interface.js";

/**
 * Default maximum stack size, aligned with the inventory defaults.
 */
// Rationale: 64 is the value already used by InventoryEntity when an item declares no maxStack.
export const DEFAULT_MAX_STACK = 64;

/**
 * Checks whether two records can share a stack (same item, same item data, none equipped).
 *
 * @param first The first record.
 * @param second The second record.
 * @returns True if both records are stackable together.
 */
export function isSameStack(first: InventoryItemRecord, second: InventoryItemRecord): boolean {
    return (
        first.itemId === second.itemId &&
        !first.isEquipped &&
        !second.isEquipped &&
        JSON.stringify(first.itemNbtData ?? null) === JSON.stringify(second.itemNbtData ?? null)
    );
}

/**
 * Sums the quantity of every unequipped record of an item.
 *
 * @param records The records to inspect.
 * @param itemId The item identifier.
 * @returns The total available quantity.
 */
export function countAvailable(records: readonly InventoryItemRecord[], itemId: string): number {
    return records.filter((record) => record.itemId === itemId && !record.isEquipped).reduce((sum, record) => sum + record.quantity, 0);
}

/**
 * Removes a quantity of an item from a list of records (smallest stacks first, to free slots).
 * Mutates the records and returns the removed chunks; empty records are left in place with a quantity of 0.
 *
 * @param records The records to take from.
 * @param itemId The item identifier.
 * @param quantity The quantity to take; the caller must have checked availability with {@link countAvailable}.
 * @returns The removed chunks, each carrying the item data of its source stack.
 */
export function takeFromStacks(records: InventoryItemRecord[], itemId: string, quantity: number): InventoryItemRecord[] {
    const candidates = records.filter((record) => record.itemId === itemId && !record.isEquipped && record.quantity > 0).sort((first, second) => first.quantity - second.quantity);
    const chunks: InventoryItemRecord[] = [];
    let remaining = quantity;

    for (const candidate of candidates) {
        if (remaining <= 0) break;
        const taken = Math.min(candidate.quantity, remaining);
        candidate.quantity -= taken;
        remaining -= taken;
        chunks.push({ ...candidate, quantity: taken, isEquipped: false, equipmentSlot: null });
    }

    return chunks;
}

/**
 * Adds a chunk to a list of records, filling existing stacks first and respecting `maxStack`.
 * Mutates `target`.
 *
 * @param target The records receiving the chunk.
 * @param chunk The chunk to add (its `quantity` is the amount to add).
 * @param ownerId The identifier written on newly created records.
 * @returns void
 */
export function addToStacks(target: InventoryItemRecord[], chunk: InventoryItemRecord, ownerId: string): void {
    const maxStack = Math.max(1, chunk.maxStack ?? DEFAULT_MAX_STACK);
    let remaining = chunk.quantity;

    for (const existing of target) {
        if (remaining <= 0) break;
        if (!isSameStack(existing, chunk) || existing.quantity >= maxStack) continue;
        const added = Math.min(maxStack - existing.quantity, remaining);
        existing.quantity += added;
        remaining -= added;
    }

    while (remaining > 0) {
        const size = Math.min(maxStack, remaining);
        target.push({
            ...chunk,
            playerId: ownerId,
            quantity: size,
            itemNbtData: chunk.itemNbtData ? { ...chunk.itemNbtData } : (chunk.itemNbtData ?? null),
            isEquipped: false,
            equipmentSlot: null
        });
        remaining -= size;
    }
}
