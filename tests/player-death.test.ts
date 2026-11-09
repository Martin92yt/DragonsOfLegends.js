/**
 * DragonsOfLegends.js — Death modes (hardcore / cooldown / loose) and item loss on death.
 *
 * Run only this file:  npx tsx --test tests/player-death.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ItemCategory, ItemRarity } from "../src/inventory/item.enum.js";
import { DEFAULT_DEATH_LOSS_RATES, computeLostQuantity, resolveDeathItemLossConfig } from "../src/player/Player.death.js";
import * as errors from "../src/types/error.js";
import { createWorld, defined, findRecord, giveAndEquip, makeEnemy, makeItem, sleep, spawn, stubRandom, totalQuantity, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("Player death modes", () => {
    it("cooldown (default): marks the player dead and reports the cooldown", async (t) => {
        t.mock.method(Date, "now", () => 1_000_000);
        const world = createWorld({ deathCooldown: "5m" });
        const player = await spawn(world);
        world.combat.startWithEnemy(player, makeEnemy());
        const result = defined(await player.takeDamage(99999));
        assert.deepEqual(result.death, { mode: "cooldown", cooldownTime: "5m", cooldownMs: 300_000, respawnAt: 1_300_000 });
        assert.equal(player.isDead, true);
        assert.equal(player.health.current, 0);
        assert.equal(world.combat.has(player.id), false);
        assert.equal(player.inCombat, false);
    });

    it("cooldown: a dead player does not regenerate, so they are never simultaneously dead and alive", async () => {
        const world = createWorld();
        const player = await spawn(world);
        await player.takeDamage(99999);
        world.players.tickRegen(1000);
        assert.equal(player.isAlive(), !player.isDead);
    });

    it("loose: applies the gold penalty and revives immediately", async () => {
        const world = createWorld({ deathMode: "loose", deathPenaltyRate: 10 });
        const player = await spawn(world);
        player.gold = 1000;
        const result = defined(await player.takeDamage(99999));
        assert.deepEqual(result.death, { mode: "loose", lostGold: 100, lostItems: [] });
        assert.equal(player.gold, 900);
        assert.equal(player.health.current, player.health.max);
        assert.equal(player.isDead, false);
    });

    it("loose: uses the default 5% penalty", async () => {
        const world = createWorld({ deathMode: "loose" });
        const player = await spawn(world);
        const result = defined(await player.takeDamage(99999));
        assert.deepEqual(result.death, { mode: "loose", lostGold: 7, lostItems: [] });
    });

    it("loose: keeps every item when deathItemLoss is not enabled", async (t) => {
        stubRandom(t, 0);
        const world = createWorld({ deathMode: "loose" });
        const player = await spawn(world);
        await player.inventory.add(makeItem("relic", ItemCategory.Valuables, ItemRarity.Legendary), 1);
        const result = defined(await player.takeDamage(99999));
        assert.deepEqual(result.death, { mode: "loose", lostGold: 7, lostItems: [] });
        assert.equal(await totalQuantity(player, "relic"), 1);
    });

    it("loose: loses a share of each stack that grows with rarity, and persists it", async (t) => {
        stubRandom(t, 0.999); // no probabilistic bonus unit
        const world = createWorld({ deathMode: "loose", deathItemLoss: { enabled: true } });
        const player = await spawn(world);
        await player.inventory.add(makeItem("pebble", ItemCategory.Materials, ItemRarity.Common, 200), 100);
        await player.inventory.add(makeItem("gem", ItemCategory.Valuables, ItemRarity.Epic, 200), 10);
        await player.inventory.add(makeItem("crown", ItemCategory.Valuables, ItemRarity.Legendary, 200), 4);

        const result = defined(await player.takeDamage(99999));
        assert.equal(result.death?.mode, "loose");
        const lost = result.death?.mode === "loose" ? result.death.lostItems : [];
        assert.deepEqual(
            lost.map(({ itemId, quantity }) => [itemId, quantity]),
            [["pebble", 10], ["gem", 5], ["crown", 3]]
        );
        await sleep(50);
        assert.equal(await totalQuantity(player, "pebble"), 90);
        assert.equal(await totalQuantity(player, "gem"), 5);
        assert.equal(await totalQuantity(player, "crown"), 1);
    });

    it("loose: rolls single items probabilistically and removes emptied stacks", async (t) => {
        const world = createWorld({ deathMode: "loose", deathItemLoss: { enabled: true, lossRates: { rare: 100, common: 0 } } });
        const player = await spawn(world);
        await player.inventory.add(makeItem("blade", ItemCategory.Weapons, ItemRarity.Rare), 1);
        await player.inventory.add(makeItem("twig", ItemCategory.Materials, ItemRarity.Common), 5);
        stubRandom(t, 0.5);
        await player.takeDamage(99999);
        await sleep(50);
        assert.equal(await findRecord(player, "blade"), undefined, "100% empties the stack");
        assert.equal(await totalQuantity(player, "twig"), 5, "0% keeps everything");
    });

    it("loose: protects equipped items by default and can expose them", async (t) => {
        stubRandom(t, 0);
        const protectedWorld = createWorld({ deathMode: "loose", deathItemLoss: { enabled: true, lossRates: { common: 100 } } });
        const guarded = await spawn(protectedWorld);
        await giveAndEquip(guarded, "helmet", makeItem("cap", ItemCategory.Armor));
        await guarded.takeDamage(99999);
        await sleep(50);
        assert.equal(await totalQuantity(guarded, "cap"), 1);

        const exposedWorld = createWorld({ deathMode: "loose", deathItemLoss: { enabled: true, protectEquipped: false, lossRates: { common: 100 } } });
        const exposed = await spawn(exposedWorld);
        await giveAndEquip(exposed, "helmet", makeItem("cap", ItemCategory.Armor));
        await exposed.takeDamage(99999);
        await sleep(50);
        assert.equal(await totalQuantity(exposed, "cap"), 0);
    });

    it("does not apply item loss in cooldown mode", async (t) => {
        stubRandom(t, 0);
        const world = createWorld({ deathMode: "cooldown", deathItemLoss: { enabled: true, lossRates: { common: 100 } } });
        const player = await spawn(world);
        await player.inventory.add(makeItem("coin_pouch"), 3);
        await player.takeDamage(99999);
        await sleep(50);
        assert.equal(await totalQuantity(player, "coin_pouch"), 3);
    });

    it("validates loss rates and computes quantities", () => {
        assert.throws(() => createWorld({ deathItemLoss: { enabled: true, lossRates: { epic: 150 } } }), errors.InvalidDeathLossRateError);
        assert.throws(() => resolveDeathItemLossConfig({ enabled: true, lossRates: { common: Number.NaN } }), errors.InvalidDeathLossRateError);
        assert.deepEqual(resolveDeathItemLossConfig().lossRates, DEFAULT_DEATH_LOSS_RATES);
        assert.equal(resolveDeathItemLossConfig().enabled, false);
        assert.ok(DEFAULT_DEATH_LOSS_RATES.common < DEFAULT_DEATH_LOSS_RATES.uncommon);
        assert.ok(DEFAULT_DEATH_LOSS_RATES.rare < DEFAULT_DEATH_LOSS_RATES.epic);
        assert.ok(DEFAULT_DEATH_LOSS_RATES.epic < DEFAULT_DEATH_LOSS_RATES.legendary);
        assert.equal(computeLostQuantity(10, 50, () => 0.99), 5);
        assert.equal(computeLostQuantity(1, 35, () => 0.1), 1);
        assert.equal(computeLostQuantity(1, 35, () => 0.9), 0);
        assert.equal(computeLostQuantity(3, 100, () => 0.99), 3);
        assert.equal(computeLostQuantity(5, 0, () => 0), 0);
    });

    it("hardcore: flags the death and erases the persisted player", async () => {
        const world = createWorld({ deathMode: "hardcore" });
        const player = await spawn(world);
        const result = defined(await player.takeDamage(99999));
        await sleep(100);
        assert.deepEqual(result.death, { mode: "hardcore", deleted: true });
        assert.equal(player.isDead, true);
        assert.equal(world.players.count().total, 0);
    });

    it("hardcore: the deleted player can no longer be found", async () => {
        const world = createWorld({ deathMode: "hardcore" });
        const player = await spawn(world);
        await player.takeDamage(99999);
        await sleep(100);
        assert.equal(await world.players.exist(player.id), false);
    });

    it("unknown modes fall back to an immediate revival", async () => {
        const world = createWorld({ deathMode: "mystery" as unknown as "loose" });
        const player = await spawn(world);
        const result = defined(await player.takeDamage(99999));
        assert.deepEqual(result.death, { mode: "default", revived: true });
        assert.equal(player.health.current, player.health.max);
    });
});
