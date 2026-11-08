/**
 * DragonsOfLegends.js — Achievement system (event-driven progress, rewards, serialization).
 *
 * Run only this file:  npx tsx --test tests/achievements.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    AchievementManager,
    AchievementSerializationError,
    DuplicateAchievementError,
    EventEngine,
    InvalidAchievementError,
    type AchievementReward,
    type GameEventEngine
} from "../src/index.js";
import { fakeEvents } from "./helpers/fixtures.js";

describe("AchievementManager", () => {
    const setup = (handler?: (id: string, r: AchievementReward) => void | Promise<void>) => {
        const events: GameEventEngine = new EventEngine();
        const manager = new AchievementManager(events, { now: () => 1000, rewardHandler: handler });
        manager.register(
            {
                id: "slayer", name: "Slayer", description: "Kill 3 goblins",
                criteria: [{ id: "kills", event: "enemyDefeat", target: 3, filter: (p) => p.enemyType === "goblin" }],
                rewards: [{ kind: "gold", amount: 50 }, { kind: "title", titleId: "slime_slayer" }]
            },
            {
                id: "veteran", name: "Veteran", description: "Reach level 10 and travel twice",
                criteria: [
                    { id: "level", event: "playerLevelUp", target: 10, mode: "max", value: (p) => p.level },
                    { id: "trips", event: "travelComplete", target: 2 }
                ]
            }
        );
        return { events, manager };
    };
    const kill = (playerId: string, enemyType = "goblin") =>
        fakeEvents.enemyDefeat({ playerId, enemyType, enemyId: "e", experience: 1, gold: 1 });

    it("tracks progress per player, filters, and unlocks with rewards", async () => {
        const granted: string[] = [];
        const { events, manager } = setup((id, r) => { granted.push(`${id}:${r.kind}`); });
        const unlocked: string[] = [];
        events.on("achievementUnlock", (p) => { unlocked.push(`${p.playerId}:${p.achievementId}`); });
        await events.emitAsync("enemyDefeat", kill("a"));
        await events.emitAsync("enemyDefeat", kill("a", "orc"));
        await events.emitAsync("enemyDefeat", kill("b"));
        assert.equal(manager.getProgress("a", "slayer").criteria[0]?.current, 1);
        assert.equal(manager.getProgress("a", "slayer").percent, 33);
        await events.emitAsync("enemyDefeat", kill("a"));
        await events.emitAsync("enemyDefeat", kill("a"));
        await events.emitAsync("enemyDefeat", kill("a"));
        assert.equal(manager.isUnlocked("a", "slayer"), true);
        assert.equal(manager.isUnlocked("b", "slayer"), false);
        assert.deepEqual(unlocked, ["a:slayer"]);
        assert.deepEqual(granted, ["a:gold", "a:title"]);
    });
    it("handles multi-criteria and max mode", async () => {
        const { events, manager } = setup();
        await events.emitAsync("playerLevelUp", fakeEvents.playerLevelUp("a", 9, 10));
        await events.emitAsync("playerLevelUp", fakeEvents.playerLevelUp("a", 3, 4));
        assert.equal(manager.isUnlocked("a", "veteran"), false);
        await events.emitAsync("travelComplete", fakeEvents.travelComplete("a"));
        await events.emitAsync("travelComplete", fakeEvents.travelComplete("a"));
        assert.equal(manager.isUnlocked("a", "veteran"), true);
    });
    it("keeps the unlock when rewards fail and retries them", async () => {
        let fail = true;
        const { events, manager } = setup(() => { if (fail) throw new Error("inventory full"); });
        for (let i = 0; i < 3; i++) await events.emitAsync("enemyDefeat", kill("a"));
        assert.equal(manager.isUnlocked("a", "slayer"), true);
        assert.equal(manager.exportPlayer("a").achievements.slayer?.rewardsGranted, false);
        fail = false;
        assert.equal(await manager.claimPendingRewards("a"), 1);
        assert.equal(manager.exportPlayer("a").achievements.slayer?.rewardsGranted, true);
    });
    it("round-trips through JSON without replaying rewards and validates input", async () => {
        const granted: string[] = [];
        const first = setup((id) => { granted.push(id); });
        for (let i = 0; i < 4; i++) await first.events.emitAsync("enemyDefeat", kill("a"));
        await first.events.emitAsync("enemyDefeat", kill("c"));
        const json = JSON.stringify(first.manager);
        const second = setup((id) => { granted.push(id); });
        second.manager.loadJSON(json);
        assert.equal(second.manager.isUnlocked("a", "slayer"), true);
        assert.equal(second.manager.getProgress("c", "slayer").criteria[0]?.current, 1);
        assert.equal(granted.length, 2);
        assert.deepEqual(second.manager.exportPlayer("a"), first.manager.exportPlayer("a"));
        assert.throws(() => second.manager.loadJSON("{nope"), AchievementSerializationError);
        assert.throws(() => second.manager.importPlayer({ version: 2 }), AchievementSerializationError);
        assert.throws(() => second.manager.importPlayer({ version: 1, playerId: "z", achievements: { slayer: { progress: { kills: "x" }, unlockedAt: null, rewardsGranted: false } } }), AchievementSerializationError);
        second.manager.importPlayer({ version: 1, playerId: "z", achievements: { ghost: { progress: {}, unlockedAt: null, rewardsGranted: false }, slayer: { progress: { kills: 99 }, unlockedAt: null, rewardsGranted: false } } });
        assert.equal(second.manager.getProgress("z", "slayer").criteria[0]?.current, 3);
    });
    it("validates definitions and disposes", async () => {
        const { events, manager } = setup();
        assert.throws(() => manager.register({ id: "slayer", name: "", description: "", criteria: [{ id: "k", event: "playerDeath", target: 1 }] }), DuplicateAchievementError);
        assert.throws(() => manager.register({ id: "bad", name: "", description: "", criteria: [{ id: "k", event: "playerDeath", target: 0 }] }), InvalidAchievementError);
        assert.throws(() => manager.register({ id: "none", name: "", description: "", criteria: [] }), InvalidAchievementError);
        manager.dispose();
        await events.emitAsync("enemyDefeat", kill("a"));
        assert.equal(manager.getProgress("a", "slayer").criteria[0]?.current, 0);
    });
    it("supports meta-achievements through achievementUnlocked", async () => {
        const { events, manager } = setup();
        manager.register({ id: "first", name: "First", description: "", criteria: [{ id: "any", event: "achievementUnlock", target: 1 }] });
        await manager.unlock("a", "slayer");
        assert.equal(manager.isUnlocked("a", "first"), true);
        void events;
    });
});
