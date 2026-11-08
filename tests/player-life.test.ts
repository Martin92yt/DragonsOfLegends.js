/**
 * DragonsOfLegends.js — Strict death: a dead player cannot act, the remaining time is reported, resurrection is clean.
 *
 * Run only this file:  npx tsx --test tests/player-life.test.ts
 */
import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";

import { ItemCategory } from "../src/inventory/item.enum.js";
import { resolveDeathRespawnConfig } from "../src/player/player.life.js";
import * as errors from "../src/types/error.js";
import { parseDuration } from "../src/utils/duration.js";
import { createWorld, defined, makeEnemy, makeItem, sleep, spawn, stubRandom, travel, useIsolatedWorkspace, type WorldOptions } from "./helpers/fixtures.js";

useIsolatedWorkspace();

const START = 10_000_000;

/** Controls Date.now so cooldowns are exact. */
function clock(t: TestContext, start = START) {
    let now = start;
    t.mock.method(Date, "now", () => now);
    return { advance: (ms: number) => { now += ms; } };
}

/** A world with a 60s respawn cooldown and a player who has just died. */
async function deadPlayer(t: TestContext, options: WorldOptions = {}) {
    const time = clock(t);
    const world = createWorld({ deathMode: "cooldown", deathCooldown: "60s", ...options });
    const player = await spawn(world);
    await player.takeDamage(99999);
    return { world, player, time };
}

const expectDead = (action: string, remainingMs: number) => (error: unknown): boolean => {
    assert.ok(error instanceof errors.PlayerDeadError, `expected PlayerDeadError, got ${String(error)}`);
    assert.equal(error.action, action);
    assert.equal(error.remainingMs, remainingMs);
    assert.equal(error.permanent, false);
    assert.equal(error.playerId.length > 0, true);
    return true;
};

describe("parseDuration", () => {
    it("parses milliseconds, units and numbers", () => {
        assert.equal(parseDuration(1500), 1500);
        assert.equal(parseDuration("500ms"), 500);
        assert.equal(parseDuration("30s"), 30_000);
        assert.equal(parseDuration("1m"), 60_000);
        assert.equal(parseDuration("1.5h"), 5_400_000);
        assert.equal(parseDuration(" 2D "), 172_800_000);
        assert.equal(parseDuration(0), 0);
    });

    it("rejects malformed or negative values", () => {
        for (const bad of ["", "abc", "5", "-5s", "5 weeks", "1m30s", -1, Number.NaN, Number.POSITIVE_INFINITY]) {
            assert.throws(() => parseDuration(bad), errors.InvalidDurationError, String(bad));
        }
    });
});

describe("Death configuration is validated up front", () => {
    it("rejects an invalid cooldown or respawn option at world creation", () => {
        assert.throws(() => createWorld({ deathCooldown: "soon" }), errors.InvalidDurationError);
        assert.throws(() => createWorld({ deathRespawn: { healthRatio: 0 } }), errors.InvalidDeathRespawnError);
        assert.throws(() => createWorld({ deathRespawn: { healthRatio: 1.5 } }), errors.InvalidDeathRespawnError);
        assert.deepEqual(resolveDeathRespawnConfig(), { healthRatio: 1, relocateToStartingCity: false });
        assert.doesNotThrow(() => createWorld({ deathCooldown: 5000, deathRespawn: { healthRatio: 0.5, relocateToStartingCity: true } }));
    });
});

