/**
 * An item of a shop, with the prices of both directions.
 */
export interface ShopListing {
    /** Identifier of an item of the item registry. */
    readonly itemId: string;
    /** Gold the player pays to buy one item. Omit it for an item the shop only buys. */
    readonly price?: number;
    /** Gold the player receives when selling one item to the shop. Omit it for an item the shop does not buy. */
    readonly sellPrice?: number;
    /** Minimum player level to buy the item. @defaultValue 1 */
    readonly minLevel?: number;
}

/**
 * Definition of a shop, fully configurable by the game developer.
 */
export interface ShopDefinition {
    /** Unique identifier (e.g. `"general_store"`, `"mypack:blacksmith"`). */
    readonly id: string;
    /** Display name. */
    readonly name: string;
    readonly description?: string;
    /** The items the shop sells and/or buys (at least one). */
    readonly listings: readonly ShopListing[];
}

/**
 * Result of a purchase.
 */
export interface ShopPurchaseResult {
    readonly shopId: string;
    readonly itemId: string;
    readonly quantity: number;
    /** Price of one item. */
    readonly unitPrice: number;
    /** Gold spent. */
    readonly totalPrice: number;
    /** Gold left in the wallet of the player. */
    readonly gold: number;
}

/**
 * Result of a sale.
 */
export interface ShopSaleResult {
    readonly shopId: string;
    readonly itemId: string;
    readonly quantity: number;
    /** Price paid for one item. */
    readonly unitPrice: number;
    /** Gold received. */
    readonly totalPrice: number;
    /** Gold in the wallet of the player after the sale. */
    readonly gold: number;
}
