/**
 * DragonsOfLegends.js — InventoryEntity: stacks, equipment, economy and persistence.
 *
 * Run only this file:  npx tsx --test tests/inventory.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ItemCategory, ItemRarity } from "../src/inventory/item.enum.js";
import { createWorld, defined, findRecord, giveAndEquip, makeItem, settle, spawn, totalQuantity, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("InventoryEntity add / remove", () => {
    it("adds items and defaults maxStack to 64", async () => {
        const player = await spawn(createWorld());
        await player.inventory.add({ itemId: "rope", name: "Rope", category: ItemCategory.Materials, rarity: ItemRarity.Common }, 2);
        const record = defined(await findRecord(player, "rope"));
        assert.equal(record.quantity, 2);
        assert.equal(record.maxStack, 64);
        assert.equal(record.isEquipped, false);
        assert.equal(record.playerId, player.id);
    });

    it("ignores non-positive quantities and unknown string identifiers", async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("rope"), 0);
        await player.inventory.add(makeItem("rope"), -3);
        await player.inventory.add("ghost", 1);
        assert.equal((await player.inventory.getItems()).length, 0);
    });

    it("stacks identical items, also when added by identifier", async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("rope"), 2);
        await player.inventory.add(makeItem("rope"), 3);
        await player.inventory.add("rope", 4);
        assert.equal((await player.inventory.getItems()).length, 1);
        assert.equal(await totalQuantity(player, "rope"), 9);
    });

    it("keeps items carrying NBT data as separate records", async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("blade", ItemCategory.Weapons), 1, { durability: 50 });
        await player.inventory.add(makeItem("blade", ItemCategory.Weapons), 1, { durability: 50 });
        const blades = (await player.inventory.getItems()).filter((record) => record.itemId === "blade");
        assert.equal(blades.length, 2);
        assert.deepEqual(blades[0].itemNbtData, { durability: 50 });
    });

    it("never loses a concurrent add", { todo: "C3 read-modify-write without a lock loses concurrent updates" }, async () => {
        const player = await spawn(createWorld());
        await Promise.all([player.inventory.add(makeItem("rope"), 1), player.inventory.add(makeItem("rope"), 1)]);
        assert.equal(await totalQuantity(player, "rope"), 2);
    });

    it("respects maxStack", { todo: "C3 maxStack is never enforced" }, async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("rope", ItemCategory.Materials, ItemRarity.Common, 64), 200);
        const records = await player.inventory.getItems();
        assert.ok(records.every((record) => record.quantity <= 64));
    });

    it("removes quantities, deleting emptied records", async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("rope"), 5);
        assert.equal(await player.inventory.remove("rope", 2), true);
        assert.equal(await totalQuantity(player, "rope"), 3);
        assert.equal(await player.inventory.remove({ itemId: "rope" }, 3), true);
        assert.equal(await findRecord(player, "rope"), undefined);
    });

    it("refuses invalid removals", async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("rope"), 2);
        assert.equal(await player.inventory.remove("rope", 3), false);
        assert.equal(await player.inventory.remove("ghost", 1), false);
        assert.equal(await player.inventory.remove("rope", 0), false);
        assert.equal(await player.inventory.remove("rope", -1), false);
        assert.equal(await totalQuantity(player, "rope"), 2);
    });

    it("preserves the display name of stored items", { todo: "C4 SQLite adapter overwrites name with itemId (operator precedence)" }, async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("sword", ItemCategory.Weapons), 1);
        assert.equal((await findRecord(player, "sword"))?.name, "Display sword");
    });
});

describe("InventoryEntity equipment", () => {
    it("equips compatible categories and rejects the others", async () => {
        const player = await spawn(createWorld());
        const { inventory } = player;
        await inventory.add(makeItem("helm", ItemCategory.Armor), 1);
        await inventory.add(makeItem("axe", ItemCategory.Weapons), 1);
        await inventory.add(makeItem("charm", ItemCategory.Amulet), 1);
        await inventory.add(makeItem("gem", ItemCategory.Valuables), 1);
        await inventory.add(makeItem("meat", ItemCategory.Consumables), 1);
        await inventory.add(makeItem("pick", ItemCategory.Tool), 1);

        assert.equal(await inventory.equip("helmet", "helm"), true);
        assert.equal(await inventory.equip("helmet", "axe"), false);
        assert.equal(await inventory.equip("sword", "axe"), true);
        assert.equal(await inventory.equip("amulet1", "charm"), true);
        assert.equal(await inventory.equip("amulet2", "gem"), true);
        assert.equal(await inventory.equip("shield", "pick"), true);
        assert.equal(await inventory.equip("chest", "meat"), false);
        assert.equal(await inventory.equip("boots", "ghost"), false);
        await settle();
    });

    it("replaces whatever occupies the slot", async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("sword_a", ItemCategory.Weapons), 1);
        await player.inventory.add(makeItem("sword_b", ItemCategory.Weapons), 1);
        await player.inventory.equip("sword", "sword_a");
        await player.inventory.equip("sword", "sword_b");
        await settle();
        assert.equal((await findRecord(player, "sword_a"))?.isEquipped, false);
        assert.equal((await player.inventory.getEquippedInSlot("sword"))?.itemId, "sword_b");
    });

    it("splits a stack when equipping one unit", async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("helm", ItemCategory.Armor), 3);
        await player.inventory.equip("helmet", "helm");
        await settle();
        const records = await player.inventory.getItems();
        assert.equal(records.length, 2);
        assert.equal(records.find((record) => record.isEquipped)?.quantity, 1);
        assert.equal(records.find((record) => !record.isEquipped)?.quantity, 2);
    });

    it("unequips, and reports empty slots", async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("helm", ItemCategory.Armor), 1);
        await player.inventory.equip("helmet", "helm");
        assert.equal(await player.inventory.unequip("helmet"), true);
        assert.equal(await player.inventory.unequip("helmet"), false);
        assert.equal(await player.inventory.getEquippedInSlot("helmet"), undefined);
        await settle();
    });

    it("never removes or sells an equipped item", async () => {
        const player = await spawn(createWorld());
        await giveAndEquip(player, "sword", makeItem("blade", ItemCategory.Weapons), { durability: 100 });
        assert.equal(await player.inventory.remove("blade", 1), false);
        assert.equal(await player.inventory.sellItem("blade", 1), 0);
    });

    it("returns an all-null equipment record when nothing is worn", async () => {
        const player = await spawn(createWorld());
        const equipment = await player.inventory.getEquipment();
        assert.equal(equipment.playerId, player.id);
        assert.ok(Object.entries(equipment).filter(([key]) => key !== "playerId").every(([, value]) => value === null));
    });

    it("maps worn items to the declared EquipmentRecord fields", { todo: "C10 adapters write record['helmet'] instead of record.helmetItemId" }, async () => {
        const player = await spawn(createWorld());
        await giveAndEquip(player, "helmet", makeItem("helm", ItemCategory.Armor));
        await giveAndEquip(player, "amulet1", makeItem("charm", ItemCategory.Amulet));
        const equipment = await player.inventory.getEquipment();
        assert.equal(equipment.helmetItemId, "helm");
        assert.equal(equipment.amuletOneItemId, "charm");
    });
});

describe("InventoryEntity economy and persistence", () => {
    it("computes sell values from category, rarity and durability", async () => {
        const player = await spawn(createWorld());
        const startGold = player.gold;
        // Rationale: value = 10 * categoryMultiplier * rarityMultiplier * durabilityRatio * (quantity / 9).
        await player.inventory.add(makeItem("ore"), 9);
        assert.equal(await player.inventory.sellItem("ore", 9), 10);
        await player.inventory.add(makeItem("blade", ItemCategory.Weapons, ItemRarity.Rare, 1), 9, { durability: 50 });
        assert.equal(await player.inventory.sellItem("blade", 9), 10 * 4 * 5 * 0.5);
        await player.inventory.add(makeItem("orb", ItemCategory.Valuables, ItemRarity.Legendary, 99), 9);
        assert.equal(await player.inventory.sellItem("orb", 9), 10 * 2 * 50);
        assert.equal(player.gold, startGold + 10 + 100 + 1000);
        assert.equal((await player.inventory.getItems()).length, 0);
    });

    it("pays at least one gold, even for broken or single items", async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("ore"), 1);
        assert.equal(await player.inventory.sellItem("ore", 1), 1);
        await player.inventory.add(makeItem("junk", ItemCategory.Weapons), 9, { durability: 0 });
        assert.equal(await player.inventory.sellItem("junk", 9), 1);
    });

    it("refuses invalid sales", async () => {
        const player = await spawn(createWorld());
        const startGold = player.gold;
        await player.inventory.add(makeItem("ore"), 2);
        assert.equal(await player.inventory.sellItem("ore", 3), 0);
        assert.equal(await player.inventory.sellItem("ghost", 1), 0);
        assert.equal(await player.inventory.sellItem("ore", 0), 0);
        assert.equal(await player.inventory.sellItem("ore", -1), 0);
        assert.equal(player.gold, startGold);
    });

    it("clears the inventory", async () => {
        const player = await spawn(createWorld());
        assert.equal(await player.inventory.clear(), false);
        await player.inventory.add(makeItem("ore"), 2);
        assert.equal(await player.inventory.clear(), true);
        assert.deepEqual(await player.inventory.getItems(), []);
    });

    it("saves an explicit item list and reloads it", async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("ore"), 2);
        const items = await player.inventory.getItems();
        items[0].quantity = 7;
        await player.inventory.save(items);
        assert.equal(await totalQuantity(player, "ore"), 7);
        await assert.doesNotReject(player.inventory.save());
    });

    it("can be re-bound to another player", async () => {
        const world = createWorld();
        const [a, b] = [await spawn(world), await spawn(world)];
        a.inventory.setPlayer(b);
        assert.equal(a.inventory.playerEntityReference, b);
    });

    it("consumes usable items", async () => {
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("potion", ItemCategory.Consumables), 2);
        assert.equal(await Promise.resolve(player.inventory.use("potion", 1)), true);
        assert.equal(await totalQuantity(player, "potion"), 1);
    });

    it("grants the configured starter items to new players", async () => {
        const player = await spawn(createWorld({ premadeItems: true }));
        assert.equal(await totalQuantity(player, "health_potion"), 3);
        assert.equal(await totalQuantity(player, "rusty_sword"), 1);
    });
});
