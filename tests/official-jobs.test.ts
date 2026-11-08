/**
 * DragonsOfLegends.js — Official jobs (fishing, mining, woodcutting) and the tool yield modifier.
 *
 * Run only this file:  npx tsx --test tests/official-jobs.test.ts
 */
import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";

import { ItemCategory } from "../src/inventory/item.enum.js";
import { applyYield, readToolModifiers } from "../src/jobs/job.rules.js";
import { JOB_TOOL_NBT_KEYS, createJobToolNbt, isToolOfJob, type JobDefinition } from "../src/jobs/job.types.js";
import { FISHING_JOB, MINING_JOB, OFFICIAL_JOBS, WOODCUTTING_JOB } from "../src/jobs/official-jobs.js";
import * as errors from "../src/types/error.js";
import { createWorld, defined, makeItem, spawn, stubRandom, totalQuantity, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

function clock(t: TestContext, start = 5_000_000) {
    let now = start;
    t.mock.method(Date, "now", () => now);
    return { advance: (ms: number) => { now += ms; } };
}

describe("Yield modifier", () => {
    it("is a no-op without bonus and boosts quantities with a probabilistic remainder", () => {
        assert.equal(applyYield(3, 0), 3);
        assert.equal(applyYield(3, -50), 3);
        assert.equal(applyYield(4, 50, () => 0.99), 6);
        assert.equal(applyYield(1, 25, () => 0.1), 2, "25% chance of one extra item");
        assert.equal(applyYield(1, 25, () => 0.5), 1);
        assert.equal(applyYield(2, 100, () => 0.99), 4);
    });

    it("is stored in and read from the tool data", () => {
        const nbt = createJobToolNbt("mining", { yieldBonus: 30 });
        assert.equal(nbt[JOB_TOOL_NBT_KEYS.yieldBonus], 30);
        const record = { ...makeItem("p", ItemCategory.Tool), playerId: "x", quantity: 1, itemNbtData: nbt, isEquipped: false, equipmentSlot: null };
        assert.equal(readToolModifiers(record).yieldBonus, 30);
        assert.equal(isToolOfJob(record, "mining"), true);
    });
});

describe("Official jobs catalogue", () => {
    const jobs: readonly JobDefinition[] = [FISHING_JOB, MINING_JOB, WOODCUTTING_JOB];

    it("ships fishing, mining and woodcutting, all registered by default", () => {
        assert.deepEqual(OFFICIAL_JOBS.map((job) => job.id), ["fishing", "mining", "woodcutting"]);
        const world = createWorld();
        for (const job of jobs) assert.equal(world.jobs.has(job.id), true);
        assert.equal(createWorld({ premadeJobs: false }).jobs.size, 0);
    });

    it("exposes the expected actions", () => {
        assert.deepEqual(MINING_JOB.actions.map((action) => action.id), ["mine", "deep_mine"]);
        assert.deepEqual(WOODCUTTING_JOB.actions.map((action) => action.id), ["chop", "gather_branches"]);
        assert.equal(MINING_JOB.actions[1]?.requiresTool, true);
    });

    it("hands out tools of the right job at the documented levels", () => {
        for (const job of jobs) {
            const tools = (job.levelRewards ?? []).flatMap((entry) => entry.rewards).flatMap((reward) => (reward.kind === "item" ? [reward] : []));
            assert.equal(tools.length, 4, job.id);
            for (const reward of tools) {
                assert.equal(reward.item.category, ItemCategory.Tool);
                assert.equal(reward.nbt?.[JOB_TOOL_NBT_KEYS.jobId], job.id);
            }
        }
    });

    it("has unique item identifiers per loot table and valid loot weights", () => {
        for (const job of jobs) {
            for (const action of job.actions) {
                assert.ok(action.loot.length > 0);
                assert.equal(new Set(action.loot.map((entry) => entry.item.itemId)).size, action.loot.length, `${job.id}.${action.id}`);
                for (const entry of action.loot) assert.ok(entry.weight > 0 && entry.minQuantity <= entry.maxQuantity);
            }
        }
    });

    it("rejects registering an official job twice", () => {
        assert.throws(() => createWorld({ customJobs: [MINING_JOB] }), errors.JobAlreadyExistsError);
        assert.throws(() => createWorld({ customJobs: [WOODCUTTING_JOB] }), errors.JobAlreadyExistsError);
    });

    it("lets custom jobs coexist with the official ones", () => {
        const custom: JobDefinition = { id: "herbalism", name: "Herbalism", actions: [{ id: "pick", name: "Pick", cooldownMs: 1000, xp: 1, loot: [{ item: makeItem("herb"), weight: 1, minQuantity: 1, maxQuantity: 1 }] }] };
        const world = createWorld({ customJobs: [custom] });
        assert.equal(world.jobs.size, 4);
    });
});

describe("Mining", () => {
    it("mines common ore at level 1 and never rare ore below its level", async (t) => {
        clock(t);
        stubRandom(t, 0.99);
        const player = await spawn(createWorld());
        const result = await player.jobs.perform("mining", "mine");
        assert.ok(result.loot.length === 1);
        assert.notEqual(result.loot[0]?.item.itemId, "titanium_ore");
        assert.equal(result.cooldownMs, 20_000);
    });

    it("gates deep mining behind level 10 and a pickaxe", async (t) => {
        clock(t);
        stubRandom(t, 0);
        const player = await spawn(createWorld());
        await assert.rejects(player.jobs.perform("mining", "deep_mine"), errors.JobLevelTooLowError);
    });

    it("applies a pickaxe yield and cooldown reduction", async (t) => {
        const time = clock(t);
        stubRandom(t, 0);
        const player = await spawn(createWorld());
        await player.inventory.add(makeItem("test_pick", ItemCategory.Tool, undefined, 1), 1, createJobToolNbt("mining", { yieldBonus: 100, cooldownReduction: 50 }));
        await player.jobs.equipTool("mining", "test_pick");

        const result = await player.jobs.perform("mining", "mine");
        // random = 0: first loot entry (stone) with min quantity 2, doubled by +100% yield.
        assert.deepEqual(result.loot.map((entry) => [entry.item.itemId, entry.quantity]), [["stone", 4]]);
        assert.equal(await totalQuantity(player, "stone"), 4);
        assert.equal(result.cooldownMs, 10_000);
        assert.equal(result.toolModifiers.yieldBonus, 100);
        time.advance(10_000);
        await player.jobs.perform("mining", "mine");
    });

    it("grants the wooden pickaxe at level 2 and tracks mining independently of fishing", async (t) => {
        const time = clock(t);
        stubRandom(t, 0);
        const player = await spawn(createWorld());
        for (let index = 0; index < 20 && player.jobs.getLevel("mining") < 2; index++) {
            await player.jobs.perform("mining", "mine");
            time.advance(20_000);
        }
        assert.equal(player.jobs.getLevel("mining"), 2);
        assert.equal(await totalQuantity(player, "wooden_pickaxe"), 1);
        assert.equal(player.jobs.getLevel("fishing"), 1);
        await player.jobs.equipTool("mining", "wooden_pickaxe");
        await assert.rejects(player.jobs.equipTool("woodcutting", "wooden_pickaxe"), errors.InvalidJobToolError);
    });
});

describe("Woodcutting", () => {
    it("chops logs and gathers branches with their own cooldowns", async (t) => {
        clock(t);
        stubRandom(t, 0);
        const player = await spawn(createWorld());
        const chop = await player.jobs.perform("woodcutting", "chop");
        const branches = await player.jobs.perform("woodcutting", "gather_branches");
        assert.equal(chop.loot[0]?.item.itemId, "oak_log");
        assert.equal(branches.loot[0]?.item.itemId, "branch");
        assert.equal(chop.cooldownMs, 15_000);
        assert.equal(branches.cooldownMs, 10_000);
        await assert.rejects(player.jobs.perform("woodcutting", "chop"), errors.JobCooldownError);
    });

    it("awards axes through level-ups and persists the progress", async (t) => {
        const time = clock(t);
        stubRandom(t, 0);
        const world = createWorld();
        const player = await spawn(world);
        for (let index = 0; index < 20 && player.jobs.getLevel("woodcutting") < 2; index++) {
            await player.jobs.perform("woodcutting", "chop");
            time.advance(15_000);
        }
        assert.equal(await totalQuantity(player, "wooden_axe"), 1);
        await world.players.remove(player.id);
        const reloaded = defined(await world.players.get(player.id));
        assert.equal(reloaded.jobs.getLevel("woodcutting"), 2);
        assert.equal(await totalQuantity(reloaded, "wooden_axe"), 1);
    });
});
