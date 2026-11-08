/**
 * DragonsOfLegends.js — Titles: registry, player titles, persistence and achievement rewards.
 *
 * Run only this file:  npx tsx --test tests/titles.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Database from "better-sqlite3";

import { AchievementManager } from "../src/achievements/achievement.manager.js";
import { EventEngine, type GameEvents } from "../src/events/index.js";
import { OFFICIAL_TITLES } from "../src/title/official-titles.js";
import TitleManager from "../src/title/title.manager.js";
import { createTitleRewardHandler } from "../src/title/title.rewards.js";
import { TitleRarity } from "../src/title/title.types.js";
import * as errors from "../src/types/error.js";
import { createWorld, databasePathOf, defined, fakeEvents, spawn, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("Titles", () => {
    it("ships valid official titles and registers them by default", () => {
        const world = createWorld();
        assert.equal(world.titles.size, OFFICIAL_TITLES.length);
        assert.equal(world.titles.get("slime_slayer")?.rarity, TitleRarity.Uncommon);
        assert.equal(createWorld({ premadeTitles: false }).titles.size, 0);
    });

    it("registers custom titles and validates definitions", () => {
        const world = createWorld({ premadeTitles: false, customTitles: [{ id: "slime_king", name: "Slime King", rarity: TitleRarity.Rare }] });
        assert.equal(world.titles.require("slime_king").name, "Slime King");
        assert.throws(() => world.titles.register({ id: "slime_king", name: "Dup", rarity: TitleRarity.Common }), errors.TitleAlreadyExistsError);
        assert.throws(() => world.titles.register({ id: " ", name: "x", rarity: TitleRarity.Common }), errors.InvalidTitleError);
        assert.throws(() => world.titles.register({ id: "a", name: "", rarity: TitleRarity.Common }), errors.InvalidTitleError);
        assert.throws(() => world.titles.register({ id: "b", name: "b", rarity: "mythic" as TitleRarity }), errors.InvalidTitleError);
        assert.throws(() => world.titles.require("ghost"), errors.UnknownTitleError);
        assert.throws(() => world.titles.bulkRegister([{ id: "ok", name: "Ok", rarity: TitleRarity.Common }, { id: "ok", name: "Again", rarity: TitleRarity.Common }]), errors.TitleAlreadyExistsError);
        assert.equal(world.titles.has("ok"), false, "bulkRegister is all-or-nothing");
    });

    it("lists titles by prestige and filters by rarity", () => {
        const manager = new TitleManager();
        manager.bulkRegister([
            { id: "c", name: "Common", rarity: TitleRarity.Common },
            { id: "l", name: "Legend", rarity: TitleRarity.Legendary },
            { id: "r2", name: "Beta", rarity: TitleRarity.Rare },
            { id: "r1", name: "Alpha", rarity: TitleRarity.Rare }
        ]);
        assert.deepEqual(manager.list().map((title) => title.id), ["l", "r1", "r2", "c"]);
        assert.deepEqual(manager.listByRarity(TitleRarity.Rare).map((title) => title.id), ["r1", "r2"]);
        assert.equal(manager.unregister("c"), true);
        assert.equal(manager.unregister("c"), false);
    });

    it("grants, equips (one at a time) and revokes titles", async () => {
        const world = createWorld();
        const player = await spawn(world);
        assert.equal(await player.titles.grant("slime_slayer"), true);
        assert.equal(await player.titles.grant("slime_slayer"), false, "already owned");
        await player.titles.grant("dragon_slayer");
        await assert.rejects(player.titles.grant("ghost"), errors.UnknownTitleError);
        await assert.rejects(player.titles.equip("gilded_purse"), errors.TitleNotOwnedError);
        await assert.rejects(player.titles.equip("ghost"), errors.UnknownTitleError);

        assert.equal(player.titles.getEquipped(), undefined);
        await player.titles.equip("slime_slayer");
        await player.titles.equip("dragon_slayer");
        assert.equal(player.titles.getEquipped()?.id, "dragon_slayer", "equipping replaces the previous title");
        assert.deepEqual(player.titles.list().map((title) => title.id), ["dragon_slayer", "slime_slayer"]);
        assert.equal(player.titles.getDisplayName(), `${player.name}, Dragon Slayer`);
        assert.equal(player.toJSON().title?.id, "dragon_slayer");

        assert.equal(await player.titles.revoke("dragon_slayer"), true);
        assert.equal(player.titles.getEquipped(), undefined, "revoking the equipped title unequips it");
        assert.equal(await player.titles.unequip(), false);
        assert.equal(player.titles.getDisplayName(), player.name);
        assert.equal(player.toJSON().title, null);
    });

    it("persists owned and equipped titles across reloads", async () => {
        const world = createWorld();
        const player = await spawn(world);
        await player.titles.grant("slime_slayer");
        await player.titles.grant("gilded_purse");
        await player.titles.equip("gilded_purse");
        await world.players.remove(player.id);

        const reloaded = defined(await world.players.get(player.id));
        assert.notEqual(reloaded, player);
        assert.deepEqual(reloaded.titles.getOwnedIds().sort(), ["gilded_purse", "slime_slayer"]);
        assert.equal(reloaded.titles.getEquipped()?.id, "gilded_purse");
    });

    it("migrates legacy Player tables and survives corrupted title data", async () => {
        const world = createWorld();
        const player = await spawn(world);
        await world.players.save(player);
        const database = new Database(databasePathOf(world));
        database.prepare("UPDATE Player SET Titles = ?, EquippedTitle = ? WHERE Identifier = ?").run("{not json", "slime_slayer", player.id);
        database.close();
        await world.players.remove(player.id);

        const reloaded = defined(await world.players.get(player.id));
        assert.deepEqual(reloaded.titles.getOwnedIds(), []);
        assert.equal(reloaded.titles.getEquipped(), undefined, "an equipped title that is not owned is dropped");
    });

    it("keeps unregistered titles owned but hides them", async () => {
        const world = createWorld({ premadeTitles: false, customTitles: [{ id: "temp", name: "Temp", rarity: TitleRarity.Common }] });
        const player = await spawn(world);
        await player.titles.grant("temp");
        await player.titles.equip("temp");
        world.titles.unregister("temp");
        assert.equal(player.titles.getEquipped(), undefined);
        assert.deepEqual(player.titles.list(), []);
        assert.deepEqual(player.titles.getOwnedIds(), ["temp"]);
    });

    it("is granted by achievements through the reward handler", async () => {
        const world = createWorld();
        const player = await spawn(world);
        const events = new EventEngine<GameEvents>();
        const goldGiven: number[] = [];
        const achievements = new AchievementManager(events, {
            rewardHandler: createTitleRewardHandler(world, (_playerId, reward) => {
                if (reward.kind === "gold") goldGiven.push(reward.amount);
            })
        });
        achievements.register({
            id: "slime_hunt", name: "Slime hunt", description: "Defeat 2 slimes",
            criteria: [{ id: "kills", event: "enemyDefeat", target: 2, filter: (payload) => payload.enemyType === "slime" }],
            rewards: [{ kind: "gold", amount: 25 }, { kind: "title", titleId: "slime_slayer" }]
        });
        for (let kill = 0; kill < 2; kill++) {
            await events.emitAsync("enemyDefeat", fakeEvents.enemyDefeat({ playerId: player.id, enemyType: "slime", enemyId: "s", experience: 1, gold: 1 }));
        }
        assert.equal(player.titles.has("slime_slayer"), true);
        assert.deepEqual(goldGiven, [25]);
    });

    it("keeps the reward pending when the title or player is unknown", async () => {
        const world = createWorld();
        const events = new EventEngine<GameEvents>();
        const achievements = new AchievementManager(events, { rewardHandler: createTitleRewardHandler(world) });
        achievements.register({
            id: "bad_reward", name: "Bad", description: "",
            criteria: [{ id: "k", event: "playerDeath", target: 1 }],
            rewards: [{ kind: "title", titleId: "ghost" }]
        });
        await events.emitAsync("playerDeath", fakeEvents.playerDeath("nobody"));
        assert.equal(achievements.isUnlocked("nobody", "bad_reward"), true);
        assert.equal(achievements.exportPlayer("nobody").achievements.bad_reward?.rewardsGranted, false);
    });
});
