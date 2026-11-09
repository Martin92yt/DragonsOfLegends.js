/**
 * DragonsOfLegends.js — Shops: buying and selling with the gold of the game.
 *
 * Run only this file:  npx tsx --test tests/shop.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OFFICIAL_SHOPS } from "../src/content/official-items.js";
import {
    InvalidRegistryEntryError,
    InvalidShopQuantityError,
    ShopInsufficientGoldError,
    ShopInsufficientItemsError,
    ShopItemUnavailableError,
    ShopLevelTooLowError
} from "../src/types/error.js";
import { createWorld, spawn, totalQuantity, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

const world = () => createWorld({ premadeItems: true, starterItems: {} });

describe("Shop registry", () => {
    it("ships a general store that never pays more than it charges", () => {
        const instance = world();
        assert.ok(instance.shops.has("general_store"));
        for (const listing of OFFICIAL_SHOPS.flatMap((shop) => shop.listings)) {
            if (listing.price !== undefined && listing.sellPrice !== undefined) assert.ok(listing.sellPrice <= listing.price, listing.itemId);
        }
        assert.ok(instance.shops.listForSale("general_store").every((listing) => listing.price !== undefined));
    });

    it("rejects invalid shops", () => {
        const instance = world();
        const base = { id: "s", name: "S" };
        assert.throws(() => instance.shops.register({ ...base, listings: [] }), InvalidRegistryEntryError);
        assert.throws(() => instance.shops.register({ ...base, listings: [{ itemId: "ghost", price: 1 }] }), InvalidRegistryEntryError);
        assert.throws(() => instance.shops.register({ ...base, listings: [{ itemId: "health_potion" }] }), InvalidRegistryEntryError);
        assert.throws(() => instance.shops.register({ ...base, listings: [{ itemId: "health_potion", price: 0 }] }), InvalidRegistryEntryError);
        assert.throws(() => instance.shops.register({ ...base, listings: [{ itemId: "health_potion", price: 1.5 }] }), InvalidRegistryEntryError);
        assert.throws(() => instance.shops.register({ ...base, listings: [{ itemId: "health_potion", price: 10, sellPrice: 11 }] }), InvalidRegistryEntryError);
        assert.throws(() => instance.shops.register({ ...base, listings: [{ itemId: "health_potion", price: 10 }, { itemId: "health_potion", price: 12 }] }), InvalidRegistryEntryError);
        assert.throws(() => instance.shops.register({ ...base, listings: [{ itemId: "health_potion", price: 10, minLevel: 0 }] }), InvalidRegistryEntryError);
    });

    it("accepts a shop that only buys or only sells", () => {
        const instance = world();
        instance.shops.register({ id: "pawn", name: "Pawn", listings: [{ itemId: "health_potion", sellPrice: 5 }, { itemId: "rusty_sword", price: 30 }] });
        assert.deepEqual(instance.shops.listForSale("pawn").map((listing) => listing.itemId), ["rusty_sword"]);
    });
});

describe("Buying", () => {
    it("takes the gold and gives the items, with their default item data", async () => {
        const instance = world();
        const player = await spawn(instance);
        player.gold = 200;
        const result = await instance.shops.buy(player, "general_store", "health_potion", 3);
        assert.deepEqual(result, { shopId: "general_store", itemId: "health_potion", quantity: 3, unitPrice: 25, totalPrice: 75, gold: 125 });
        assert.equal(player.gold, 125);
        assert.equal(await totalQuantity(player, "health_potion"), 3);

        await instance.shops.buy(player, "general_store", "rusty_sword");
        const sword = (await player.inventory.getItems()).find((record) => record.itemId === "rusty_sword");
        assert.deepEqual(sword?.itemNbtData, { damageBonus: 2, durability: 100 });
    });

    it("emits shopBuy", async () => {
        const instance = world();
        const player = await spawn(instance);
        player.gold = 100;
        const totals: number[] = [];
        instance.events.on("shopBuy", (payload) => { totals.push(payload.totalPrice); });
        await instance.shops.buy(player, "general_store", "health_potion", 2);
        assert.deepEqual(totals, [50]);
    });

    it("refuses without enough gold, leaving everything untouched", async () => {
        const instance = world();
        const player = await spawn(instance);
        player.gold = 24;
        await assert.rejects(() => instance.shops.buy(player, "general_store", "health_potion"), ShopInsufficientGoldError);
        assert.equal(player.gold, 24);
        assert.equal(await totalQuantity(player, "health_potion"), 0);
    });

    it("refuses an item the shop does not sell, a level too low and an invalid quantity", async () => {
        const instance = world();
        const player = await spawn(instance);
        player.gold = 100_000;
        await assert.rejects(() => instance.shops.buy(player, "general_store", "pouch_epic"), ShopItemUnavailableError);
        await assert.rejects(() => instance.shops.buy(player, "general_store", "luck_amulet"), ShopLevelTooLowError);
        for (const quantity of [0, -1, 1.5, Number.NaN]) {
            await assert.rejects(() => instance.shops.buy(player, "general_store", "health_potion", quantity), InvalidShopQuantityError);
        }
        await assert.rejects(() => instance.shops.buy(player, "ghost", "health_potion"));
        assert.equal(player.gold, 100_000);
    });

    it("never spends the same gold twice on concurrent purchases", async () => {
        const instance = world();
        const player = await spawn(instance);
        player.gold = 30;
        const results = await Promise.allSettled([
            instance.shops.buy(player, "general_store", "health_potion"),
            instance.shops.buy(player, "general_store", "health_potion")
        ]);
        assert.deepEqual(results.map((result) => result.status).sort(), ["fulfilled", "rejected"]);
        assert.equal(player.gold, 5);
        assert.equal(await totalQuantity(player, "health_potion"), 1);
    });

    it("a dead player cannot buy", async () => {
        const instance = world();
        const player = await spawn(instance);
        player.gold = 100;
        player.life.die(60_000);
        await assert.rejects(() => instance.shops.buy(player, "general_store", "health_potion"));
        assert.equal(player.gold, 100);
    });
});

describe("Selling", () => {
    it("takes the items and gives the gold", async () => {
        const instance = world();
        const player = await spawn(instance);
        await player.inventory.add(instance.items.require("health_potion"), 4);
        const gold = player.gold;
        const result = await instance.shops.sell(player, "general_store", "health_potion", 3);
        assert.equal(result.totalPrice, 30);
        assert.equal(player.gold, gold + 30);
        assert.equal(await totalQuantity(player, "health_potion"), 1);
    });

    it("refuses to sell more than owned, or what the shop does not buy", async () => {
        const instance = world();
        const player = await spawn(instance);
        await player.inventory.add(instance.items.require("health_potion"), 1);
        await assert.rejects(() => instance.shops.sell(player, "general_store", "health_potion", 2), ShopInsufficientItemsError);
        await assert.rejects(() => instance.shops.sell(player, "general_store", "pouch_epic"), ShopItemUnavailableError);
        assert.equal(await totalQuantity(player, "health_potion"), 1);
    });

    it("never sells an equipped item", async () => {
        const instance = world();
        const player = await spawn(instance);
        await player.inventory.add(instance.items.require("rusty_sword"), 1);
        await player.inventory.equip("sword", "rusty_sword");
        await assert.rejects(() => instance.shops.sell(player, "general_store", "rusty_sword"), ShopInsufficientItemsError);
    });

    it("sells a quantity spanning several stacks", async () => {
        const instance = world();
        const player = await spawn(instance);
        await player.inventory.add(instance.items.require("health_potion"), 2);
        await player.inventory.add(instance.items.require("health_potion"), 2, { batch: 2 });
        const result = await instance.shops.sell(player, "general_store", "health_potion", 3);
        assert.equal(result.quantity, 3);
        assert.equal(await totalQuantity(player, "health_potion"), 1);
    });

    it("buying then selling never creates gold", async () => {
        const instance = world();
        const player = await spawn(instance);
        player.gold = 1_000;
        for (const listing of instance.shops.listForSale("general_store").filter((entry) => entry.minLevel === undefined && entry.sellPrice !== undefined)) {
            await instance.shops.buy(player, "general_store", listing.itemId);
            await instance.shops.sell(player, "general_store", listing.itemId);
        }
        assert.ok(player.gold <= 1_000);
    });
});
