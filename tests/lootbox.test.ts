/**
 * DragonsOfLegends.js — Lootboxes: weighted loot tables, rarity tiers, luck and opening.
 *
 * Run only this file:  npx tsx --test tests/lootbox.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OFFICIAL_LOOTBOXES } from "../src/content/official-items.js";
import { ItemCategory, ItemRarity } from "../src/inventory/item.enum.js";
import { computeDropChances, pickDrop, rollInRange } from "../src/lootbox/lootbox.rules.js";
import type { LootboxDrop } from "../src/lootbox/lootbox.types.js";
import { InvalidRegistryEntryError } from "../src/types/error.js";
import { createWorld, makeItem, spawn, totalQuantity, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

const world = () => createWorld({ premadeItems: true, starterItems: {} });
const common = () => ItemRarity.Common;

const TABLE: readonly LootboxDrop[] = [
    { kind: "gold", weight: 70, minAmount: 10, maxAmount: 10 },
    { kind: "item", itemId: "a", weight: 25, minQuantity: 1, maxQuantity: 1, rarity: ItemRarity.Rare },
    { kind: "item", itemId: "b", weight: 5, minQuantity: 1, maxQuantity: 1, rarity: ItemRarity.Legendary }
];
const rarityOf = (drop: LootboxDrop): ItemRarity => drop.rarity ?? ItemRarity.Common;

describe("Lootbox probabilities", () => {
    it("turns the weights into probabilities that sum to 1", () => {
        const chances = computeDropChances(TABLE, 0, rarityOf).map((entry) => entry.chance);
        assert.deepEqual(chances, [0.7, 0.25, 0.05]);
        assert.ok(Math.abs(chances.reduce((sum, chance) => sum + chance, 0) - 1) < 1e-12);
    });

    it("luck favours rare drops only, and still sums to 1", () => {
        const base = computeDropChances(TABLE, 0, rarityOf).map((entry) => entry.chance);
        const lucky = computeDropChances(TABLE, 50, rarityOf).map((entry) => entry.chance);
        assert.ok((lucky[0] ?? 1) < (base[0] ?? 0), "the common drop becomes less likely");
        assert.ok((lucky[1] ?? 0) > (base[1] ?? 1));
        assert.ok((lucky[2] ?? 0) > (base[2] ?? 1));
        assert.ok(Math.abs(lucky.reduce((sum, chance) => sum + chance, 0) - 1) < 1e-12);
    });

    it("never boosts common drops and ignores negative luck", () => {
        const commons: LootboxDrop[] = [{ kind: "gold", weight: 1, minAmount: 1, maxAmount: 1 }, { kind: "gold", weight: 3, minAmount: 1, maxAmount: 1 }];
        assert.deepEqual(computeDropChances(commons, 500, common).map((entry) => entry.chance), [0.25, 0.75]);
        assert.deepEqual(computeDropChances(TABLE, -80, rarityOf), computeDropChances(TABLE, 0, rarityOf));
    });

    it("picks the drop that the roll lands on (boundaries included)", () => {
        const pick = (random: number) => pickDrop(TABLE, 0, rarityOf, () => random);
        assert.equal(pick(0)?.kind, "gold");
        assert.equal(pick(0.69999)?.kind, "gold");
        assert.equal((pick(0.7) as { itemId: string }).itemId, "a");
        assert.equal((pick(0.94999) as { itemId: string }).itemId, "a");
        assert.equal((pick(0.95) as { itemId: string }).itemId, "b");
        assert.equal((pick(0.999999) as { itemId: string }).itemId, "b");
        assert.equal(pickDrop([], 0, common), undefined);
    });

    it("matches the announced probabilities over many seeded rolls", () => {
        let seed = 12345;
        const random = (): number => {
            seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
            return seed / 4_294_967_296;
        };
        const counts = [0, 0, 0];
        const rolls = 60_000;
        for (let roll = 0; roll < rolls; roll++) {
            const index = TABLE.indexOf(pickDrop(TABLE, 0, rarityOf, random) as LootboxDrop);
            counts[index] = (counts[index] ?? 0) + 1;
        }
        const total = counts.reduce((sum, count) => sum + count, 0);
        assert.equal(total, rolls);
        for (const [index, expected] of [0.7, 0.25, 0.05].entries()) {
            assert.ok(Math.abs((counts[index] ?? 0) / total - expected) < 0.01, `drop ${index}: ${(counts[index] ?? 0) / total} vs ${expected}`);
        }
    });

    it("rolls integers within inclusive bounds", () => {
        assert.equal(rollInRange(3, 3, () => 0.99), 3);
        assert.equal(rollInRange(1, 6, () => 0), 1);
        assert.equal(rollInRange(1, 6, () => 0.999999), 6);
    });
});

describe("Lootbox registry", () => {
    it("ships four tiers, each with a valid table", () => {
        const instance = world();
        assert.deepEqual(OFFICIAL_LOOTBOXES.map((box) => box.rarity), [ItemRarity.Common, ItemRarity.Rare, ItemRarity.Epic, ItemRarity.Legendary]);
        for (const box of OFFICIAL_LOOTBOXES) {
            const total = instance.lootboxes.getDropChances(box.id).reduce((sum, entry) => sum + entry.chance, 0);
            assert.ok(Math.abs(total - 1) < 1e-12, box.id);
        }
    });

    it("grants gold, equipment, amulets and consumables across the official tables", () => {
        const kinds = new Set<string>();
        const instance = world();
        for (const box of OFFICIAL_LOOTBOXES) {
            for (const drop of box.drops) kinds.add(drop.kind === "gold" ? "gold" : instance.items.require(drop.itemId).category);
        }
        for (const expected of ["gold", ItemCategory.Weapons, ItemCategory.Amulet, ItemCategory.Consumables]) assert.ok(kinds.has(expected), expected);
    });

    it("better tiers are more likely to drop rare loot", () => {
        const instance = world();
        const rareShare = (id: string): number =>
            instance.lootboxes.getDropChances(id).filter((entry) => entry.drop.kind === "item" && ["rare", "epic", "legendary"].includes(instance.items.require(entry.drop.itemId).rarity)).reduce((sum, entry) => sum + entry.chance, 0);
        assert.ok(rareShare("pouch_rare") > rareShare("pouch_common"));
        assert.ok(rareShare("pouch_epic") > rareShare("pouch_rare"));
    });

    it("rejects invalid definitions", () => {
        const instance = createWorld({ premadeContent: false, premadeMap: true, premadeClasses: true, customItems: [makeItem("gem")] });
        const box = { id: "b", name: "B", rarity: ItemRarity.Common };
        assert.throws(() => instance.lootboxes.register({ ...box, drops: [] }), InvalidRegistryEntryError);
        assert.throws(() => instance.lootboxes.register({ ...box, drops: [{ kind: "gold", weight: 0, minAmount: 1, maxAmount: 2 }] }), InvalidRegistryEntryError);
        assert.throws(() => instance.lootboxes.register({ ...box, drops: [{ kind: "gold", weight: 1, minAmount: 5, maxAmount: 2 }] }), InvalidRegistryEntryError);
        assert.throws(() => instance.lootboxes.register({ ...box, drops: [{ kind: "item", itemId: "ghost", weight: 1, minQuantity: 1, maxQuantity: 1 }] }), InvalidRegistryEntryError);
        assert.throws(() => instance.lootboxes.register({ ...box, rolls: 0, drops: [{ kind: "gold", weight: 1, minAmount: 1, maxAmount: 1 }] }), InvalidRegistryEntryError);
        assert.throws(() => instance.lootboxes.register({ ...box, rarity: "mythic" as ItemRarity, drops: [{ kind: "gold", weight: 1, minAmount: 1, maxAmount: 1 }] }), InvalidRegistryEntryError);
        instance.lootboxes.register({ ...box, drops: [{ kind: "item", itemId: "gem", weight: 1, minQuantity: 1, maxQuantity: 1 }] });
    });
});

describe("Opening a lootbox", () => {
    it("grants gold to the wallet and items to the inventory, and emits an event", async () => {
        const instance = world();
        const player = await spawn(instance);
        const gold = player.gold;
        const events: string[] = [];
        instance.events.on("lootboxOpen", (payload) => { events.push(payload.result.lootboxId); });

        const first = await instance.lootboxes.open(player, "pouch_common", { random: () => 0 });
        assert.equal(first.rewards[0]?.kind, "gold");
        assert.equal(player.gold, gold + first.gold);
        assert.ok(first.gold >= 20 && first.gold <= 60);

        const second = await instance.lootboxes.open(player, "pouch_common", { random: () => 0.6 });
        assert.equal(second.rewards[0]?.kind, "item");
        assert.equal(await totalQuantity(player, "health_potion") > 0, true);
        assert.deepEqual(events, ["pouch_common", "pouch_common"]);
    });

    it("rolls several times for the higher tiers", async () => {
        const instance = world();
        const player = await spawn(instance);
        assert.equal((await instance.lootboxes.open(player, "pouch_epic", { random: () => 0 })).rewards.length, 2);
        assert.equal((await instance.lootboxes.open(player, "pouch_legendary", { random: () => 0 })).rewards.length, 3);
    });

    it("gives amulets their modifiers", async () => {
        const instance = world();
        const player = await spawn(instance);
        await instance.lootboxes.open(player, "pouch_common", { random: () => 0.97 });
        const records = await player.inventory.getItems();
        const amulet = records.find((record) => record.category === ItemCategory.Amulet);
        assert.ok(amulet?.itemNbtData);
    });

    it("uses the luck of the player unless overridden", async () => {
        const instance = world();
        const player = await spawn(instance);
        await player.inventory.add(instance.items.require("luck_amulet"), 1);
        await player.inventory.equip("amulet1", "luck_amulet");
        assert.equal((await instance.lootboxes.open(player, "pouch_common", { random: () => 0 })).luckPercent, 10);
        assert.equal((await instance.lootboxes.open(player, "pouch_common", { random: () => 0, luckPercent: 0 })).luckPercent, 0);
    });

    it("is opened by using a pouch item, which is consumed", async () => {
        const instance = world();
        const player = await spawn(instance);
        await player.inventory.add(instance.items.require("pouch_common"), 2);
        const opened: number[] = [];
        instance.events.on("itemUse", (payload) => { opened.push(payload.lootboxes.length); });
        assert.equal(await player.inventory.use("pouch_common"), true);
        assert.equal(await totalQuantity(player, "pouch_common"), 1);
        assert.deepEqual(opened, [1]);
    });

    it("rejects an unknown lootbox", async () => {
        const instance = world();
        const player = await spawn(instance);
        await assert.rejects(() => instance.lootboxes.open(player, "ghost"));
    });
});
