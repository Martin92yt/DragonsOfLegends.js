/**
 * DragonsOfLegends.js — Official pack, achievements wiring, title ladder and persistence.
 *
 * Run only this file:  npx tsx --test tests/official-pack.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OFFICIAL_ACHIEVEMENTS } from "../src/achievements/official-achievements.js";
import { OFFICIAL_PACK_IDS } from "../src/content/official-packs.js";
import { ItemCategory } from "../src/inventory/item.enum.js";
import { TitleRarity } from "../src/title/title.types.js";
import { OFFICIAL_TITLES } from "../src/title/official-titles.js";
import Combat from "../src/combat/combat.js";
import { AchievementManager, EnemyManager, EventEngine, type GameEventEngine } from "../src/index.js";
import { createWorld, fixAttributes, makeItem, stubRandom, spawn, totalQuantity, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));
const RARITY_ORDER = [TitleRarity.Common, TitleRarity.Uncommon, TitleRarity.Rare, TitleRarity.Epic, TitleRarity.Legendary];

describe("loadOfficialPack", () => {
    it("loads everything in one call on top of the default content, once", () => {
        const world = createWorld();
        assert.equal(world.items.size, 0);
        const loaded = world.loadOfficialPack();
        assert.deepEqual(loaded.map((pack) => pack.id).sort(), [OFFICIAL_PACK_IDS.items, OFFICIAL_PACK_IDS.achievements].sort());
        assert.ok(world.items.has("health_potion") && world.shops.has("general_store") && world.lootboxes.has("pouch_rare"));
        assert.equal(world.achievements.list().length, OFFICIAL_ACHIEVEMENTS.length);
        assert.deepEqual(world.loadOfficialPack(), [], "a second call loads nothing");
    });

    it("loads every pack in an empty world, and with the `officialPack` option", () => {
        const empty = createWorld({ premadeContent: false });
        assert.equal(empty.loadOfficialPack().length, Object.keys(OFFICIAL_PACK_IDS).length);
        const world = createWorld({ officialPack: true });
        assert.ok(world.enemies.size >= 20 && world.items.size > 10 && world.titles.size === OFFICIAL_TITLES.length);
    });

    it("accepts custom content on top, with override of an official entry", () => {
        const world = createWorld({ officialPack: true });
        world.content.use({ id: "mine", items: [makeItem("custom_gem")], achievements: [{ id: "gem_collector", name: "Gem", description: "d", criteria: [{ id: "c", event: "shopBuy", target: 1 }], rewards: [] }] });
        assert.ok(world.items.has("custom_gem") && world.achievements.has("gem_collector"));
        world.content.use({ id: "tweak", achievements: [{ id: "first_blood", name: "Blood!", description: "d", criteria: [{ id: "c", event: "enemyDefeat", target: 5 }], rewards: [] }] }, { override: true });
        assert.equal(world.achievements.get("first_blood").name, "Blood!");
    });

    it("keeps the achievements pack out of a world without its dependencies", () => {
        assert.throws(() => createWorld({ premadeAchievements: true }));
    });

    it("rolls back the achievements of a failing pack", () => {
        const world = createWorld({ officialPack: true });
        const before = world.achievements.list().length;
        const base = { name: "n", description: "d", criteria: [{ id: "c", event: "shopBuy" as const, target: 1 }], rewards: [] };
        assert.throws(() => world.content.use({ id: "bad", achievements: [{ ...base, id: "ok_one" }, { ...base, id: "first_blood" }] }));
        assert.equal(world.achievements.has("ok_one"), false);
        assert.equal(world.achievements.list().length, before);
    });

    it("ships the starter equipment, potions and amulets", () => {
        const world = createWorld({ officialPack: true });
        for (const id of ["health_potion", "rusty_sword", "regeneration_potion", "xp_boost_potion", "luck_amulet", "xp_amulet", "critical_amulet"]) assert.ok(world.items.has(id), id);
        assert.ok(world.items.require("luck_amulet").category === ItemCategory.Amulet);
    });
});

describe("Official achievements and titles", () => {
    it("references only registered items and titles, and every title is earned", () => {
        const world = createWorld({ officialPack: true });
        const earned = new Set<string>();
        for (const achievement of OFFICIAL_ACHIEVEMENTS) {
            for (const reward of achievement.rewards) {
                if (reward.kind === "item") assert.ok(world.items.has(reward.itemId), `${achievement.id} -> ${reward.itemId}`);
                if (reward.kind === "title") {
                    assert.ok(world.titles.has(reward.titleId), `${achievement.id} -> ${reward.titleId}`);
                    earned.add(reward.titleId);
                }
            }
        }
        // Rationale: the starting title is given to every new player, no achievement needed.
        for (const title of OFFICIAL_TITLES.filter((candidate) => candidate.id !== "novice_adventurer")) assert.ok(earned.has(title.id), `title ${title.id} cannot be earned`);
    });

    it("climbs the ladder: the title rarity follows the difficulty of its achievement", () => {
        const rarityOf = new Map(OFFICIAL_TITLES.map((title) => [title.id, RARITY_ORDER.indexOf(title.rarity)]));
        const titled = OFFICIAL_ACHIEVEMENTS.flatMap((achievement) => achievement.rewards.flatMap((reward) => (reward.kind === "title" ? [{ achievement, rank: rarityOf.get(reward.titleId) ?? -1 }] : [])));
        const targetOf = (id: string): number => OFFICIAL_ACHIEVEMENTS.find((candidate) => candidate.id === id)?.criteria[0]?.target ?? 0;
        assert.ok(titled.every((entry) => entry.rank >= 0));
        for (const rank of [0, 1, 2, 3, 4]) assert.ok(titled.some((entry) => entry.rank === rank), `no title of rank ${rank}`);
        assert.ok(targetOf("level_5") < targetOf("level_20") && targetOf("level_20") < targetOf("level_40") && targetOf("level_40") < targetOf("level_50"));
        assert.equal(OFFICIAL_TITLES.find((title) => title.id === "eternal_champion")?.rarity, TitleRarity.Legendary);
        assert.equal(OFFICIAL_TITLES.find((title) => title.id === "novice_adventurer")?.rarity, TitleRarity.Common);
    });

    it("has unique identifiers", () => {
        assert.equal(new Set(OFFICIAL_ACHIEVEMENTS.map((achievement) => achievement.id)).size, OFFICIAL_ACHIEVEMENTS.length);
        assert.equal(new Set(OFFICIAL_TITLES.map((title) => title.id)).size, OFFICIAL_TITLES.length);
    });
});

describe("Achievements in play", () => {
    it("unlocks 'first blood' on a victory and pays gold and the title", async () => {
        const world = createWorld({ officialPack: true, starterItems: {} });
        const player = await spawn(world);
        const gold = player.gold;
        await world.events.emitAsync("enemyDefeat", { playerId: player.id, player, enemyId: "slime", enemyType: "slime", tier: "beginner", enemyName: "Slime", experience: 1, gold: 0, killed: true } as never);
        await settle();
        assert.equal(world.achievements.isUnlocked(player.id, "first_blood"), true);
        assert.ok(player.gold >= gold + 20, "the 20 gold of the achievement were paid");
        assert.equal(player.titles.has("first_blood"), true);
    });

    it("counts only the matching species and tier", async () => {
        const world = createWorld({ officialPack: true, starterItems: {} });
        const player = await spawn(world);
        const defeat = (enemyId: string, tier: string) => world.events.emitAsync("enemyDefeat", { playerId: player.id, player, enemyId, enemyType: enemyId, tier } as never);
        for (let kill = 0; kill < 49; kill++) await defeat("slime", "beginner");
        assert.equal(world.achievements.isUnlocked(player.id, "slime_slayer"), false);
        await defeat("goblin", "beginner");
        assert.equal(world.achievements.isUnlocked(player.id, "slime_slayer"), false);
        await defeat("slime", "beginner");
        await settle();
        assert.equal(world.achievements.isUnlocked(player.id, "slime_slayer"), true);
        await defeat("ancient_dragon", "boss");
        await settle();
        assert.equal(world.achievements.isUnlocked(player.id, "dragon_slayer"), true);
    });

    it("unlocks from a real combat victory (species id and tier are reported)", async (t) => {
        const world = createWorld({ officialPack: true, starterItems: {} });
        const player = await spawn(world);
        fixAttributes(player);
        const seen: Array<[string, string | undefined]> = [];
        world.events.on("enemyDefeat", (payload) => { seen.push([payload.enemyId, payload.tier]); });
        stubRandom(t, 0.5);
        const enemy = new EnemyManager(world.enemies).createOfType("slime", 1);
        enemy.health = 1;
        await new Combat(player, enemy).attack();
        await settle();
        assert.deepEqual(seen, [["slime", "beginner"]]);
        assert.equal(world.achievements.isUnlocked(player.id, "first_blood"), true);
    });

    it("rewards levels, lootboxes and purchases", async () => {
        const world = createWorld({ officialPack: true, starterItems: {} });
        const player = await spawn(world);
        player.addXP(110);
        await settle();
        assert.equal(world.achievements.isUnlocked(player.id, "level_5"), false);
        for (let opened = 0; opened < 1; opened++) await world.lootboxes.open(player, "pouch_common", { random: () => 0 });
        await settle();
        assert.equal(world.achievements.isUnlocked(player.id, "pouch_opener"), true);
        assert.equal(player.titles.has("pouch_opener"), true);
        player.gold = 10_000;
        for (let purchase = 0; purchase < 10; purchase++) await world.shops.buy(player, "general_store", "health_potion");
        await settle();
        assert.equal(world.achievements.isUnlocked(player.id, "savvy_shopper"), true);
        assert.equal(await totalQuantity(player, "pouch_common") >= 1, true);
    });

    it("keeps progress and unlocks across a save and reload", async () => {
        const world = createWorld({ officialPack: true, starterItems: {} });
        const player = await spawn(world);
        const defeat = () => world.events.emitAsync("enemyDefeat", { playerId: player.id, player, enemyId: "slime", enemyType: "slime", tier: "beginner" } as never);
        for (let kill = 0; kill < 10; kill++) await defeat();
        await settle();
        await world.players.remove(player.id);
        assert.equal(world.achievements.isUnlocked(player.id, "first_blood"), false, "memory is released on unload");

        const reloaded = await world.players.get(player.id);
        assert.ok(reloaded);
        assert.equal(world.achievements.isUnlocked(player.id, "first_blood"), true);
        assert.equal(reloaded.titles.has("first_blood"), true);
        assert.equal(world.achievements.getProgress(player.id, "slime_slayer")?.criteria[0]?.current, 10);
    });

    it("does not pay a reward twice when a retry follows a failed reward", async () => {
        const events = new EventEngine() as GameEventEngine;
        const paid: number[] = [];
        let failNext = true;
        const manager = new AchievementManager(events, {
            rewardHandler: async (_playerId, reward) => {
                if (reward.kind !== "gold") return;
                if (reward.amount === 7 && failNext) throw new Error("boom");
                paid.push(reward.amount);
            }
        });
        manager.register({ id: "two", name: "Two", description: "d", criteria: [{ id: "c", event: "shopBuy", target: 1 }], rewards: [{ kind: "gold", amount: 5 }, { kind: "gold", amount: 7 }] });
        await manager.unlock("p1", "two").catch(() => undefined);
        failNext = false;
        assert.equal(await manager.claimPendingRewards("p1"), 1);
        assert.deepEqual(paid, [5, 7], "the first reward was not replayed");
        assert.equal(manager.exportPlayer("p1").achievements["two"]?.rewardsGranted, true);
        manager.dispose();
    });

    it("unregisters an achievement and stops listening to its events", async () => {
        const events = new EventEngine() as GameEventEngine;
        const manager = new AchievementManager(events, { rewardHandler: async () => undefined });
        manager.register({ id: "a", name: "A", description: "d", criteria: [{ id: "c", event: "shopBuy", target: 1 }], rewards: [] });
        assert.equal(manager.unregister("a"), true);
        assert.equal(manager.unregister("a"), false);
        assert.equal(manager.has("a"), false);
        manager.dispose();
    });
});
