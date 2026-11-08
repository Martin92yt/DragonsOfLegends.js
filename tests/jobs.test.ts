/**
 * DragonsOfLegends.js — Jobs: levels, XP, cooldowns, tools, loot and level rewards.
 *
 * Run only this file:  npx tsx --test tests/jobs.test.ts
 */
import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";

import { ItemCategory, ItemRarity } from "../src/inventory/item.enum.js";
import { FISHING_JOB } from "../src/jobs/official-jobs.js";
import { effectiveCooldownMs, pickLootEntry, readToolModifiers, rollQuantity, xpRequiredForLevel } from "../src/jobs/job.rules.js";
import { MAX_COOLDOWN_REDUCTION_PERCENT, createJobToolNbt, type JobActionDefinition, type JobDefinition } from "../src/jobs/job.types.js";
import { parsePlayerJobsState } from "../src/jobs/job.serialization.js";
import * as errors from "../src/types/error.js";
import { createWorld, defined, makeItem, spawn, stubRandom, totalQuantity, useIsolatedWorkspace, type WorldOptions } from "./helpers/fixtures.js";

useIsolatedWorkspace();

const fish = makeItem("test_fish", ItemCategory.Materials, ItemRarity.Common);
const pearl = makeItem("test_pearl", ItemCategory.Materials, ItemRarity.Legendary);
const rod = makeItem("test_rod", ItemCategory.Tool, ItemRarity.Common, 1);
const bonusRod = makeItem("bonus_rod", ItemCategory.Tool, ItemRarity.Rare, 1);

const catchAction: JobActionDefinition = {
    id: "catch",
    name: "Catch",
    cooldownMs: 10_000,
    xp: 40,
    loot: [{ item: fish, weight: 1, minQuantity: 2, maxQuantity: 2 }]
};

const TEST_JOB: JobDefinition = {
    id: "test_job",
    name: "Test job",
    xpCurve: { base: 100, growth: 2 },
    maxLevel: 4,
    actions: [catchAction, { id: "deep", name: "Deep", cooldownMs: 0, xp: 1, requiredLevel: 2, requiresTool: true, loot: [{ item: pearl, weight: 1, minQuantity: 1, maxQuantity: 1 }] }],
    levelRewards: [
        { level: 2, rewards: [{ kind: "gold", amount: 50 }, { kind: "item", item: makeItem("reward_rod", ItemCategory.Tool, ItemRarity.Common, 1), quantity: 1, nbt: createJobToolNbt("test_job", { luck: 5 }) }] }
    ]
};

async function setup(options: WorldOptions = {}) {
    const world = createWorld({ premadeJobs: false, customJobs: [TEST_JOB], ...options });
    const player = await spawn(world);
    return { world, player };
}

/** Controls Date.now so cooldowns are deterministic. */
function clock(t: TestContext, start = 1_000_000) {
    let now = start;
    t.mock.method(Date, "now", () => now);
    return { advance: (ms: number) => { now += ms; } };
}

describe("Job rules", () => {
    it("computes the XP curve", () => {
        assert.equal(xpRequiredForLevel(TEST_JOB, 1), 100);
        assert.equal(xpRequiredForLevel(TEST_JOB, 3), 400);
        assert.equal(xpRequiredForLevel({ ...TEST_JOB, xpCurve: undefined }, 2), 125);
    });

    it("reduces cooldowns with a hard cap", () => {
        assert.equal(effectiveCooldownMs(catchAction, { luck: 0, xpBonus: 0, cooldownReduction: 20, yieldBonus: 0 }), 8_000);
        assert.equal(effectiveCooldownMs(catchAction, { luck: 0, xpBonus: 0, cooldownReduction: 500, yieldBonus: 0 }), 1_000, `capped at ${MAX_COOLDOWN_REDUCTION_PERCENT}%`);
        assert.equal(effectiveCooldownMs(catchAction, { luck: 0, xpBonus: 0, cooldownReduction: -50, yieldBonus: 0 }), 10_000);
    });

    it("boosts rarer loot with luck but never common loot", () => {
        const entries = [
            { item: fish, weight: 90, minQuantity: 1, maxQuantity: 1 },
            { item: pearl, weight: 10, minQuantity: 1, maxQuantity: 1 }
        ];
        // threshold = 0.91 * total: without luck total=100 -> 91 (>= 90) = pearl; with luck 100%: pearl weight 50, total 140 -> 127.4 (> 90) = pearl, but 0.6 -> 84 < 90 fish.
        assert.equal(pickLootEntry(entries, 0, () => 0.89)?.item.itemId, "test_fish");
        assert.equal(pickLootEntry(entries, 0, () => 0.91)?.item.itemId, "test_pearl");
        assert.equal(pickLootEntry(entries, 100, () => 0.7)?.item.itemId, "test_pearl", "luck makes the legendary entry reachable earlier");
        assert.equal(pickLootEntry(entries, 0, () => 0.7)?.item.itemId, "test_fish");
        assert.equal(pickLootEntry([], 0), undefined);
    });

    it("rolls quantities within bounds", () => {
        const entry = { item: fish, weight: 1, minQuantity: 2, maxQuantity: 4 };
        assert.equal(rollQuantity(entry, () => 0), 2);
        assert.equal(rollQuantity(entry, () => 0.999), 4);
    });

    it("reads tool modifiers defensively", () => {
        assert.deepEqual(readToolModifiers(undefined), { luck: 0, xpBonus: 0, cooldownReduction: 0, yieldBonus: 0 });
        const record = { ...rod, playerId: "p", quantity: 1, itemNbtData: { luckBonus: "x", xpBonusPercent: 10, cooldownReductionPercent: Number.NaN }, isEquipped: false, equipmentSlot: null };
        assert.deepEqual(readToolModifiers(record), { luck: 0, xpBonus: 10, cooldownReduction: 0, yieldBonus: 0 });
    });

    it("parses persisted state defensively", () => {
        assert.deepEqual(parsePlayerJobsState(null), {});
        assert.deepEqual(parsePlayerJobsState("nope"), {});
        const parsed = parsePlayerJobsState({ a: { level: 3, xp: 5, equippedToolItemId: "r", lastActionAt: { x: 1, y: "bad" } }, b: 7 });
        assert.deepEqual(parsed, { a: { level: 3, xp: 5, equippedToolItemId: "r", lastActionAt: { x: 1 } } });
    });
});