describe("A dead player is locked", () => {
    it("is dead for the whole cooldown, with an exact remaining time", async (t) => {
        const { player, time } = await deadPlayer(t);
        assert.equal(player.isDead, true);
        assert.equal(player.life.getRemainingMs(), 60_000);
        time.advance(25_000);
        assert.equal(player.isDead, true);
        assert.equal(player.life.getRemainingMs(), 35_000);
        time.advance(34_999);
        assert.equal(player.isDead, true);
        assert.equal(player.life.getRemainingMs(), 1);
    });

    it("carries the remaining time, the action and the player in the error", async (t) => {
        const { player, time } = await deadPlayer(t);
        time.advance(10_000);
        try {
            player.assertCanAct("custom.action");
            assert.fail("should have thrown");
        } catch (error) {
            assert.ok(error instanceof errors.PlayerDeadError);
            assert.equal(error.remainingMs, 50_000);
            assert.equal(error.respawnAt, START + 60_000);
            assert.equal(error.action, "custom.action");
            assert.match(error.message, /respawn in 50s/);
            assert.match(error.message, /custom\.action/);
        }
    });

    it("refuses movement", async (t) => {
        const { player } = await deadPlayer(t);
        await assert.rejects(player.moveTo("Ironmill"), expectDead("player.moveTo", 60_000));
        assert.equal(player.isTravelling, false);
        assert.equal(player.location, "Embercross");
    });

    it("refuses combat: start, startWithEnemy and attack", async (t) => {
        const { world, player } = await deadPlayer(t);
        assert.throws(() => world.combat.start(player), expectDead("combat.start", 60_000));
        assert.throws(() => world.combat.startWithEnemy(player, makeEnemy()), expectDead("combat.start", 60_000));
        assert.equal(world.combat.has(player.id), false);
        await assert.rejects(world.combat.attack(player.id), expectDead("combat.attack", 60_000), "death is reported, not 'not in combat'");
    });

    it("refuses a direct Combat.attack on a combat started before the death", async (t) => {
        const time = clock(t);
        const world = createWorld({ deathCooldown: "60s" });
        const player = await spawn(world);
        const combat = world.combat.startWithEnemy(player, makeEnemy({ strength: 1 }));
        await player.takeDamage(99999);
        await assert.rejects(combat.attack(), expectDead("combat.attack", 60_000));
        time.advance(1);
    });

    it("refuses inventory actions but still accepts received loot", async (t) => {
        const { player } = await deadPlayer(t);
        await assert.rejects(player.inventory.equip("sword", "x"), expectDead("inventory.equip", 60_000));
        await assert.rejects(player.inventory.unequip("sword"), expectDead("inventory.unequip", 60_000));
        await assert.rejects(player.inventory.remove("x"), expectDead("inventory.remove", 60_000));
        await assert.rejects(player.inventory.sellItem("x"), expectDead("inventory.sell", 60_000));
        assert.throws(() => player.inventory.use("x"), expectDead("inventory.use", 60_000));
        await assert.doesNotReject(player.inventory.add(makeItem("reward"), 1), "rewards granted by the system are not player actions");
        await assert.doesNotReject(player.inventory.getItems(), "reads stay available");
    });

    it("refuses gold bank transactions but allows reading the balance", async (t) => {
        const { world, player } = await deadPlayer(t);
        player.bankUnlocked = true;
        await assert.rejects(world.bank.deposit(player, 10), expectDead("bank.deposit", 60_000));
        await assert.rejects(world.bank.withdraw(player, 10), expectDead("bank.withdraw", 60_000));
        await assert.doesNotReject(world.bank.solde(player), "reading the balance stays allowed");
        player.bankUnlocked = false;
        assert.throws(() => world.bank.unlock(player), expectDead("bank.unlock", 60_000));
        assert.equal(player.gold, 150, "nothing moved");
    });

    it("refuses item bank transfers", async (t) => {
        const { player } = await deadPlayer(t);
        player.bankUnlocked = true;
        await assert.rejects(player.itemBank.deposit("x"), expectDead("itemBank.deposit", 60_000));
        await assert.rejects(player.itemBank.withdraw("x"), expectDead("itemBank.withdraw", 60_000));
        await assert.doesNotReject(player.itemBank.list());
    });

    it("refuses jobs: perform and tool management", async (t) => {
        const { player } = await deadPlayer(t);
        await assert.rejects(player.jobs.perform("fishing", "fish"), expectDead("jobs.perform", 60_000));
        await assert.rejects(player.jobs.equipTool("fishing", "rod"), expectDead("jobs.equipTool", 60_000));
        await assert.rejects(player.jobs.unequipTool("fishing"), expectDead("jobs.unequipTool", 60_000));
        assert.equal(player.jobs.getProgress("fishing").xp, 0);
    });

    it("refuses marriage, titles and attribute allocation", async (t) => {
        const { player } = await deadPlayer(t);
        player.attributes.points = 3;
        assert.throws(() => player.marriage.setPartner("someone"), expectDead("marriage.setPartner", 60_000));
        assert.throws(() => player.marriage.divorce(), expectDead("marriage.divorce", 60_000));
        await assert.rejects(player.titles.equip("novice_adventurer"), expectDead("titles.equip", 60_000));
        await assert.rejects(player.titles.unequip(), expectDead("titles.unequip", 60_000));
        assert.throws(() => player.levelUpSkill("strength"), expectDead("player.levelUpSkill", 60_000));
        assert.equal(player.attributes.points, 3);
    });

    it("does not take further damage, regenerate or heal while dead", async (t) => {
        const { world, player } = await deadPlayer(t);
        assert.equal(await player.takeDamage(50), null);
        world.players.tickRegen(1000);
        assert.equal(player.health.current, 0);
    });

    it("blocks a job already queued behind the death", async (t) => {
        const time = clock(t);
        stubRandom(t, 0);
        const world = createWorld({ deathCooldown: "60s" });
        const player = await spawn(world);
        const first = player.jobs.perform("fishing", "fish");
        const second = player.jobs.perform("fishing", "fish");
        await first;
        await player.takeDamage(99999);
        await assert.rejects(second, (error: unknown) => error instanceof errors.PlayerDeadError || error instanceof errors.JobCooldownError);
        time.advance(1);
    });
});

