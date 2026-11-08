/**
 * DragonsOfLegends.js — World initialisation, options and update check.
 *
 * Run only this file:  npx tsx --test tests/world.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { consola } from "consola";

import SqlitePlayerAdapter from "../src/adapters/sqlite-player.adapter.js";
import BankClass from "../src/economy/bank.js";
import World from "../src/world.js";
import * as errors from "../src/types/error.js";
import { createWorld, databasePathOf, defined, FUTURE_VERSION, makeEnemy, REGISTRY_URL, registryResponse, settle, spawn, stubRegistry, useIsolatedWorkspace, workspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("World", () => {
    it("applies documented defaults", () => {
        const world = new World({ checkUpdates: false });
        const options = world.initializationOptions;
        assert.equal(options.premadeMap, true);
        assert.equal(options.deathMode, "cooldown");
        assert.equal(options.deathCooldown, "1m");
        assert.equal(options.deathPenaltyRate, 5);
        assert.equal(options.starterGold, 150);
        assert.deepEqual(options.starterItems, { health_potion: 3, rusty_sword: 1 });
        assert.equal(options.bankUnlockCost, 1000);
        assert.equal(options.bankMaxGoldLimit, 500000);
        assert.deepEqual(options.regen, { enabled: true, rate: 5, cooldown: 10 });
        assert.equal(options.database?.adapter, "file");
        assert.equal(options.database?.path, "./data.db");
    });

    it("applies the defaults of the bank, bestiary and jobs options", () => {
        const world = new World({ checkUpdates: false });
        assert.equal(world.initializationOptions.premadeJobs, true);
        assert.equal(world.jobs.has("fishing"), true);
        assert.ok(world.events && world.bestiary);
    });

    it("fails fast on invalid item bank capacity and bestiary rewards", () => {
        assert.throws(() => new World({ checkUpdates: false, bankCapacitySlots: 0 }), errors.InvalidBankCapacityError);
        assert.throws(() => new World({ checkUpdates: false, bestiary: { discoveryGold: -1 } }), errors.InvalidBestiaryRewardError);
    });

    it("merges nested options with their defaults", () => {
        const world = new World({ checkUpdates: false, regen: { enabled: false, rate: 5, cooldown: 10 }, database: { path: join(workspace, "merge.db") }, starterGold: 7 });
        assert.equal(world.initializationOptions.regen?.enabled, false);
        assert.equal(world.initializationOptions.database?.adapter, "file");
        assert.equal(world.initializationOptions.starterGold, 7);
    });

    it("wires every subsystem", () => {
        const world = createWorld();
        assert.ok(world.players && world.combat && world.location && world.bank);
        assert.ok(world.bank instanceof BankClass);
    });

    it("emits gameLaunched asynchronously", async () => {
        const world = createWorld();
        await new Promise<void>((resolve) => world.once("gameLaunched", resolve));
    });

    it("does not call the npm registry when checkUpdates is false", async (t) => {
        const fetchMock = stubRegistry(t, async () => registryResponse(FUTURE_VERSION));
        createWorld({ checkUpdates: false });
        await settle();
        assert.equal(fetchMock.mock.calls.length, 0);
    });

    it("queries the npm registry once at construction when checkUpdates is true", async (t) => {
        const fetchMock = stubRegistry(t, async () => registryResponse(FUTURE_VERSION));
        createWorld({ checkUpdates: true });
        await settle();
        assert.equal(fetchMock.mock.calls.length, 1);
        assert.equal(String(fetchMock.mock.calls[0].arguments[0]), REGISTRY_URL);
    });

    it("warns when a newer version exists", async (t) => {
        stubRegistry(t, async () => registryResponse(FUTURE_VERSION));
        const warn = t.mock.method(consola, "warn");
        await createWorld().checkForUpdates();
        assert.ok(warn.mock.calls.some((call: { arguments: readonly unknown[] }) => String(call.arguments[0]).includes(FUTURE_VERSION)));
    });

    it("reports an up-to-date package", async (t) => {
        const { version } = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as { version: string };
        stubRegistry(t, async () => registryResponse(version));
        const info = t.mock.method(consola, "info");
        await createWorld().checkForUpdates();
        assert.ok(info.mock.calls.some((call: { arguments: readonly unknown[] }) => /up to date/i.test(String(call.arguments[0]))));
    });

    it("survives registry failures (HTTP error and network error)", async (t) => {
        const world = createWorld();
        stubRegistry(t, async () => new Response("nope", { status: 500 }));
        const warn = t.mock.method(consola, "warn");
        await assert.doesNotReject(world.checkForUpdates());
        assert.ok(warn.mock.calls.length >= 1);

        t.mock.restoreAll();
        stubRegistry(t, async () => {
            throw new Error("offline");
        });
        const error = t.mock.method(consola, "error");
        await assert.doesNotReject(world.checkForUpdates());
        assert.ok(error.mock.calls.length >= 1);
    });

    it("quick() stops combats and persists every cached player", async () => {
        const world = createWorld();
        const player = await spawn(world);
        player.gold = 321;
        world.combat.startWithEnemy(player, makeEnemy());
        await world.quick();
        assert.equal(world.combat.size, 0);
        assert.equal(player.inCombat, false);
        const stored = defined(new SqlitePlayerAdapter(world.players, databasePathOf(world)).get(player.id));
        assert.equal(stored.gold, player.gold);
    });
});