describe("JobManager", () => {
    it("registers, lists and unregisters jobs", () => {
        const world = createWorld({ premadeJobs: false });
        assert.equal(world.jobs.size, 0);
        world.jobs.register(TEST_JOB);
        assert.equal(world.jobs.has("test_job"), true);
        assert.equal(world.jobs.requireAction("test_job", "catch").id, "catch");
        assert.equal(world.jobs.list().length, 1);
        assert.throws(() => world.jobs.register(TEST_JOB), errors.JobAlreadyExistsError);
        assert.throws(() => world.jobs.require("nope"), errors.UnknownJobError);
        assert.throws(() => world.jobs.requireAction("test_job", "nope"), errors.UnknownJobActionError);
        assert.equal(world.jobs.unregister("test_job"), true);
        assert.equal(world.jobs.unregister("test_job"), false);
    });

    it("validates definitions and registers batches all-or-nothing", () => {
        const world = createWorld({ premadeJobs: false });
        const invalid: JobDefinition[] = [
            { ...TEST_JOB, id: "" },
            { ...TEST_JOB, id: "j", actions: [] },
            { ...TEST_JOB, id: "j", actions: [{ ...catchAction, cooldownMs: -1 }] },
            { ...TEST_JOB, id: "j", actions: [{ ...catchAction, xp: -1 }] },
            { ...TEST_JOB, id: "j", actions: [{ ...catchAction, loot: [{ item: fish, weight: 0, minQuantity: 1, maxQuantity: 1 }] }] },
            { ...TEST_JOB, id: "j", actions: [{ ...catchAction, loot: [{ item: fish, weight: 1, minQuantity: 3, maxQuantity: 1 }] }] },
            { ...TEST_JOB, id: "j", actions: [catchAction, catchAction] },
            { ...TEST_JOB, id: "j", xpCurve: { base: 0, growth: 1 } }
        ];
        for (const definition of invalid) assert.throws(() => world.jobs.register(definition), errors.InvalidJobError);

        assert.throws(() => world.jobs.bulkRegister([TEST_JOB, { ...TEST_JOB, id: "other", actions: [] }]), errors.InvalidJobError);
        assert.equal(world.jobs.size, 0);
        assert.throws(() => world.jobs.bulkRegister([TEST_JOB, TEST_JOB]), errors.JobAlreadyExistsError);
        assert.equal(world.jobs.size, 0);
    });

    it("loads the official fishing job by default and can skip it", () => {
        assert.equal(createWorld().jobs.has(FISHING_JOB.id), true);
        assert.equal(createWorld({ premadeJobs: false }).jobs.has(FISHING_JOB.id), false);
        assert.throws(() => createWorld({ customJobs: [FISHING_JOB] }), errors.JobAlreadyExistsError);
    });
});

