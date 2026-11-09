import { consola } from "consola";
import type { Item } from "../inventory/inventory.interface.js";
import type ItemRegistry from "../inventory/item.registry.js";
import Registry from "../registry/registry.js";
import type PlayerEntity from "../player/player.entity.js";
import {
    InvalidRegistryEntryError,
    InvalidShopQuantityError,
    ShopInsufficientGoldError,
    ShopInsufficientItemsError,
    ShopItemUnavailableError,
    ShopLevelTooLowError
} from "../types/error.js";
import AsyncQueue from "../utils/async-queue.js";
import type { ShopDefinition, ShopListing, ShopPurchaseResult, ShopSaleResult } from "./shop.types.js";

/**
 * Registry of the shops of a world, and the way to buy from and sell to them with the gold of the game.
 *
 * Built on the generic {@link Registry}: shops are never hard-coded, the official ones are a content pack
 * and third parties register theirs the same way (`register`, `bulkRegister`, `{ override: true }`...).
 * Purchases and sales are serialized per player, so concurrent commands cannot spend the same gold twice.
 */
export default class ShopManager extends Registry<ShopDefinition> {
    private readonly queues = new WeakMap<PlayerEntity, AsyncQueue>();

    /**
     * Creates an empty shop registry.
     *
     * @param items The item registry the listings are resolved against (a listing must reference a registered item).
     * @returns void
     */
    public constructor(private readonly items: ItemRegistry) {
        super({
            kind: "shop",
            idOf: (definition) => definition.id,
            validate: (definition) => ShopManager.validate(definition, items)
        });
    }

    /**
     * Gets the listing of an item in a shop.
     *
     * @param shopId The shop identifier.
     * @param itemId The item identifier.
     * @returns The listing, or undefined if the shop does not trade the item.
     * @throws {UnknownRegistryEntryError} If the shop is not registered.
     */
    public getListing(shopId: string, itemId: string): Readonly<ShopListing> | undefined {
        return this.require(shopId).listings.find((listing) => listing.itemId === itemId);
    }

    /**
     * Lists what a shop sells (the listings with a purchase price).
     *
     * @param shopId The shop identifier.
     * @returns The listings the player can buy.
     * @throws {UnknownRegistryEntryError} If the shop is not registered.
     */
    public listForSale(shopId: string): Array<Readonly<ShopListing>> {
        return this.require(shopId).listings.filter((listing) => listing.price !== undefined);
    }

    /**
     * Buys items: the gold leaves the wallet and the items enter the inventory (with their default item data).
     *
     * @param player The buyer.
     * @param shopId The shop identifier.
     * @param itemId The item identifier.
     * @param quantity The quantity to buy (a positive integer).
     * @returns The price paid and the gold left.
     * @throws {UnknownRegistryEntryError} If the shop is not registered.
     * @throws {InvalidShopQuantityError} If the quantity is not a positive integer.
     * @throws {ShopItemUnavailableError} If the shop does not sell the item.
     * @throws {ShopLevelTooLowError} If the player level is below the minimum level of the listing.
     * @throws {ShopInsufficientGoldError} If the player cannot afford the purchase.
     * @throws {PlayerDeadError} If the player is dead.
     */
    public async buy(player: PlayerEntity, shopId: string, itemId: string, quantity = 1): Promise<ShopPurchaseResult> {
        player.assertCanAct("shop.buy");
        ShopManager.assertQuantity(quantity);
        const shop = this.require(shopId);

        return this.serialized(player, async () => {
            player.assertCanAct("shop.buy"); // re-checked: the player may have died while queued
            const listing = shop.listings.find((candidate) => candidate.itemId === itemId);
            const unitPrice = listing?.price;
            if (listing === undefined || unitPrice === undefined) throw new ShopItemUnavailableError(shopId, itemId, "buy");
            if (listing.minLevel !== undefined && player.level < listing.minLevel) throw new ShopLevelTooLowError(shopId, itemId, listing.minLevel, player.level);

            const totalPrice = unitPrice * quantity;
            if (player.gold < totalPrice) throw new ShopInsufficientGoldError(totalPrice, player.gold);

            player.gold -= totalPrice;
            try {
                await player.inventory.add(this.items.require(itemId), quantity);
            } catch (error) {
                player.gold += totalPrice; // the purchase failed: give the gold back
                throw error;
            }

            consola.success(`${player.name} bought ${quantity}x ${itemId} for ${totalPrice} gold.`);
            await player.worldInstance.events.emitAsync("shopBuy", { playerId: player.id, player, shopId, itemId, quantity, unitPrice, totalPrice });
            return { shopId, itemId, quantity, unitPrice, totalPrice, gold: player.gold };
        });
    }

