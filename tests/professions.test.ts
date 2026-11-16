/**
 * DragonsOfLegends.js — Professions: crafting (blacksmith), enchanting (Lifesteal, Mending), farming, potions.
 *
 * Run only this file:  npx tsx --test tests/professions.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import PlayerFarm from "../src/farming/player.farm.js";
import { ItemCategory } from "../src/inventory/item.enum.js";
import * as errors from "../src/types/error.js";
import { createWorld, defined, findRecord, giveAndEquip, makeEnemy, makeItem, settle, spawn, totalQuantity, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

const official = () => createWorld({ officialPack: true });

describe("Crafting (blacksmith)", () => {
    it("forges a sword whose stats scale with the blacksmith level", async () => {
        const world = official();
        const player = await spawn(world);
        await player.inventory.add(makeItem("copper_ingot"), 6);
        await player.inventory.add(makeItem("oak_log"), 2);

        const novice = await world.crafting.craft(player, "forge_copper_sword");
        assert.equal(novice.crafted, true);
        assert.equal(novice.produced[0]?.nbt?.damageBonus, 4, "level 1 = base damage");
        assert.ok(novice.xpGained > 0);

        await player.jobs.addExperience("blacksmithing", 5000); // a seasoned smith
        const master = await world.crafting.craft(player, "forge_copper_sword");
        const level = master.jobLevel;
        assert.ok(level > 1);
        assert.ok((master.produced[0]?.nbt?.damageBonus ?? 0) > 4, "a better smith forges a stronger sword");
        assert.equal(await totalQuantity(player, "copper_ingot"), 0);
        assert.equal(await totalQuantity(player, "copper_sword"), 2);
    });

    it("refuses a recipe that is locked or lacks ingredients, and lets a listener cancel it", async () => {
        const world = official();
        const player = await spawn(world);
        await assert.rejects(world.crafting.craft(player, "forge_steel_sword"), errors.RecipeLevelTooLowError);
        await assert.rejects(world.crafting.craft(player, "forge_copper_sword"), errors.MissingIngredientsError);
        await assert.rejects(world.crafting.craft(player, "nope"), errors.UnknownRecipeError);
        assert.deepEqual(world.crafting.listUnlocked(player, "blacksmithing").map((recipe) => recipe.id), ["smelt_copper_ingot", "forge_copper_sword"]);

        await player.inventory.add(makeItem("copper_ingot"), 3);
        await player.inventory.add(makeItem("oak_log"), 1);
        world.events.on("itemCraft", (event) => event.cancel("closed"));
        const result = await world.crafting.craft(player, "forge_copper_sword");
        assert.equal(result.crafted, false);
        assert.equal(await totalQuantity(player, "copper_ingot"), 3, "nothing consumed");
        assert.equal(await findRecord(player, "copper_sword"), undefined);
    });
});

describe("Enchanting", () => {
    it("Lifesteal heals the player by 3% of the enemy's health on each blow", async () => {
        const world = official();
        const player = await spawn(world);
        player.experience.current = 100;
        const sword = defined(world.items.get("iron_sword"));
        await giveAndEquip(player, "sword", sword, { damageBonus: 6, durability: 100 });

        const result = await world.enchanting.enchant(player, { itemId: "iron_sword", slot: "sword" }, "lifesteal");
        assert.equal(result.enchanted, true);
        assert.equal(result.level, 1);
        assert.equal(player.gold, 0, "150 gold paid");
        assert.equal(player.experience.current, 80, "20 experience paid");

        player.health.current = 50;
        world.combat.startWithEnemy(player, makeEnemy({ health: 1000, strength: 1 }));
        const turn = await world.combat.attack(player.id);
        // 3% of 1000 = 30 healed, then the enemy hits back.
        assert.equal(player.health.current, 50 + 30 - turn.playerDamage);
    });

    it("an enchantment can be cancelled and nothing is paid", async () => {
        const world = official();
        const player = await spawn(world);
        player.experience.current = 100;
        await giveAndEquip(player, "sword", defined(world.items.get("iron_sword")), { damageBonus: 6, durability: 100 });
        world.events.on("itemEnchant", (event) => event.cancel());
        const result = await world.enchanting.enchant(player, { itemId: "iron_sword", slot: "sword" }, "lifesteal");
        assert.equal(result.cancelled, true);
        assert.equal(player.gold, 150);
        assert.equal(player.experience.current, 100);
    });

    it("rejects an enchantment on the wrong item type", async () => {
        const world = official();
        const player = await spawn(world);
        await player.inventory.add(makeItem("potion_x", ItemCategory.Consumables), 1);
        await assert.rejects(world.enchanting.enchant(player, { itemId: "potion_x" }, "lifesteal"), errors.EnchantingError);
    });

    it("Mending repairs the worn item when the player gains experience", async () => {
        const world = official();
        const player = await spawn(world);
        player.experience.current = 100;
        await player.jobs.addExperience("enchanting", 1000);
        await player.inventory.add(makeItem("resin"), 2);
        await giveAndEquip(player, "sword", defined(world.items.get("iron_sword")), { damageBonus: 6, durability: 50, maxDurability: 100 });
        await world.enchanting.enchant(player, { itemId: "iron_sword", slot: "sword" }, "mending");

        const repairs: number[] = [];
        world.events.on("itemRepair", (event) => void repairs.push(event.repaired));
        player.addXP(10);
        await settle();
        assert.equal((await findRecord(player, "iron_sword"))?.itemNbtData?.durability, 70, "10 xp x 2 durability");
        assert.deepEqual(repairs, [20]);
    });
});

describe("Farming (farmer)", () => {
    it("plants, waits for the crop to grow, then harvests ingredients and seeds", async (t) => {
        const world = official();
        const player = await spawn(world);
        await player.inventory.add(makeItem("wheat_seeds"), 1);
        let now = 1_000_000;
        t.mock.method(Date, "now", () => now);

        const planted = await world.farming.plant(player, "wheat", 0);
        assert.equal(planted.planted, true);
        assert.equal(await totalQuantity(player, "wheat_seeds"), 0, "seed consumed");
        assert.equal(world.farming.getPlots(player)[0]?.ready, false);
        await assert.rejects(world.farming.harvest(player, 0), errors.CropNotReadyError);
        await assert.rejects(world.farming.plant(player, "wheat", 0), errors.FarmingError, "plot already used");

        // Persisted state round-trips.
        assert.equal(new PlayerFarm(player.farm.toState()).get(0)?.cropId, "wheat");

        now += 60_000;
        t.mock.method(Math, "random", () => 0.5);
        const harvest = await world.farming.harvest(player, 0);
        assert.equal(harvest.harvested, true);
        assert.ok((await totalQuantity(player, "wheat")) >= 2);
        assert.ok(harvest.xpGained > 0);
        assert.equal(player.farm.get(0), undefined, "the plot is free again");
    });

    it("a cancelled harvest leaves the crop in place; growth is faster at a higher level", async (t) => {
        const world = official();
        const player = await spawn(world);
        const crop = defined(world.farming.get("wheat"));
        assert.ok(world.farming.getGrowTimeMs(crop, 10) < world.farming.getGrowTimeMs(crop, 1));

        await player.inventory.add(makeItem("carrot_seeds"), 1);
        let now = 5_000;
        t.mock.method(Date, "now", () => now);
        await world.farming.plant(player, "carrot", 1);
        now += 90_000;
        world.events.on("cropHarvest", (event) => event.cancel());
        const result = await world.farming.harvest(player, 1);
        assert.equal(result.harvested, false);
        assert.ok(player.farm.get(1), "the crop stays planted");
    });

    it("a crop can be refused at planting without consuming the seed", async () => {
        const world = official();
        const player = await spawn(world);
        await player.inventory.add(makeItem("wheat_seeds"), 1);
        world.events.on("cropPlant", (event) => event.cancel());
        assert.equal((await world.farming.plant(player, "wheat", 0)).planted, false);
        assert.equal(await totalQuantity(player, "wheat_seeds"), 1);
    });
});

describe("Potions", () => {
    it("does not waste a healing potion on a player at full health", async () => {
        const world = official();
        const player = await spawn(world);
        assert.equal(await player.inventory.use("health_potion"), false);
        assert.equal(await totalQuantity(player, "health_potion"), 3);
        player.health.current = 10;
        assert.equal(await player.inventory.use("health_potion"), true);
        assert.equal(player.health.current, 40);
        assert.equal(await totalQuantity(player, "health_potion"), 2);
    });

    it("reports an unknown effect before consuming the potion", async () => {
        const world = official();
        const player = await spawn(world);
        const broken = { ...makeItem("broken_potion", ItemCategory.Consumables), use: { effects: ["does_not_exist"] } };
        world.items.register(broken);
        await player.inventory.add(broken, 1);
        await assert.rejects(player.inventory.use("broken_potion"));
        assert.equal(await totalQuantity(player, "broken_potion"), 1, "the potion is not lost");
    });
});