describe("PlayerJobs.perform", () => {
    it("rejects unknown jobs and actions", async () => {
        const { player } = await setup();
        await assert.rejects(async () => player.jobs.perform("nope", "catch"), errors.UnknownJobError);
        await assert.rejects(async () => player.jobs.perform("test_job", "nope"), errors.UnknownJobActionError);
    });

    it("grants loot and XP", async (t) => {
        clock(t);
        stubRandom(t, 0);
        const { player } = await setup();
        const result = await player.jobs.perform("test_job", "catch");
        assert.equal(result.xpGained, 40);
        assert.deepEqual(result.loot.map((entry) => [entry.item.itemId, entry.quantity]), [["test_fish", 2]]);
        assert.equal(await totalQuantity(player, "test_fish"), 2);
        const progress = player.jobs.getProgress("test_job");
        assert.equal(progress.level, 1);
        assert.equal(progress.xp, 40);
        assert.equal(progress.xpToNextLevel, 100, "XP required to leave the current level");
        assert.equal(progress.percent, 40);
    });

    it("enforces the cooldown per action and exposes the remaining time", async (t) => {
        const time = clock(t);
        stubRandom(t, 0);
        const { player } = await setup();
        const first = await player.jobs.perform("test_job", "catch");
        assert.equal(first.cooldownMs, 10_000);
        assert.equal(player.jobs.getRemainingCooldownMs("test_job", "catch"), 10_000);

        time.advance(4_000);
        await assert.rejects(player.jobs.perform("test_job", "catch"), (error: unknown) => error instanceof errors.JobCooldownError);
        assert.equal(player.jobs.getRemainingCooldownMs("test_job", "catch"), 6_000);
        assert.equal(await totalQuantity(player, "test_fish"), 2, "a refused action grants nothing");

        time.advance(6_000);
        await player.jobs.perform("test_job", "catch");
        assert.equal(await totalQuantity(player, "test_fish"), 4);
    });

    it("levels up, carries over XP and applies level rewards", async (t) => {
        const time = clock(t);
        stubRandom(t, 0);
        const { world, player } = await setup();
        const levelUps: number[] = [];
        world.events.on("jobLevelUp", (payload) => { levelUps.push(payload.level); });
        const goldBefore = player.gold;

        await player.jobs.perform("test_job", "catch");
        time.advance(10_000);
        await player.jobs.perform("test_job", "catch");
        time.advance(10_000);
        const result = await player.jobs.perform("test_job", "catch");

        assert.equal(result.previousLevel, 1);
        assert.equal(result.level, 2);
        assert.deepEqual(result.rewards.map((reward) => reward.kind), ["gold", "item"]);
        assert.equal(player.gold, goldBefore + 50);
        assert.equal(await totalQuantity(player, "reward_rod"), 1);
        assert.deepEqual(levelUps, [2]);
        const progress = player.jobs.getProgress("test_job");
        assert.equal(progress.level, 2);
        assert.equal(progress.xp, 20);
    });

    it("stops at the maximum level", async (t) => {
        const time = clock(t);
        stubRandom(t, 0);
        const world = createWorld({ premadeJobs: false, customJobs: [{ ...TEST_JOB, maxLevel: 2, xpCurve: { base: 10, growth: 1 } }] });
        const player = await spawn(world);
        for (let index = 0; index < 4; index++) {
            await player.jobs.perform("test_job", "catch");
            time.advance(10_000);
        }
        const progress = player.jobs.getProgress("test_job");
        assert.equal(progress.level, 2);
        assert.equal(progress.xp, 0);
        assert.equal(progress.percent, 100);
    });

    it("enforces required level and required tool", async (t) => {
        const time = clock(t);
        stubRandom(t, 0);
        const { player } = await setup();
        await assert.rejects(player.jobs.perform("test_job", "deep"), errors.JobLevelTooLowError);

        for (let index = 0; index < 3; index++) {
            await player.jobs.perform("test_job", "catch");
            time.advance(10_000);
        }
        assert.equal(player.jobs.getLevel("test_job"), 2);
        await assert.rejects(player.jobs.perform("test_job", "deep"), errors.JobToolRequiredError);
    });

    it("applies tool modifiers: cooldown reduction, XP bonus and luck", async (t) => {
        const time = clock(t);
        stubRandom(t, 0.75);
        const { player } = await setup();
        await player.inventory.add(bonusRod, 1, createJobToolNbt("test_job", { luck: 100, xpBonus: 50, cooldownReduction: 50, yieldBonus: 0 }));
        await player.jobs.equipTool("test_job", "bonus_rod");
        assert.equal(player.jobs.getEquippedToolId("test_job"), "bonus_rod");

        const result = await player.jobs.perform("test_job", "catch");
        assert.equal(result.xpGained, 60);
        assert.equal(result.cooldownMs, 5_000);
        assert.deepEqual(result.toolModifiers, { luck: 100, xpBonus: 50, cooldownReduction: 50, yieldBonus: 0 });
        time.advance(5_000);
        await player.jobs.perform("test_job", "catch");
    });

    it("lets a tool unlock actions that require one", async (t) => {
        const time = clock(t);
        stubRandom(t, 0);
        const { player } = await setup();
        for (let index = 0; index < 3; index++) {
            await player.jobs.perform("test_job", "catch");
            time.advance(10_000);
        }
        await player.inventory.add(rod, 1, createJobToolNbt("test_job"));
        await player.jobs.equipTool("test_job", "test_rod");
        const result = await player.jobs.perform("test_job", "deep");
        assert.equal(result.loot[0]?.item.itemId, "test_pearl");
    });

    it("validates equipped tools and clears a tool that left the inventory", async (t) => {
        clock(t);
        stubRandom(t, 0);
        const { player } = await setup();
        await assert.rejects(player.jobs.equipTool("nope", "test_rod"), errors.UnknownJobError);
        await assert.rejects(player.jobs.equipTool("test_job", "test_rod"), errors.InvalidJobToolError, "not owned");

        await player.inventory.add(fish, 1);
        await assert.rejects(player.jobs.equipTool("test_job", "test_fish"), errors.InvalidJobToolError, "not a tool");

        await player.inventory.add(rod, 1, createJobToolNbt("other_job"));
        await assert.rejects(player.jobs.equipTool("test_job", "test_rod"), errors.InvalidJobToolError, "tool of another job");

        await player.inventory.add(bonusRod, 1, createJobToolNbt("test_job", { luck: 10 }));
        await player.jobs.equipTool("test_job", "bonus_rod");
        await player.inventory.remove("bonus_rod", 1);
        const result = await player.jobs.perform("test_job", "catch");
        assert.deepEqual(result.toolModifiers, { luck: 0, xpBonus: 0, cooldownReduction: 0, yieldBonus: 0 });
        assert.equal(player.jobs.getEquippedToolId("test_job"), "");
        assert.equal(await player.jobs.unequipTool("test_job"), false);
    });

    it("serializes concurrent calls so the cooldown cannot be bypassed", async (t) => {
        clock(t);
        stubRandom(t, 0);
        const { player } = await setup();
        const results = await Promise.allSettled([player.jobs.perform("test_job", "catch"), player.jobs.perform("test_job", "catch"), player.jobs.perform("test_job", "catch")]);
        assert.deepEqual(results.map((result) => result.status), ["fulfilled", "rejected", "rejected"]);
        assert.equal(await totalQuantity(player, "test_fish"), 2);
    });

    it("emits jobActionPerformed", async (t) => {
        clock(t);
        stubRandom(t, 0);
        const { world, player } = await setup();
        const seen: string[] = [];
        world.events.on("jobAction", (payload) => { seen.push(`${payload.jobId}:${payload.actionId}:${payload.xpGained}:${payload.loot.map((l) => `${l.itemId}x${l.quantity}`).join(",")}`); });
        await player.jobs.perform("test_job", "catch");
        assert.deepEqual(seen, ["test_job:catch:40:test_fishx2"]);
    });

    it("persists progress, tool and cooldown through save and reload", async (t) => {
        const time = clock(t);
        stubRandom(t, 0);
        const { world, player } = await setup();
        await player.inventory.add(bonusRod, 1, createJobToolNbt("test_job", { luck: 10 }));
        await player.jobs.equipTool("test_job", "bonus_rod");
        await player.jobs.perform("test_job", "catch");
        await world.players.remove(player.id);

        const reloaded = defined(await world.players.get(player.id));
        assert.equal(reloaded.jobs.getProgress("test_job").xp, 40);
        assert.equal(reloaded.jobs.getEquippedToolId("test_job"), "bonus_rod");
        assert.ok(reloaded.jobs.getRemainingCooldownMs("test_job", "catch") > 0);
        time.advance(10_000);
        assert.equal(reloaded.jobs.getRemainingCooldownMs("test_job", "catch"), 0);
    });

    it("lists progress for every job a player has started or can start", async () => {
        const { player } = await setup();
        const views = player.jobs.listProgress();
        assert.equal(views.length, 1);
        assert.equal(views[0]?.jobId, "test_job");
        assert.equal(views[0]?.level, 1);
    });
});

describe("Official fishing job", () => {
    it("is configured for /fish with tiered rewards", () => {
        assert.equal(FISHING_JOB.actions[0]?.id, "fish");
        assert.ok((FISHING_JOB.levelRewards ?? []).length >= 4);
    });

    it("lets a player fish with the default rods once equipped", async (t) => {
        clock(t);
        stubRandom(t, 0);
        const world = createWorld();
        const player = await spawn(world);
        const result = await player.jobs.perform("fishing", "fish");
        assert.equal(result.actionId, "fish");
        assert.ok(result.loot.length > 0);
        assert.equal(result.cooldownMs, 30_000);
    });
});
