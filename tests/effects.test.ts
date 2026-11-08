/**
 * DragonsOfLegends.js — Temporary effects: potions, buffs, heal over time, persistence.
 *
 * Run only this file:  npx tsx --test tests/effects.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OFFICIAL_EFFECTS, OFFICIAL_ITEMS } from "../src/content/official-items.js";
import PlayerEffects from "../src/player/player.effects.js";
import { InvalidRegistryEntryError } from "../src/types/error.js";
import { createWorld, makeItem, spawn, totalQuantity, useIsolatedWorkspace } from "./helpers/fixtures.js";
import { ItemCategory } from "../src/inventory/item.enum.js";

useIsolatedWorkspace();

const world = () => createWorld({ premadeItems: true, starterItems: {} });

describe("Effect registry", () => {
    it("ships the regeneration and experience boost effects", () => {
        const instance = world();
        assert.equal(instance.effects.require("regeneration").durationMs, 60_000);
        assert.deepEqual(instance.effects.require("regeneration").tick, { intervalMs: 1_000, heal: 10 });
        assert.equal(instance.effects.require("xp_boost").modifiers?.xpMultiplier, 2);
        assert.equal(OFFICIAL_EFFECTS.length, 2);
    });

    it("rejects invalid definitions", () => {
        const instance = createWorld({ premadeContent: false });
        assert.throws(() => instance.effects.register({ id: "x", name: "X", durationMs: 0 }), InvalidRegistryEntryError);
        assert.throws(() => instance.effects.register({ id: "x", name: "X", durationMs: 1000, tick: { intervalMs: 10, heal: 1 } }), InvalidRegistryEntryError);
        assert.throws(() => instance.effects.register({ id: "x", name: "X", durationMs: 1000, modifiers: { xpMultiplier: -1 } }), InvalidRegistryEntryError);
        assert.throws(() => instance.effects.register({ id: " ", name: "X", durationMs: 1000 }), InvalidRegistryEntryError);
    });

    it("lets a pack add a new potion with one effect and one item", async () => {
        const instance = createWorld({
            premadeContent: false,
            premadeMap: true,
            premadeClasses: true,
            customEffects: [{ id: "luck_brew", name: "Luck Brew", durationMs: 30_000, modifiers: { luckPercent: 25 } }],
            customItems: [{ ...makeItem("luck_brew_potion", ItemCategory.Consumables), use: { effects: ["luck_brew"] } }]
        });
        const player = await spawn(instance);
        await player.inventory.add(instance.items.require("luck_brew_potion"), 1);
        assert.equal(await player.inventory.use("luck_brew_potion"), true);
        assert.equal((await player.getModifiers()).luckPercent, 25);
    });
});

describe("Temporary effects of a player", () => {
    it("applies, reports the time left and expires with a mocked clock", async (t) => {
        t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
        const player = await spawn(world());
        await player.effects.apply("xp_boost");
        assert.equal(player.effects.has("xp_boost"), true);
        assert.equal(player.effects.getRemainingMs("xp_boost"), 15 * 60_000);

        t.mock.timers.tick(14 * 60_000);
        assert.equal(player.effects.getRemainingMs("xp_boost"), 60_000);
        assert.equal(player.effects.getModifiers().xpMultiplier, 2);

        t.mock.timers.tick(60_000);
        assert.equal(player.effects.has("xp_boost"), false);
        assert.equal(player.effects.getModifiers().xpMultiplier, 1);
    });

    it("heals 10 health per second for 60 seconds, never above the maximum", async (t) => {
        t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
        const player = await spawn(world());
        player.health.current = 1;
        await player.effects.apply("regeneration");

        await player.effects.sync(Date.now() + 3_000);
        assert.equal(player.health.current, Math.min(player.health.max, 31));

        await player.effects.sync(Date.now() + 10 * 60_000); // long after the end: every tick is credited once, then capped
        assert.equal(player.health.current, player.health.max);
        assert.equal(player.effects.has("regeneration"), false);
    });

    it("credits exactly 60 ticks when the effect ends", async (t) => {
        t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
        const player = await spawn(world());
        player.health.max = 100_000;
        player.health.current = 1;
        await player.effects.apply("regeneration");
        await player.effects.sync(Date.now() + 5 * 60_000);
        assert.equal(player.health.current, 1 + 60 * 10);
    });

    it("never heals a dead player", async (t) => {
        t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
        const player = await spawn(world());
        player.health.current = 1;
        player.life.die(60_000);
        const before = player.health.current;
        assert.equal(player.heal(10), 0);
        assert.equal(player.health.current, before);
    });

    it("refreshes an active effect instead of stacking it", async (t) => {
        t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
        const player = await spawn(world());
        await player.effects.apply("xp_boost");
        t.mock.timers.tick(5 * 60_000);
        await player.effects.apply("xp_boost");
        assert.equal(player.effects.getRemainingMs("xp_boost"), 15 * 60_000);
        assert.equal(player.effects.getModifiers().xpMultiplier, 2, "the multiplier is never applied twice");
        assert.equal(player.effects.list().length, 1);
    });

    it("extends the duration with the extend stacking mode", async (t) => {
        t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
        const instance = createWorld({ premadeContent: false, premadeMap: true,
            premadeClasses: true, customEffects: [{ id: "long", name: "Long", durationMs: 10_000, stacking: "extend" }] });
        const player = await spawn(instance);
        await player.effects.apply("long");
        t.mock.timers.tick(4_000);
        await player.effects.apply("long");
        assert.equal(player.effects.getRemainingMs("long"), 16_000);
    });

    it("runs the lifecycle hooks and emits the events", async (t) => {
        t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
        const calls: string[] = [];
        const instance = createWorld({
            premadeContent: false,
            premadeMap: true,
            premadeClasses: true,
            customEffects: [{
                id: "poison", name: "Poison", durationMs: 3_000,
                tick: { intervalMs: 1_000, run: () => { calls.push("tick"); } },
                onApply: () => { calls.push("apply"); },
                onExpire: () => { calls.push("expire"); }
            }]
        });
        instance.events.on("effectApply", () => { calls.push("event:apply"); });
        instance.events.on("effectExpire", () => { calls.push("event:expire"); });
        const player = await spawn(instance);
        await player.effects.apply("poison");
        await player.effects.sync(Date.now() + 3_000);
        assert.deepEqual(calls, ["apply", "event:apply", "tick", "tick", "tick", "expire", "event:expire"]);
    });

    it("removes an effect without running onExpire, and clears all effects", async () => {
        const player = await spawn(world());
        await player.effects.apply("xp_boost");
        await player.effects.apply("regeneration");
        assert.equal(await player.effects.remove("xp_boost"), true);
        assert.equal(await player.effects.remove("xp_boost"), false);
        assert.equal(await player.effects.clear(), 1);
        assert.deepEqual(player.effects.list(), []);
        player.effects.dispose();
    });

    it("rejects an unknown effect and a non-positive duration", async () => {
        const player = await spawn(world());
        await assert.rejects(() => player.effects.apply("ghost"));
        await assert.rejects(() => player.effects.apply("xp_boost", { durationMs: 0 }));
    });

    it("persists across a reload and catches up the ticks missed meanwhile", async (t) => {
        t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
        const instance = world();
        const player = await spawn(instance);
        player.health.max = 100_000;
        player.health.current = 1;
        await player.effects.apply("regeneration");
        const state = player.effects.toState();
        player.effects.dispose();

        const restored = new PlayerEffects(player, state);
        t.mock.timers.tick(10_000);
        await restored.sync();
        assert.equal(player.health.current, 1 + 10 * 10, "10 seconds of regeneration were credited after the reload");
        assert.equal(restored.has("regeneration"), true);
        restored.dispose();
    });

    it("ignores a corrupted saved state", async () => {
        const player = await spawn(world());
        const restored = new PlayerEffects(player, { regeneration: { appliedAt: "x" }, bad: 5, xp_boost: null });
        assert.deepEqual(restored.toState(), {});
        restored.dispose();
    });
});

describe("Potions as consumables", () => {
    it("consumes a regeneration potion and applies its effect", async () => {
        const instance = world();
        const player = await spawn(instance);
        await player.inventory.add(instance.items.require("regeneration_potion"), 2);
        assert.equal(await player.inventory.use("regeneration_potion"), true);
        assert.equal(player.effects.has("regeneration"), true);
        assert.equal(await totalQuantity(player, "regeneration_potion"), 1);
        player.effects.dispose();
    });

    it("heals instantly with a health potion, capped at the maximum", async () => {
        const instance = world();
        const player = await spawn(instance);
        player.health.current = player.health.max - 5;
        await player.inventory.add(instance.items.require("health_potion"), 1);
        assert.equal(await player.inventory.use("health_potion"), true);
        assert.equal(player.health.current, player.health.max);
    });

    it("refuses to use what the player does not own, or does not consume", async () => {
        const instance = world();
        const player = await spawn(instance);
        assert.equal(await player.inventory.use("regeneration_potion"), false);
        await player.inventory.add(instance.items.require("rusty_sword"), 1);
        assert.equal(await player.inventory.use("rusty_sword"), false, "a weapon is not a consumable");
        assert.equal(await player.inventory.use("rusty_sword", 0), false);
    });

    it("never spends the same potion twice when used concurrently", async () => {
        const instance = world();
        const player = await spawn(instance);
        await player.inventory.add(instance.items.require("xp_boost_potion"), 1);
        const results = await Promise.all([player.inventory.use("xp_boost_potion"), player.inventory.use("xp_boost_potion")]);
        assert.deepEqual(results.sort(), [false, true]);
        player.effects.dispose();
    });

    it("ships every official potion as a registered consumable", () => {
        for (const item of OFFICIAL_ITEMS.filter((candidate) => candidate.use)) assert.equal(item.category, ItemCategory.Consumables);
    });
});

describe("Persistence and catalogue", () => {
    it("keeps the active effects of a player across a save and reload", async () => {
        const instance = world();
        const player = await spawn(instance);
        await player.effects.apply("xp_boost");
        await instance.players.remove(player.id);

        const reloaded = await instance.players.get(player.id);
        assert.ok(reloaded && reloaded !== player);
        assert.equal(reloaded.effects.has("xp_boost"), true);
        assert.ok(reloaded.effects.getRemainingMs("xp_boost") > 14 * 60_000);
        reloaded.effects.dispose();
    });

    it("grants the starter equipment once the official items are loaded", async () => {
        const instance = createWorld({ premadeItems: true });
        const player = await spawn(instance);
        assert.equal(await totalQuantity(player, "health_potion"), 3);
        assert.equal(await totalQuantity(player, "rusty_sword"), 1);
    });

    it("validates the behaviour of an item", () => {
        const instance = createWorld({ premadeContent: false, premadeMap: true, premadeClasses: true });
        const item = { ...makeItem("x", ItemCategory.Consumables) };
        assert.throws(() => instance.items.register({ ...item, use: {} }), InvalidRegistryEntryError);
        assert.throws(() => instance.items.register({ ...item, use: { heal: 0 } }), InvalidRegistryEntryError);
        assert.throws(() => instance.items.register({ ...item, use: { effects: [] } }), InvalidRegistryEntryError);
        instance.items.register({ ...item, use: { heal: 5 } });
    });
});