describe("Resurrection", () => {
    it("lets the player act again exactly when the cooldown elapses, with restored health", async (t) => {
        const { player, time } = await deadPlayer(t);
        time.advance(59_999);
        assert.throws(() => player.assertCanAct("x"), errors.PlayerDeadError);
        time.advance(1);
        assert.equal(player.isDead, false);
        assert.equal(player.life.getRemainingMs(), 0);
        assert.doesNotThrow(() => player.assertCanAct("x"));
        assert.equal(player.health.current, player.health.max);
    });

    it("restores only a fraction of the health and can send the player home", async (t) => {
        const { world, player, time } = await deadPlayer(t, { deathRespawn: { healthRatio: 0.5, relocateToStartingCity: true } });
        player.location = "Ironmill";
        time.advance(60_000);
        assert.equal(player.life.canAct, true);
        assert.equal(player.health.current, Math.ceil(player.health.max / 2));
        assert.equal(player.location, world.location.getStartingCityId());
    });

    it("announces the revival (event, persistence) after a lazy resurrection", async (t) => {
        const { world, player, time } = await deadPlayer(t);
        const seen: string[] = [];
        world.events.on("playerRevive", (payload) => { seen.push(`${payload.playerId}:${payload.reason}:${payload.health}`); });
        time.advance(60_000);
        assert.equal(player.isDead, false);
        await sleep(30);
        assert.deepEqual(seen, [`${player.id}:timer:${player.health.max}`]);
        const record = await world.players["playerDatabase"].get(player.id);
        assert.equal(record?.deadUntil, null);
    });

    it("revives exactly once even if checked repeatedly", async (t) => {
        const { world, player, time } = await deadPlayer(t);
        let revivals = 0;
        world.events.on("playerRevive", () => { revivals += 1; });
        time.advance(60_000);
        for (let index = 0; index < 5; index++) void player.isDead;
        await sleep(30);
        assert.equal(revivals, 1);
    });

    it("revives on time through the timer, even if nobody checks", async () => {
        const world = createWorld({ deathCooldown: "60ms" });
        const player = await spawn(world);
        const revived = world.events.waitFor("playerRevive", { timeoutMs: 2000 });
        await player.takeDamage(99999);
        assert.equal(player.isDead, true);
        const payload = await revived;
        assert.equal(payload.reason, "timer");
        assert.equal(player.isDead, false);
        assert.equal(player.health.current, player.health.max);
    });

    it("supports a manual resurrection (resurrection item, admin), once", async (t) => {
        const { world, player } = await deadPlayer(t);
        const reasons: string[] = [];
        world.events.on("playerRevive", (payload) => { reasons.push(payload.reason); });
        assert.equal(await world.players.revive(player.id), true);
        assert.equal(player.isDead, false);
        assert.equal(player.health.current, player.health.max);
        assert.equal(await world.players.revive(player.id), false, "an alive player is not revived twice");
        await assert.rejects(world.players.revive("ghost"), /unknown player/);
        assert.deepEqual(reasons, ["manual"]);
        await assert.doesNotReject(player.inventory.getItems());
        assert.doesNotThrow(() => player.assertCanAct("x"));
    });

    it("lets a revived player resume all their activities", async (t) => {
        const { world, player, time } = await deadPlayer(t);
        stubRandom(t, 0.99);
        time.advance(60_000);
        const result = await travel(t, player, "Ironmill", 1, 1);
        assert.equal(result.arrived, true);
        assert.equal(world.players.peek(player.id), player);
    });
});

