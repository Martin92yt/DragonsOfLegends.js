/**
 * DragonsOfLegends.js — Item bank: deposit, withdraw, stacking, capacity and death protection.
 *
 * Run only this file:  npx tsx --test tests/item-bank.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import ItemBank, { DEFAULT_ITEM_BANK_CAPACITY_SLOTS, resolveItemBankCapacity } from "../src/economy/item-bank.js";
import { ItemCategory, ItemRarity } from "../src/inventory/item.enum.js";
import { addToStacks, countAvailable, isSameStack, takeFromStacks } from "../src/inventory/item-stacks.js";
import type { InventoryItemRecord } from "../src/inventory/inventory.interface.js";
import * as errors from "../src/types/error.js";
import { createWorld, defined, findRecord, giveAndEquip, makeItem, sleep, spawn, stubRandom, totalQuantity, useIsolatedWorkspace, type WorldOptions } from "./helpers/fixtures.js";

useIsolatedWorkspace();

const stackable = (itemId: string, maxStack: number) => makeItem(itemId, ItemCategory.Materials, ItemRarity.Common, maxStack);

async function bankedPlayer(options: WorldOptions = {}) {
    const world = createWorld(options);
    const player = await spawn(world);
    player.bankUnlocked = true;
    return { world, player };
}

describe("Item stacks helpers", () => {
    const record = (overrides: Partial<InventoryItemRecord> = {}): InventoryItemRecord => ({
        ...stackable("rope", 10),
        playerId: "p",
        quantity: 4,
        itemNbtData: null,
        isEquipped: false,
        equipmentSlot: null,
        ...overrides
    });

    it("detects stackable records (same item and data, none equipped)", () => {
        assert.equal(isSameStack(record(), record()), true);
        assert.equal(isSameStack(record(), record({ itemId: "other" })), false);
        assert.equal(isSameStack(record({ itemNbtData: { durability: 5 } }), record({ itemNbtData: { durability: 6 } })), false);
        assert.equal(isSameStack(record({ isEquipped: true }), record()), false);
    });

    it("takes from the smallest stacks first and counts unequipped quantities only", () => {
        const records = [record({ quantity: 9 }), record({ quantity: 2 }), record({ quantity: 5, isEquipped: true })];
        assert.equal(countAvailable(records, "rope"), 11);
        const chunks = takeFromStacks(records, "rope", 4);
        assert.deepEqual(chunks.map((chunk) => chunk.quantity), [2, 2]);
        assert.deepEqual(records.map((entry) => entry.quantity), [7, 0, 5]);
    });

    it("fills existing stacks then splits at maxStack", () => {
        const target = [record({ quantity: 8 })];
        addToStacks(target, record({ quantity: 15 }), "owner");
        assert.deepEqual(target.map((entry) => entry.quantity), [10, 10, 3]);
        assert.equal(target[1]?.playerId, "owner");
    });
});

describe("ItemBank", () => {
    it("requires an unlocked bank", async () => {
        const player = await spawn(createWorld());
        await assert.rejects(player.itemBank.deposit("rope"), errors.BankLockedError);
        await assert.rejects(player.itemBank.withdraw("rope"), errors.BankLockedError);
        await assert.rejects(player.itemBank.list(), errors.BankLockedError);
    });

    it("exposes a configurable capacity with a default of 40 slots", async () => {
        const { player } = await bankedPlayer();
        assert.equal(DEFAULT_ITEM_BANK_CAPACITY_SLOTS, 40);
        assert.equal(player.itemBank.getCapacity(), 40);
        assert.equal((await bankedPlayer({ bankCapacitySlots: 5 })).player.itemBank.getCapacity(), 5);
        assert.equal(resolveItemBankCapacity(undefined), 40);
        for (const invalid of [0, -1, 1.5, Number.NaN]) {
            assert.throws(() => createWorld({ bankCapacitySlots: invalid }), errors.InvalidBankCapacityError);
        }
    });

    it("deposits items, stacking by maxStack, and withdraws them back", async () => {
        const { player } = await bankedPlayer();
        await player.inventory.add(stackable("ore", 10), 25);

        const deposit = await player.itemBank.deposit("ore", 25);
        assert.deepEqual(deposit, { itemId: "ore", quantity: 25, usedSlots: 3, capacity: 40 });
        assert.equal(await totalQuantity(player, "ore"), 0);
        assert.deepEqual((await player.itemBank.list()).map((entry) => entry.quantity).sort((a, b) => b - a), [10, 10, 5]);
        assert.equal(await player.itemBank.count("ore"), 25);
        assert.equal(await player.itemBank.getUsedSlots(), 3);

        const withdrawal = await player.itemBank.withdraw("ore", 12);
        assert.equal(withdrawal.usedSlots, 2);
        assert.equal(await totalQuantity(player, "ore"), 12);
        assert.equal(await player.itemBank.count("ore"), 13);
        assert.ok((await player.inventory.getItems()).every((entry) => entry.quantity <= 10), "inventory stacks respect maxStack");
    });

    it("merges deposits into existing stacks", async () => {
        const { player } = await bankedPlayer();
        await player.inventory.add(stackable("ore", 10), 4);
        await player.itemBank.deposit("ore", 4);
        await player.inventory.add(stackable("ore", 10), 3);
        const result = await player.itemBank.deposit("ore", 3);
        assert.equal(result.usedSlots, 1);
        assert.equal(await player.itemBank.count("ore"), 7);
    });

    it("keeps item data (durability, bonuses) and never merges different data", async () => {
        const { player } = await bankedPlayer();
        const sword = makeItem("blade", ItemCategory.Weapons, ItemRarity.Rare, 1);
        await player.inventory.add(sword, 1, { damageBonus: 7, durability: 40 });
        await player.inventory.add(sword, 1, { damageBonus: 9, durability: 12 });
        await player.itemBank.deposit("blade", 2);
        const banked = await player.itemBank.list();
        assert.equal(banked.length, 2);
        assert.deepEqual(banked.map((entry) => entry.itemNbtData?.durability).sort(), [12, 40]);

        await player.itemBank.withdraw("blade", 2);
        const restored = (await player.inventory.getItems()).filter((entry) => entry.itemId === "blade");
        assert.deepEqual(restored.map((entry) => entry.itemNbtData?.damageBonus).sort(), [7, 9]);
    });

    it("rejects a deposit that exceeds the capacity without touching anything", async () => {
        const { player } = await bankedPlayer({ bankCapacitySlots: 2 });
        await player.inventory.add(stackable("ore", 10), 25);
        await assert.rejects(player.itemBank.deposit("ore", 25), errors.BankCapacityError);
        assert.equal(await totalQuantity(player, "ore"), 25);
        assert.equal(await player.itemBank.getUsedSlots(), 0);

        await player.itemBank.deposit("ore", 20);
        assert.equal(await player.itemBank.getUsedSlots(), 2);
        await assert.rejects(player.itemBank.deposit("ore", 5), errors.BankCapacityError);
    });

    it("rejects missing items, equipped items and invalid quantities", async () => {
        const { player } = await bankedPlayer();
        await assert.rejects(player.itemBank.deposit("ghost", 1), errors.BankItemNotFoundError);
        await player.inventory.add(stackable("ore", 10), 3);
        await assert.rejects(player.itemBank.deposit("ore", 4), errors.BankItemNotFoundError);
        await assert.rejects(player.itemBank.withdraw("ore", 1), errors.BankItemNotFoundError);

        await giveAndEquip(player, "helmet", makeItem("cap", ItemCategory.Armor));
        await assert.rejects(player.itemBank.deposit("cap", 1), errors.BankItemNotFoundError, "equipped items cannot be banked");

        for (const invalid of [0, -2, 1.5]) {
            await assert.rejects(player.itemBank.deposit("ore", invalid), errors.InvalidAmountError);
            await assert.rejects(player.itemBank.withdraw("ore", invalid), errors.InvalidAmountError);
        }
        assert.equal(await totalQuantity(player, "ore"), 3);
    });

    it("serializes concurrent transfers", async () => {
        const { player } = await bankedPlayer();
        await player.inventory.add(stackable("ore", 64), 6);
        const results = await Promise.allSettled([player.itemBank.deposit("ore", 4), player.itemBank.deposit("ore", 4), player.itemBank.deposit("ore", 2)]);
        assert.deepEqual(results.map((result) => result.status), ["fulfilled", "rejected", "fulfilled"]);
        assert.equal(await player.itemBank.count("ore"), 6);
        assert.equal(await totalQuantity(player, "ore"), 0);
    });

    it("persists across reloads and is emptied when the player is deleted", async () => {
        const { world, player } = await bankedPlayer();
        await player.inventory.add(stackable("ore", 64), 5);
        await player.itemBank.deposit("ore", 5);
        await world.players.save(player);
        await world.players.remove(player.id);

        const reloaded = defined(await world.players.get(player.id));
        assert.notEqual(reloaded, player);
        assert.equal(await reloaded.itemBank.count("ore"), 5);

        assert.equal(await world.players.delete(player.id), true);
        world.players["activePlayersMap"].delete(player.id);
        assert.equal(await world.players.exist(player.id), false);
        const peek = await spawnLike(world, player.id);
        peek.bankUnlocked = true;
        assert.equal(await peek.itemBank.count("ore"), 0);
    });

    it("emits deposit and withdraw events", async () => {
        const { world, player } = await bankedPlayer();
        const seen: string[] = [];
        world.events.on("itemBankDeposit", (payload) => { seen.push(`deposit:${payload.playerId}:${payload.itemId}:${payload.quantity}`); });
        world.events.on("itemBankWithdraw", (payload) => { seen.push(`withdraw:${payload.playerId}:${payload.itemId}:${payload.quantity}`); });
        await player.inventory.add(stackable("ore", 64), 5);
        await player.itemBank.deposit("ore", 5);
        await player.itemBank.withdraw("ore", 2);
        assert.deepEqual(seen, [`deposit:${player.id}:ore:5`, `withdraw:${player.id}:ore:2`]);
    });

    it("protects banked items from the death item loss", async (t) => {
        stubRandom(t, 0);
        const world = createWorld({ deathMode: "loose", deathItemLoss: { enabled: true, lossRates: { common: 100 } } });
        const player = await spawn(world);
        player.bankUnlocked = true;
        await player.inventory.add(stackable("ore", 64), 10);
        await player.itemBank.deposit("ore", 6);

        await player.takeDamage(99999);
        await sleep(50);
        assert.equal(await findRecord(player, "ore"), undefined, "carried items are lost");
        assert.equal(await player.itemBank.count("ore"), 6, "banked items are safe");
    });

    it("namespaces the storage per player", () => {
        assert.equal(ItemBank.namespaceFor("p1"), "bank:p1");
    });
});

async function spawnLike(world: ReturnType<typeof createWorld>, playerId: string) {
    return world.players.create({ id: playerId, name: "Again", playerClass: "warrior" as never });
}