    /**
     * Sells items to a shop: the items leave the inventory (equipped items are never sold) and the gold enters the wallet.
     *
     * @param player The seller.
     * @param shopId The shop identifier.
     * @param itemId The item identifier.
     * @param quantity The quantity to sell (a positive integer).
     * @returns The price received and the gold now carried.
     * @throws {UnknownRegistryEntryError} If the shop is not registered.
     * @throws {InvalidShopQuantityError} If the quantity is not a positive integer.
     * @throws {ShopItemUnavailableError} If the shop does not buy the item.
     * @throws {ShopInsufficientItemsError} If the player does not own enough unequipped items.
     * @throws {PlayerDeadError} If the player is dead.
     */
    public async sell(player: PlayerEntity, shopId: string, itemId: string, quantity = 1): Promise<ShopSaleResult> {
        player.assertCanAct("shop.sell");
        ShopManager.assertQuantity(quantity);
        const shop = this.require(shopId);

        return this.serialized(player, async () => {
            player.assertCanAct("shop.sell"); // re-checked: the player may have died while queued
            const unitPrice = shop.listings.find((candidate) => candidate.itemId === itemId)?.sellPrice;
            if (unitPrice === undefined) throw new ShopItemUnavailableError(shopId, itemId, "sell");

            const available = await ShopManager.countUnequipped(player, itemId);
            if (available < quantity) throw new ShopInsufficientItemsError(itemId, quantity, available);
            if (!(await ShopManager.removeUnequipped(player, itemId, quantity))) throw new ShopInsufficientItemsError(itemId, quantity, await ShopManager.countUnequipped(player, itemId));

            const totalPrice = unitPrice * quantity;
            player.gold += totalPrice;

            consola.success(`${player.name} sold ${quantity}x ${itemId} for ${totalPrice} gold.`);
            await player.worldInstance.events.emitAsync("shopSell", { playerId: player.id, player, shopId, itemId, quantity, unitPrice, totalPrice });
            return { shopId, itemId, quantity, unitPrice, totalPrice, gold: player.gold };
        });
    }

    private serialized<T>(player: PlayerEntity, operation: () => Promise<T>): Promise<T> {
        let queue = this.queues.get(player);
        if (!queue) {
            queue = new AsyncQueue();
            this.queues.set(player, queue);
        }
        return queue.run(operation);
    }

    private static assertQuantity(quantity: number): void {
        if (!Number.isInteger(quantity) || quantity < 1) throw new InvalidShopQuantityError(quantity);
    }

    private static async countUnequipped(player: PlayerEntity, itemId: string): Promise<number> {
        const records = await player.inventory.getItems();
        return records.filter((record) => record.itemId === itemId && !record.isEquipped).reduce((sum, record) => sum + record.quantity, 0);
    }

    /**
     * Removes a quantity that may span several stacks (e.g. the same item with different item data).
     */
    private static async removeUnequipped(player: PlayerEntity, itemId: string, quantity: number): Promise<boolean> {
        let remaining = quantity;
        while (remaining > 0) {
            const stack = (await player.inventory.getItems()).find((record) => record.itemId === itemId && !record.isEquipped);
            if (!stack) return false;
            const taken = Math.min(stack.quantity, remaining);
            if (!(await player.inventory.remove(itemId, taken))) return false;
            remaining -= taken;
        }
        return true;
    }

    private static validate(definition: ShopDefinition, items: ItemRegistry): void {
        const fail = (reason: string): never => {
            throw new InvalidRegistryEntryError("shop", `"${definition.id}": ${reason}`);
        };
        if (definition.id.trim() === "") throw new InvalidRegistryEntryError("shop", "the identifier must not be empty.");
        if (definition.name.trim() === "") fail("a name is required.");
        if (definition.listings.length === 0) fail("at least one listing is required.");

        const seen = new Set<string>();
        for (const listing of definition.listings) {
            const { itemId, price, sellPrice, minLevel } = listing;
            if (seen.has(itemId)) fail(`the item "${itemId}" is listed twice.`);
            seen.add(itemId);
            if (!items.has(itemId)) fail(`the listing references the unregistered item "${itemId}" (register the item first, in the same pack or a dependency).`);
            if (price === undefined && sellPrice === undefined) fail(`"${itemId}" needs a price, a sellPrice or both.`);
            if (price !== undefined && (!Number.isInteger(price) || price < 1)) fail(`the price of "${itemId}" must be a positive integer.`);
            if (sellPrice !== undefined && (!Number.isInteger(sellPrice) || sellPrice < 0)) fail(`the sellPrice of "${itemId}" must be a non-negative integer.`);
            // Rationale: a shop that pays more than it charges would print gold (buy, sell, repeat).
            if (price !== undefined && sellPrice !== undefined && sellPrice > price) fail(`the sellPrice of "${itemId}" must not exceed its price.`);
            if (minLevel !== undefined && (!Number.isInteger(minLevel) || minLevel < 1)) fail(`the minLevel of "${itemId}" must be a positive integer.`);
        }
    }

    /**
     * Resolves a listing to its item definition.
     *
     * @param shopId The shop identifier.
     * @param itemId The item identifier.
     * @returns The item, or undefined if the shop does not trade it.
     * @throws {UnknownRegistryEntryError} If the shop is not registered.
     */
    public getItem(shopId: string, itemId: string): Readonly<Item> | undefined {
        return this.getListing(shopId, itemId) ? this.items.get(itemId) : undefined;
    }
}