describe("Persistence of the death state", () => {
    it("keeps a player dead after an eviction and a reload, with the remaining time", async (t) => {
        const { world, player, time } = await deadPlayer(t);
        time.advance(20_000);
        await world.players.remove(player.id);

        const reloaded = defined(await world.players.get(player.id));
        assert.notEqual(reloaded, player);
        assert.equal(reloaded.isDead, true);
        assert.equal(reloaded.life.getRemainingMs(), 40_000);
        await assert.rejects(reloaded.jobs.perform("fishing", "fish"), expectDead("jobs.perform", 40_000));
    });

    it("revives a player whose cooldown elapsed while they were unloaded", async (t) => {
        const { world, player, time } = await deadPlayer(t);
        await world.players.remove(player.id);
        time.advance(120_000);
        const reloaded = defined(await world.players.get(player.id));
        assert.equal(reloaded.isDead, false);
        assert.equal(reloaded.health.current, reloaded.health.max);
    });

    it("persists nothing for a living player", async () => {
        const world = createWorld();
        const player = await spawn(world);
        assert.equal(player.life.getPersistedDeadUntil(), null);
    });
});

describe("Other death modes", () => {
    it("hardcore: the stale in-memory player stays locked forever", async () => {
        const world = createWorld({ deathMode: "hardcore" });
        const player = await spawn(world);
        await player.takeDamage(99999);
        await sleep(50);
        assert.equal(player.life.isPermanentlyDead, true);
        await assert.rejects(player.moveTo("Ironmill"), (error: unknown) => {
            assert.ok(error instanceof errors.PlayerDeadError);
            assert.equal(error.permanent, true);
            assert.equal(error.remainingMs, Number.POSITIVE_INFINITY);
            assert.equal(error.respawnAt, null);
            assert.match(error.message, /permanently dead/);
            return true;
        });
        assert.equal(player.life.getPersistedDeadUntil(), null);
    });

    it("loose: the player is revived immediately and can act", async () => {
        const world = createWorld({ deathMode: "loose" });
        const player = await spawn(world);
        await player.takeDamage(99999);
        assert.equal(player.isDead, false);
        assert.doesNotThrow(() => player.assertCanAct("x"));
    });

    it("emits playerDied with the respawn time for the cooldown mode", async (t) => {
        const time = clock(t);
        const world = createWorld({ deathCooldown: "90s" });
        const player = await spawn(world);
        const seen: Array<{ mode: string; respawnAt?: number }> = [];
        world.events.on("playerDeath", (payload) => { seen.push({ mode: payload.mode, ...(payload.respawnAt !== undefined ? { respawnAt: payload.respawnAt } : {}) }); });
        await player.takeDamage(99999);
        assert.deepEqual(seen, [{ mode: "cooldown", respawnAt: START + 90_000 }]);
        time.advance(1);
    });

    it("accepts a numeric cooldown", async (t) => {
        const { player } = await deadPlayer(t, { deathCooldown: 2500 });
        assert.equal(player.life.getRemainingMs(), 2500);
    });

    it("a dead player keeps their items out of reach: no item loss is applied twice", async (t) => {
        const { player } = await deadPlayer(t);
        await player.inventory.add(makeItem("relic", ItemCategory.Valuables), 1);
        await assert.rejects(player.inventory.remove("relic"), errors.PlayerDeadError);
        assert.equal((await player.inventory.getItems()).length, 1);
    });
});
