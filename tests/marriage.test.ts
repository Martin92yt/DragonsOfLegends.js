/**
 * DragonsOfLegends.js — PlayerMarriage.
 *
 * Run only this file:  npx tsx --test tests/marriage.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import PlayerMarriage from "../src/player/player.marriage.js";
import { createWorld, databasePathOf, defined, spawn, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("PlayerMarriage", () => {
    it("normalises the initial partner", async () => {
        const player = await spawn(createWorld());
        assert.equal(new PlayerMarriage(player, "/").isMarried(), false);
        assert.equal(new PlayerMarriage(player, "").getPartnerId(), "");
        assert.equal(new PlayerMarriage(player).isMarried(), false);
        const married = new PlayerMarriage(player, "partner-x");
        assert.equal(married.isMarried(), true);
        assert.equal(married.getPartnerId(), "partner-x");
    });

    it("marries, persists, replaces and divorces", async () => {
        const world = createWorld();
        const dbPath = databasePathOf(world);
        const [a, b, c] = [await spawn(world), await spawn(world), await spawn(world)];

        a.marriage = new PlayerMarriage(a, undefined, dbPath);
        assert.equal(a.marriage.setPartner(b.id), a.marriage, "setPartner is chainable");
        assert.equal(a.marriage.isMarried(), true);
        await world.players.remove(a.id);
        assert.equal(defined(await world.players.get(a.id)).marriage.getPartnerId(), b.id);

        const reloaded = defined(await world.players.get(a.id));
        reloaded.marriage = new PlayerMarriage(reloaded, b.id, dbPath);
        reloaded.marriage.setPartner(c.id);
        await world.players.remove(a.id);
        assert.equal(defined(await world.players.get(a.id)).marriage.getPartnerId(), c.id);

        const again = defined(await world.players.get(a.id));
        again.marriage = new PlayerMarriage(again, c.id, dbPath);
        again.marriage.divorce();
        assert.equal(again.marriage.isMarried(), false);
        await world.players.remove(a.id);
        assert.equal(defined(await world.players.get(a.id)).marriage.getPartnerId(), "");
    });

    it("works with the default database path", async () => {
        const world = createWorld();
        const [a, b] = [await spawn(world), await spawn(world)];
        assert.doesNotThrow(() => a.marriage.setPartner(b.id));
    });

    it("refuses to marry oneself", async () => {
        const world = createWorld();
        const a = await spawn(world);
        a.marriage = new PlayerMarriage(a, undefined, databasePathOf(world));
        assert.throws(() => a.marriage.setPartner(a.id));
    });

    it("updates the partner's cached marriage as well", async () => {
        const world = createWorld();
        const [a, b] = [await spawn(world), await spawn(world)];
        a.marriage = new PlayerMarriage(a, undefined, databasePathOf(world));
        a.marriage.setPartner(b.id);
        assert.equal(b.marriage.getPartnerId(), a.id);
    });
});
