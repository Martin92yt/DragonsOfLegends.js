/**
 * DragonsOfLegends.js — MongoDB adapters (integration, opt-in through MONGODB_URI).
 *
 * Run only this file:  npx tsx --test tests/mongodb.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import World from "../src/world.js";
import { defined, makeItem, MONGODB_URI, sleep, spawn, totalQuantity, useIsolatedWorkspace, workspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("MongoDB adapters (integration)", { skip: MONGODB_URI === undefined ? "set MONGODB_URI to run (use --test-force-exit: the adapters expose no close hook)" : false }, () => {
    it("persists players and inventories", async () => {
        const world = new World({
            checkUpdates: false,
            regen: { enabled: false, rate: 5, cooldown: 10 },
            database: { adapter: "mongodb", uri: MONGODB_URI, name: `dol_test_${Date.now()}` }
        });
        // Rationale: MongoPlayerAdapter connects in its constructor without a readiness guard, so give it time to connect.
        await sleep(1000);
        const player = await spawn(world);
        await player.inventory.add(makeItem("ore"), 3);
        await world.players.remove(player.id);

        const reloaded = defined(await world.players.get(player.id));
        assert.equal(reloaded.id, player.id);
        assert.equal(await totalQuantity(reloaded, "ore"), 3);
        assert.equal(await world.players.delete(player.id), true);
        mkdirSync(join(workspace, "mongo-done"), { recursive: true });
    });
});
