/**
 * DragonsOfLegends.js — Bestiary: auto-registration, discovery gold and "Unknown" display.
 *
 * Run only this file:  npx tsx --test tests/bestiary.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BESTIARY_UNKNOWN_LABEL } from "../src/bestiary/bestiary.types.js";
import { DEFAULT_DISCOVERY_GOLD } from "../src/bestiary/bestiary.species.js";
import { EnemyType } from "../src/enemy/enemy.type.js";
import PlayerBestiary from "../src/player/player.bestiary.js";
import * as errors from "../src/types/error.js";
import { createWorld, defined, fakeEvents, spawn, useIsolatedWorkspace, type WorldOptions } from "./helpers/fixtures.js";

useIsolatedWorkspace();

type World = ReturnType<typeof createWorld>;

async function defeat(world: World, playerId: string, enemyType: string): Promise<void> {
    await world.events.emitAsync("enemyDefeat", fakeEvents.enemyDefeat({ playerId, enemyType }));
}

async function setup(options: WorldOptions = {}) {
    const world = createWorld(options);
    const player = await spawn(world);
    return { world, player, startGold: player.gold };
}

describe("PlayerBestiary", () => {
    it("lists every species as Unknown on an empty state", () => {
        const bestiary = new PlayerBestiary({});
        const entries = bestiary.list();
        assert.equal(entries.length, Object.values(EnemyType).length);
        for (const entry of entries) {
            assert.equal(entry.discovered, false);
            assert.equal(entry.name, BESTIARY_UNKNOWN_LABEL);
            assert.equal(entry.description, BESTIARY_UNKNOWN_LABEL);
            assert.equal(entry.kills, 0);
        }
        assert.equal(bestiary.getProgress().discovered, 0);
    });

    it("records a first discovery once and counts later kills", () => {
        const bestiary = new PlayerBestiary({});
        assert.equal(bestiary.record(EnemyType.Slime, 1000), true);
        assert.equal(bestiary.record(EnemyType.Slime, 2000), false);
        const entry = bestiary.getEntry(EnemyType.Slime);
        assert.equal(entry.discovered, true);
        if (entry.discovered) {
            assert.equal(entry.kills, 2);
            assert.equal(entry.firstDefeatedAt, 1000);
            assert.notEqual(entry.name, BESTIARY_UNKNOWN_LABEL);
        }
        assert.equal(bestiary.getEntry(EnemyType.Goblin).discovered, false);
        assert.deepEqual(bestiary.toState(), { slime: { kills: 2, firstDefeatedAt: 1000 } });
    });

    it("ignores corrupted persisted state", () => {
        for (const bad of [null, "x", 5, [], { slime: "no" }, { slime: { kills: -1, firstDefeatedAt: "a" } }, { dragon_unknown: { kills: 1, firstDefeatedAt: 1 } }]) {
            const bestiary = new PlayerBestiary(bad);
            assert.equal(bestiary.getProgress().discovered, 0);
        }
        assert.equal(new PlayerBestiary({ slime: { kills: 3, firstDefeatedAt: 5 } }).isDiscovered(EnemyType.Slime), true);
    });
});

describe("BestiaryManager", () => {
    it("registers a defeated monster and pays the default gold only once", async () => {
        const { world, player, startGold } = await setup();
        const expected = DEFAULT_DISCOVERY_GOLD[EnemyType.Slime] ?? 0;
        assert.ok(expected > 0);

        await defeat(world, player.id, EnemyType.Slime);
        assert.equal(player.bestiary.isDiscovered(EnemyType.Slime), true);
        assert.equal(player.gold, startGold + expected);

        await defeat(world, player.id, EnemyType.Slime);
        assert.equal(player.gold, startGold + expected, "no gold on rediscovery");
        const entry = player.bestiary.getEntry(EnemyType.Slime);
        assert.equal(entry.discovered && entry.kills, 2);
    });

    it("supports a fixed amount for all species", async () => {
        const { world, player, startGold } = await setup({ bestiary: { discoveryGold: 7 } });
        await defeat(world, player.id, EnemyType.Slime);
        await defeat(world, player.id, EnemyType.Goblin);
        assert.equal(player.gold, startGold + 14);
    });

    it("supports a per-species record, falling back to the defaults", async () => {
        const { world, player, startGold } = await setup({ bestiary: { discoveryGold: { slime: 3 } } });
        await defeat(world, player.id, EnemyType.Slime);
        assert.equal(player.gold, startGold + 3);
        await defeat(world, player.id, EnemyType.Goblin);
        assert.equal(player.gold, startGold + 3 + (DEFAULT_DISCOVERY_GOLD[EnemyType.Goblin] ?? 0));
    });

    it("supports a dynamic function", async () => {
        const { world, player, startGold } = await setup({ bestiary: { discoveryGold: (type) => type.length } });
        await defeat(world, player.id, EnemyType.Slime);
        assert.equal(player.gold, startGold + EnemyType.Slime.length);
    });

    it("rejects invalid rewards without registering the species", async () => {
        for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
            const { world, player } = await setup({ bestiary: { discoveryGold: () => bad } });
            await defeat(world, player.id, EnemyType.Slime);
            assert.equal(player.bestiary.isDiscovered(EnemyType.Slime), false);
        }
        assert.throws(() => createWorld({ bestiary: { discoveryGold: -5 } }), errors.InvalidBestiaryRewardError);
        assert.throws(() => createWorld({ bestiary: { discoveryGold: { slime: Number.NaN } } }), errors.InvalidBestiaryRewardError);
    });

    it("floors fractional rewards", async () => {
        const { world, player, startGold } = await setup({ bestiary: { discoveryGold: () => 4.9 } });
        await defeat(world, player.id, EnemyType.Slime);
        assert.equal(player.gold, startGold + 4);
    });

    it("can be disabled", async () => {
        const { world, player, startGold } = await setup({ bestiary: { enabled: false } });
        await defeat(world, player.id, EnemyType.Slime);
        assert.equal(player.bestiary.isDiscovered(EnemyType.Slime), false);
        assert.equal(player.gold, startGold);
    });

    it("ignores unknown species and unknown players", async () => {
        const { world, player, startGold } = await setup();
        await defeat(world, player.id, "not_a_species");
        await defeat(world, "ghost-player", EnemyType.Slime);
        assert.equal(player.bestiary.getProgress().discovered, 0);
        assert.equal(player.gold, startGold);
    });

    it("emits bestiaryDiscovered on first discovery only", async () => {
        const { world, player } = await setup({ bestiary: { discoveryGold: 5 } });
        const seen: string[] = [];
        world.events.on("bestiaryDiscover", (payload) => { seen.push(`${payload.playerId}:${payload.enemyType}:${payload.goldReward}`); });
        await defeat(world, player.id, EnemyType.Slime);
        await defeat(world, player.id, EnemyType.Slime);
        assert.deepEqual(seen, [`${player.id}:slime:5`]);
    });

    it("persists discoveries through save and reload", async () => {
        const { world, player } = await setup();
        await defeat(world, player.id, EnemyType.Slime);
        await world.players.save(player);
        await world.players.remove(player.id);
        const reloaded = defined(await world.players.get(player.id));
        assert.equal(reloaded.bestiary.isDiscovered(EnemyType.Slime), true);
    });
});
