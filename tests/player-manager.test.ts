/**
 * DragonsOfLegends.js — PlayerManager: lifecycle, persistence, regeneration and inactivity unloading.
 *
 * Run only this file:  npx tsx --test tests/player-manager.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";

import { PlayerClass } from "../src/player/player.class.js";
import * as errors from "../src/types/error.js";
import { EnemyType } from "../src/enemy/enemy.type.js";
import { ItemCategory, ItemRarity } from "../src/inventory/item.enum.js";
import { createJobToolNbt } from "../src/jobs/job.types.js";
import { createWorld, databasePathOf, defined, INACTIVITY_TIME_MS, settle, spawn, useIsolatedWorkspace, workspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("PlayerManager", () => {
    it("creates a persisted player in the starting city with the starter gold", async () => {
        const world = createWorld();
        const player = await spawn(world, PlayerClass.Explorer);
        assert.equal(player.location, "Embercross");
        assert.equal(player.gold, 150);
        assert.equal(player.level, 1);
        assert.equal(player.classId, PlayerClass.Explorer);
        assert.equal(await world.players.exist(player.id), true);
        assert.equal(await world.players.has(player.id), true);
        assert.deepEqual(world.players.count(), { active: 1, total: 1 });
        assert.equal(world.players.size, 1);
    });

    it("honours the starterGold option", async () => {
        assert.equal((await spawn(createWorld({ starterGold: 999 }))).gold, 999);
        assert.equal((await spawn(createWorld({ starterGold: 0 }))).gold, 0);
    });

    it("rejects duplicate identifiers", async () => {
        const world = createWorld();
        const player = await spawn(world);
        await assert.rejects(world.players.create({ id: player.id, name: "Dup", playerClass: PlayerClass.Rogue }), errors.PlayerAlreadyExistsError);
    });

    it("rejects unknown classes without registering anything", async () => {
        const world = createWorld();
        await assert.rejects(
            world.players.create({ id: "mage-1", name: "Mage", playerClass: "mage" as unknown as PlayerClass }),
            errors.UnknownPlayerClassError
        );
        assert.equal(await world.players.exist("mage-1"), false);
        assert.equal(world.players.size, 0);
    });

    it("get returns the cached instance and undefined for unknown players", async () => {
        const world = createWorld();
        const player = await spawn(world);
        assert.equal(await world.players.get(player.id), player);
        assert.equal(await world.players.get("ghost"), undefined);
    });

    it("ensure fetches by id or creates from options without overwriting", async () => {
        const world = createWorld();
        assert.equal(await world.players.ensure("ghost"), undefined);
        const created = defined(await world.players.ensure({ id: "ens-1", name: "First", playerClass: PlayerClass.Rogue }));
        const again = defined(await world.players.ensure({ id: "ens-1", name: "Second", playerClass: PlayerClass.Warrior }));
        assert.equal(again, created);
        assert.equal(again.name, "First");
        assert.equal(await world.players.ensure("ens-1"), created);
    });

    it("remove persists and evicts, then get reloads a persisted copy", async () => {
        const world = createWorld();
        const player = await spawn(world);
        player.name = "Renamed";
        player.location = "Ironmill";
        player.gold = 777;
        player.bankGold = 55;
        player.bankUnlocked = true;
        player.level = 4;
        player.experience.current = 30;
        player.health.current = 20;
        await world.players.remove(player.id);
        assert.equal(world.players.size, 0);
        assert.equal(world.players.count().total, 1);

        const reloaded = defined(await world.players.get(player.id));
        await settle();
        assert.notEqual(reloaded, player);
        assert.equal(reloaded.name, "Renamed");
        assert.equal(reloaded.location, "Ironmill");
        assert.equal(reloaded.gold, 777);
        assert.equal(reloaded.bankGold, 55);
        assert.equal(reloaded.bankUnlocked, true);
        assert.equal(reloaded.level, 4);
        assert.equal(reloaded.experience.current, 30);
        assert.equal(reloaded.health.current, 20);
        assert.equal(reloaded.classId, player.classId);
    });

    it("persists bestiary and jobs state across an eviction", async () => {
        const world = createWorld();
        const player = await spawn(world);
        player.bestiary.record(EnemyType.Slime, 1234);
        await player.inventory.add({ itemId: "reload_rod", name: "Rod", category: ItemCategory.Tool, rarity: ItemRarity.Common, maxStack: 1 }, 1, createJobToolNbt("fishing", { luck: 10 }));
        await player.jobs.equipTool("fishing", "reload_rod");
        await world.players.remove(player.id);

        const reloaded = defined(await world.players.get(player.id));
        const entry = reloaded.bestiary.getEntry(EnemyType.Slime);
        assert.equal(entry.discovered && entry.firstDefeatedAt, 1234);
        assert.equal(reloaded.jobs.getEquippedToolId("fishing"), "reload_rod");
    });

    it("restores attributes exactly after an eviction", { todo: "C1 loadPlayerIntoCache passes constructor arguments in the wrong order" }, async () => {
        const world = createWorld();
        const player = await spawn(world);
        player.attributes = { points: 3, strength: 10, agility: 4, intelligence: 3, defense: 8 };
        await world.players.remove(player.id);
        const reloaded = defined(await world.players.get(player.id));
        assert.deepEqual(reloaded.attributes, { points: 3, strength: 10, agility: 4, intelligence: 3, defense: 8 });
    });

    it("remove on a non-cached player is a harmless no-op", async () => {
        await assert.doesNotReject(createWorld().players.remove("ghost"));
    });

    it("save and saveAll persist across world instances", async () => {
        const first = createWorld();
        const a = await spawn(first);
        const b = await spawn(first);
        a.gold = 111;
        await first.players.save(a);
        b.gold = 222;
        await first.players.saveAll();

        const second = createWorld({ database: { adapter: "file", path: databasePathOf(first) } });
        assert.equal(defined(await second.players.get(a.id)).gold, 111);
        assert.equal(defined(await second.players.get(b.id)).gold, 222);
    });

    it("count distinguishes active from persisted players", async () => {
        const world = createWorld();
        const a = await spawn(world);
        await spawn(world);
        await world.players.remove(a.id);
        assert.deepEqual(world.players.count(), { active: 1, total: 2 });
    });

    it("delete removes persisted data and reports unknown players", async () => {
        const world = createWorld();
        const player = await spawn(world);
        assert.equal(await world.players.delete("ghost"), false);
        assert.equal(await world.players.delete(player.id), true);
        assert.equal(world.players.count().total, 0);
    });

    it("delete leaves no trace in the cache", { todo: "C6 delete() reloads the player through get() and leaves a ghost in the cache" }, async () => {
        const world = createWorld();
        const player = await spawn(world);
        await world.players.delete(player.id);
        assert.equal(await world.players.exist(player.id), false);
        assert.equal(world.players.size, 0);
    });

    it("tickRegen heals up to the maximum and leaves healthy players alone", async () => {
        const world = createWorld();
        const hurt = await spawn(world);
        const healthy = await spawn(world);
        hurt.health.current = 10;
        world.players.tickRegen(5);
        assert.equal(hurt.health.current, 15);
        assert.equal(healthy.health.current, healthy.health.max);
        world.players.tickRegen(1000);
        assert.equal(hurt.health.current, hurt.health.max);
    });

    it("unloads idle players after 15 minutes, and activity refreshes the timer", async (t) => {
        const world = createWorld();
        t.mock.timers.enable({ apis: ["setTimeout"] });
        const player = await spawn(world);

        t.mock.timers.tick(INACTIVITY_TIME_MS - 60_000);
        await world.players.get(player.id);
        t.mock.timers.tick(INACTIVITY_TIME_MS - 60_000);
        await settle();
        assert.equal(world.players.size, 1, "activity must refresh the inactivity timer");

        t.mock.timers.tick(120_000);
        await settle();
        assert.equal(world.players.size, 0);
        assert.equal(world.players.count().total, 1, "unloading must persist, not delete");
    });

    it("falls back to SQLite for unknown adapter names", async () => {
        const world = createWorld({ database: { adapter: "bogus" as unknown as "file", path: join(workspace, "bogus.db") } });
        const player = await spawn(world);
        assert.equal(defined(await world.players.get(player.id)).id, player.id);
    });
});
