/**
 * DragonsOfLegends.js — Global event system: naming convention, typed payloads, emission points.
 *
 * Run only this file:  npx tsx --test tests/game-events.test.ts
 */
import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";

import { ItemCategory } from "../src/inventory/item.enum.js";
import { LEGACY_EVENT_NAMES, PlayerMarriage, type GameEventName, type GameEvents } from "../src/index.js";
import { createJobToolNbt, type JobDefinition } from "../src/jobs/job.types.js";
import { TitleRarity } from "../src/title/title.types.js";
import type World from "../src/world.js";
import { createWorld, databasePathOf, defined, fixAttributes, giveAndEquip, makeEnemy, makeItem, settle, spawn, stubRandom, travel, useIsolatedWorkspace, type WorldOptions } from "./helpers/fixtures.js";

useIsolatedWorkspace();

/** Convention: `<subject><Verb>` in camelCase, e.g. `playerCreate`, `itemBankDeposit`. */
const NAMING_CONVENTION = /^[a-z]+(?:[A-Z][a-z]+)+$/;

interface Recorded<K extends GameEventName = GameEventName> {
    readonly name: K;
    readonly payload: GameEvents[K];
}

/** Records every event emitted by a world, in order. */
function record(world: World): { all: Recorded[]; names: () => string[]; of: <K extends GameEventName>(name: K) => Array<GameEvents[K]> } {
    const all: Recorded[] = [];
    world.events.onAny((event) => { all.push({ name: event.name, payload: event.payload }); });
    return {
        all,
        names: () => all.map((event) => event.name),
        of: <K extends GameEventName>(name: K): Array<GameEvents[K]> => all.filter((event) => event.name === name).map((event) => event.payload as GameEvents[K])
    };
}

const fish = makeItem("evt_fish", ItemCategory.Materials);
const rod = makeItem("evt_rod", ItemCategory.Tool, undefined, 1);
const JOB: JobDefinition = {
    id: "evt_job",
    name: "Event job",
    xpCurve: { base: 10, growth: 1 },
    maxLevel: 5,
    actions: [{ id: "catch", name: "Catch", cooldownMs: 0, xp: 25, loot: [{ item: fish, weight: 1, minQuantity: 2, maxQuantity: 2 }] }]
};

async function setup(options: WorldOptions = {}) {
    const world = createWorld({ premadeJobs: false, customJobs: [JOB], customItems: [fish, rod], bankUnlockCost: 0, ...options });
    const events = record(world);
    const player = await spawn(world);
    return { world, player, events };
}

/** Every payload that carries an entity must be consistent with its `playerId`. */
function assertConsistent(events: Recorded[]): void {
    for (const { name, payload } of events) {
        const candidate = payload as { playerId?: string; player?: { id: string } };
        if (candidate.player) assert.equal(candidate.player.id, candidate.playerId, `${name}: player.id must match playerId`);
    }
}

describe("Naming convention", () => {
    it("every emitted event follows <subject><Verb> in camelCase", async (t) => {
        stubRandom(t, 0.99);
        const { world, player, events } = await setup();
        fixAttributes(player);
        player.addXP(500);
        await player.takeDamage(1);
        await world.bank.deposit(Object.assign(player, { bankUnlocked: true }), 1);
        await player.jobs.perform("evt_job", "catch");
        await settle();
        assert.ok(events.names().length > 5);
        for (const name of new Set(events.names())) assert.match(name, NAMING_CONVENTION, name);
    });

    it("maps every legacy name to a current event that follows the convention", () => {
        for (const [legacy, current] of Object.entries(LEGACY_EVENT_NAMES)) {
            assert.notEqual(legacy, current);
            assert.match(current, NAMING_CONVENTION, current);
        }
        assert.equal(LEGACY_EVENT_NAMES.monsterDefeated, "enemyDefeat");
        assert.equal(LEGACY_EVENT_NAMES.goldChanged, "playerGoldChange");
    });
});

describe("World and content", () => {
    it("emits worldLaunch with the world, and keeps the legacy Node event", async () => {
        const world = createWorld();
        const typed = world.events.waitFor("worldLaunch", { timeoutMs: 2000 });
        const legacy = new Promise<void>((resolve) => world.once("gameLaunched", resolve));
        const payload = await typed;
        await legacy;
        assert.equal(payload.world, world);
    });

    it("emits contentPackLoad with the loaded pack", async () => {
        const world = createWorld();
        const events = record(world);
        const loaded = world.content.use({ id: "evt_pack", name: "Evt", version: "1.0.0", items: [makeItem("pack_item")] });
        const [payload] = events.of("contentPackLoad");
        assert.equal(payload?.world, world);
        assert.equal(payload?.pack, loaded);
    });
});

describe("Player lifecycle", () => {
    it("emits playerCreate with the player, class, starter gold and the starter items actually granted", async () => {
        const world = createWorld({ customItems: [makeItem("ration")], starterGold: 25, starterItems: { ration: 3, ghost_item: 1 } });
        const events = record(world);
        const player = await spawn(world);
        const [payload, ...others] = events.of("playerCreate");
        assert.equal(others.length, 0);
        assert.equal(payload?.player, player);
        assert.equal(payload?.playerId, player.id);
        assert.equal(payload?.classId, player.classId);
        assert.equal(payload?.starterGold, 25);
        assert.deepEqual(payload?.starterItems, [{ itemId: "ration", quantity: 3 }]);
        assertConsistent(events.all);
    });

    it("emits playerUnload then playerLoad around an eviction", async () => {
        const { world, player, events } = await setup();
        await world.players.remove(player.id);
        const reloaded = defined(await world.players.get(player.id));
        const lifecycle = events.names().filter((name) => name === "playerUnload" || name === "playerLoad");
        assert.deepEqual(lifecycle, ["playerUnload", "playerLoad"]);
        assert.equal(events.of("playerUnload")[0]?.player, player);
        assert.equal(events.of("playerLoad")[0]?.player, reloaded);
    });

    it("emits playerDelete with the deleted player", async () => {
        const { world, player, events } = await setup();
        assert.equal(await world.players.delete(player.id), true);
        assert.equal(events.of("playerDelete")[0]?.player, player);
        assert.equal(events.of("playerDelete")[0]?.playerId, player.id);
    });
});

describe("Player progression", () => {
    it("emits playerExperienceGain and one playerLevelUp per level gained", async () => {
        const { player, events } = await setup();
        const result = player.addXP(400);
        assert.equal(result.isLeveledUp, true);
        const [gain] = events.of("playerExperienceGain");
        assert.equal(gain?.amount, 400);
        assert.equal(gain?.levelsGained, player.level - 1);
        assert.equal(gain?.experience, player.experience.current);
        const levels = events.of("playerLevelUp");
        assert.equal(levels.length, player.level - 1);
        assert.deepEqual(levels.map((payload) => payload.level), Array.from({ length: levels.length }, (_, index) => index + 2));
        assert.equal(levels.at(-1)?.player, player);
        assert.ok(events.names().indexOf("playerLevelUp") < events.names().indexOf("playerExperienceGain"), "level-ups come first, the summary last");
    });

    it("does not emit for a zero experience gain", async () => {
        const { player, events } = await setup();
        player.addXP(0);
        assert.equal(events.of("playerExperienceGain").length, 0);
    });

    it("emits playerGoldChange with previous, current and delta, for every wallet mutation", async () => {
        const { player, events } = await setup();
        const start = player.gold;
        player.gold += 40;
        player.gold -= 15;
        player.gold = player.gold;
        const changes = events.of("playerGoldChange");
        assert.equal(changes.length, 2, "an unchanged value emits nothing");
        assert.deepEqual(changes.map(({ previous, current, delta }) => [previous, current, delta]), [[start, start + 40, 40], [start + 40, start + 25, -15]]);
        assert.equal(changes[0]?.player, player);
    });

    it("emits playerAttributeUpgrade", async () => {
        const { player, events } = await setup();
        player.attributes.points = 2;
        const before = player.attributes.strength;
        player.levelUpSkill("strength");
        const [payload] = events.of("playerAttributeUpgrade");
        assert.equal(payload?.attribute, "strength");
        assert.equal(payload?.value, before + 1);
        assert.equal(payload?.remainingPoints, 1);
    });

    it("emits playerDamage with raw and mitigated damage", async () => {
        const { player, events } = await setup();
        const healthBefore = player.health.current;
        const result = defined(await player.takeDamage(20));
        const [payload] = events.of("playerDamage");
        assert.equal(payload?.rawDamage, 20);
        assert.equal(payload?.damage, result.reducedDamage);
        assert.equal(payload?.health, healthBefore - result.reducedDamage);
        assert.equal(payload?.maxHealth, player.health.max);
    });
});

describe("Death and revival", () => {
    it("cooldown: playerDeath carries respawnAt, then playerRevive on a manual revival", async () => {
        const { world, player, events } = await setup({ deathMode: "cooldown", deathCooldown: "60s" });
        await player.takeDamage(99999);
        const [death] = events.of("playerDeath");
        assert.equal(death?.mode, "cooldown");
        assert.equal(death?.player, player);
        assert.equal(death?.locationId, player.location);
        assert.equal(typeof death?.respawnAt, "number");
        assert.ok(events.names().indexOf("playerDamage") < events.names().indexOf("playerDeath"));

        await world.players.revive(player.id);
        const [revive] = events.of("playerRevive");
        assert.equal(revive?.reason, "manual");
        assert.equal(revive?.player, player);
        assert.equal(revive?.health, player.health.current);
    });

    it("loose: playerDeath reports the gold and the items lost", async (t) => {
        stubRandom(t, 0);
        const { player, events } = await setup({ deathMode: "loose", deathPenaltyRate: 10, deathItemLoss: { enabled: true, lossRates: { common: 100 } } });
        await player.inventory.add(fish, 4);
        const goldBefore = player.gold;
        await player.takeDamage(99999);
        const [death] = events.of("playerDeath");
        assert.equal(death?.mode, "loose");
        assert.equal(death?.lostGold, Math.floor(goldBefore * 0.1));
        assert.deepEqual(death?.lostItems?.map(({ itemId, quantity }) => [itemId, quantity]), [["evt_fish", 4]]);
    });

    it("hardcore: playerDeath is followed by playerDelete", async () => {
        const { player, events } = await setup({ deathMode: "hardcore" });
        await player.takeDamage(99999);
        const names = events.names();
        assert.ok(names.indexOf("playerDeath") < names.indexOf("playerDelete"));
        assert.equal(events.of("playerDeath")[0]?.mode, "hardcore");
        assert.equal(events.of("playerDelete")[0]?.player, player);
    });
});

describe("Travel", () => {
    it("emits travelStart then travelComplete with origin, destination and duration", async (t) => {
        stubRandom(t, 0.99);
        const { world, player, events } = await setup();
        const origin = player.location;
        const result = await travel(t, player, "Ironmill", 2, 1);
        assert.equal(result.arrived, true);
        const [start] = events.of("travelStart");
        const [complete] = events.of("travelComplete");
        assert.deepEqual([start?.fromId, start?.toId, start?.distance, start?.danger], [origin, "Ironmill", 2, 1]);
        assert.deepEqual([complete?.fromId, complete?.toId, complete?.distance], [origin, "Ironmill", 2]);
        assert.equal(complete?.durationMs, start?.durationMs);
        assert.equal(complete?.player, player);
        assert.equal(world.location.getStartingCityId(), origin);
        assert.equal(events.of("travelAmbush").length, 0);
    });

    it("emits travelAmbush (with the enemy and the combat) instead of travelComplete when ambushed", async (t) => {
        stubRandom(t, 0);
        const { world, player, events } = await setup();
        const result = await travel(t, player, "Ironmill", 1, 1);
        assert.equal(result.attacked, true);
        const [ambush] = events.of("travelAmbush");
        assert.equal(ambush?.enemy, result.enemy);
        assert.equal(ambush?.combat, world.combat.get(player.id));
        assert.equal(events.of("travelComplete").length, 0);
        assert.equal(events.of("combatStart")[0]?.combat, ambush?.combat, "the combat started first");
    });
});

describe("Combat", () => {
    it("emits combatStart, combatTurn, enemyDefeat then combatEnd (victory)", async () => {
        const { world, player, events } = await setup();
        fixAttributes(player);
        const enemy = makeEnemy({ health: 1 });
        const combat = world.combat.startWithEnemy(player, enemy);
        const result = await world.combat.attack(player.id);
        assert.equal(result.victory, true);

        const names = events.names().filter((name) => name.startsWith("combat") || name === "enemyDefeat");
        assert.deepEqual(names, ["combatStart", "enemyDefeat", "combatTurn", "combatEnd"]);
        const [defeat] = events.of("enemyDefeat");
        assert.equal(defeat?.enemy, enemy);
        assert.equal(defeat?.combat, combat);
        assert.equal(defeat?.player, player);
        assert.equal(defeat?.enemyType, enemy.type);
        assert.equal(defeat?.experience, enemy.experience);
        assert.equal(events.of("combatTurn")[0]?.result, result);
        assert.equal(events.of("combatEnd")[0]?.outcome, "victory");
        assertConsistent(events.all);
    });

    it("reports a defeat: damage, death and combatEnd with outcome defeat", async () => {
        const { world, player, events } = await setup({ deathMode: "cooldown" });
        player.health.current = 1;
        world.combat.startWithEnemy(player, makeEnemy({ strength: 500, health: 10_000 }));
        const result = await world.combat.attack(player.id);
        assert.equal(result.defeat, true);
        assert.equal(events.of("combatEnd")[0]?.outcome, "defeat");
        assert.equal(events.of("playerDeath").length, 1);
        assert.equal(events.of("combatTurn")[0]?.result.defeat, true);
    });

    it("reports an aborted outcome when all combats are stopped", async () => {
        const { world, player, events } = await setup();
        const combat = world.combat.startWithEnemy(player, makeEnemy());
        world.combat.stopAllCombats();
        const [end] = events.of("combatEnd");
        assert.equal(end?.outcome, "aborted");
        assert.equal(end?.combat, combat);
    });

    it("feeds the bestiary: enemyDefeat triggers bestiaryDiscover", async () => {
        const { world, player, events } = await setup();
        fixAttributes(player);
        world.combat.startWithEnemy(player, makeEnemy({ health: 1 }));
        await world.combat.attack(player.id);
        // Wildcard listeners run after the specific ones, so the discovery (emitted by a listener) is recorded first.
        assert.equal(events.of("enemyDefeat").length, 1);
        assert.equal(events.of("bestiaryDiscover").length, 1);
        assert.equal(events.of("bestiaryDiscover")[0]?.player, player);
    });
});

describe("Inventory", () => {
    it("emits itemAdd with the display name and the quantity added", async () => {
        const { player, events } = await setup();
        await player.inventory.add(fish, 3);
        await player.inventory.add(fish, 2);
        const adds = events.of("itemAdd").filter((payload) => payload.itemId === "evt_fish");
        assert.deepEqual(adds.map((payload) => [payload.name, payload.quantity]), [["Display evt_fish", 3], ["Display evt_fish", 2]]);
        assert.equal(adds[0]?.player, player);
    });

    it("emits itemRemove, and itemSell with the gold received", async () => {
        const { player, events } = await setup();
        await player.inventory.add(fish, 5);
        await player.inventory.remove("evt_fish", 1);
        assert.deepEqual(events.of("itemRemove").map((payload) => [payload.itemId, payload.quantity]), [["evt_fish", 1]]);

        const gold = await player.inventory.sellItem("evt_fish", 2);
        const [sale] = events.of("itemSell");
        assert.deepEqual([sale?.itemId, sale?.quantity, sale?.gold], ["evt_fish", 2, gold]);
    });

    it("emits itemEquip, and itemUnequip for the replaced item and for an explicit unequip", async () => {
        const { player, events } = await setup();
        await giveAndEquip(player, "sword", makeItem("blade_a", ItemCategory.Weapons));
        assert.deepEqual(events.of("itemEquip").map((payload) => [payload.itemId, payload.slot]), [["blade_a", "sword"]]);
        assert.equal(events.of("itemUnequip").length, 0);

        await giveAndEquip(player, "sword", makeItem("blade_b", ItemCategory.Weapons));
        assert.deepEqual(events.of("itemUnequip").map((payload) => payload.itemId), ["blade_a"], "replacing an item unequips the previous one");

        await player.inventory.unequip("sword");
        assert.deepEqual(events.of("itemUnequip").map((payload) => payload.itemId), ["blade_a", "blade_b"]);
    });

    it("does not emit when the operation fails", async () => {
        const { player, events } = await setup();
        assert.equal(await player.inventory.remove("ghost", 1), false);
        assert.equal(await player.inventory.equip("sword", "ghost"), false);
        assert.equal(events.of("itemRemove").length, 0);
        assert.equal(events.of("itemEquip").length, 0);
    });
});

describe("Banks", () => {
    it("emits bankUnlock, bankDeposit and bankWithdraw with the resulting balances", async () => {
        const { world, player, events } = await setup({ bankUnlockCost: 20 });
        assert.equal(world.bank.unlock(player), true);
        assert.equal(events.of("bankUnlock")[0]?.cost, 20);

        const wallet = player.gold;
        await world.bank.deposit(player, 50);
        const [deposit] = events.of("bankDeposit");
        assert.deepEqual([deposit?.amount, deposit?.wallet, deposit?.bankGold], [50, wallet - 50, 50]);

        await world.bank.withdraw(player, 30);
        const [withdraw] = events.of("bankWithdraw");
        assert.deepEqual([withdraw?.amount, withdraw?.wallet, withdraw?.bankGold], [30, wallet - 20, 20]);
        assert.equal(withdraw?.player, player);
    });

    it("emits nothing for a refused transaction", async () => {
        const { world, player, events } = await setup({ bankUnlockCost: 20 });
        await assert.rejects(world.bank.deposit(player, 10));
        assert.equal(events.of("bankDeposit").length, 0);
        assert.equal(world.bank.unlock(Object.assign(player, { gold: 0 })), false);
        assert.equal(events.of("bankUnlock").length, 0);
    });

    it("emits itemBankDeposit and itemBankWithdraw with the player", async () => {
        const { world, player, events } = await setup();
        world.bank.unlock(player);
        await player.inventory.add(fish, 6);
        await player.itemBank.deposit("evt_fish", 4);
        await player.itemBank.withdraw("evt_fish", 1);
        assert.deepEqual(events.of("itemBankDeposit").map((payload) => [payload.itemId, payload.quantity]), [["evt_fish", 4]]);
        assert.deepEqual(events.of("itemBankWithdraw").map((payload) => [payload.itemId, payload.quantity]), [["evt_fish", 1]]);
        assert.equal(events.of("itemBankDeposit")[0]?.player, player);
    });
});

describe("Jobs", () => {
    it("emits jobAction with the loot, then one jobLevelUp per level", async (t: TestContext) => {
        stubRandom(t, 0);
        const { player, events } = await setup();
        const result = await player.jobs.perform("evt_job", "catch");
        const [action] = events.of("jobAction");
        assert.deepEqual([action?.jobId, action?.actionId, action?.xpGained], ["evt_job", "catch", 25]);
        assert.deepEqual([action?.previousLevel, action?.level], [result.previousLevel, result.level]);
        assert.deepEqual(action?.loot, [{ itemId: "evt_fish", quantity: 2 }]);
        const ups = events.of("jobLevelUp");
        assert.equal(ups.length, result.level - result.previousLevel);
        assert.ok(ups.length >= 1, "25 XP crosses the first level (10 XP)");
        assert.deepEqual(ups.map((payload) => payload.level), Array.from({ length: ups.length }, (_, index) => result.previousLevel + index + 1));
        assert.equal(ups[0]?.player, player);
    });

    it("emits jobToolEquip and jobToolUnequip", async () => {
        const { player, events } = await setup();
        await player.inventory.add(rod, 1, createJobToolNbt("evt_job", {}));
        await player.jobs.equipTool("evt_job", "evt_rod");
        assert.deepEqual(events.of("jobToolEquip").map((payload) => [payload.jobId, payload.itemId]), [["evt_job", "evt_rod"]]);
        assert.equal(await player.jobs.unequipTool("evt_job"), true);
        assert.deepEqual(events.of("jobToolUnequip").map((payload) => [payload.jobId, payload.itemId]), [["evt_job", "evt_rod"]]);
        assert.equal(await player.jobs.unequipTool("evt_job"), false);
        assert.equal(events.of("jobToolUnequip").length, 1, "nothing emitted when no tool was equipped");
    });
});

describe("Titles and marriage", () => {
    const TITLE = { id: "evt_title", name: "Evt", rarity: TitleRarity.Common };

    it("emits titleGrant, titleEquip, titleUnequip and titleRevoke with the definition", async () => {
        const { player, events } = await setup({ customTitles: [TITLE] });
        assert.equal(await player.titles.grant("evt_title"), true);
        assert.equal(await player.titles.grant("evt_title"), false);
        await player.titles.equip("evt_title");
        assert.equal(await player.titles.unequip(), true);
        await player.titles.equip("evt_title");
        assert.equal(await player.titles.revoke("evt_title"), true);

        assert.equal(events.of("titleGrant").length, 1, "granting twice emits once");
        assert.equal(events.of("titleGrant")[0]?.title.id, "evt_title");
        assert.equal(events.of("titleEquip").length, 2);
        assert.equal(events.of("titleUnequip").length, 2, "an explicit unequip and the unequip caused by the revocation");
        assert.equal(events.of("titleRevoke")[0]?.player, player);
        const names = events.names().filter((name) => name.startsWith("title"));
        assert.deepEqual(names.slice(-2), ["titleUnequip", "titleRevoke"], "revoking an equipped title unequips it first");
    });

    it("emits marriageStart and marriageDivorce", async () => {
        const { world, player, events } = await setup();
        const partner = await spawn(world);
        player.marriage = new PlayerMarriage(player, undefined, databasePathOf(world));
        player.marriage.setPartner(partner.id);
        assert.deepEqual(events.of("marriageStart").map((payload) => payload.partnerId), [partner.id]);
        player.marriage.divorce();
        assert.deepEqual(events.of("marriageDivorce").map((payload) => payload.formerPartnerId), [partner.id]);
        assert.equal(events.of("marriageDivorce")[0]?.player, player);
    });
});

describe("Listeners and consistency", () => {
    it("lets a listener filter by domain through the typed names", async () => {
        const { world, player } = await setup();
        const seen: string[] = [];
        world.events.on("playerLevelUp", (payload) => { seen.push(`${payload.player.name}:${payload.level}`); });
        player.addXP(120);
        assert.deepEqual(seen, [`${player.name}:2`]);
    });

    it("keeps playerId and player.id consistent across a full session", async (t) => {
        stubRandom(t, 0.99);
        const { world, player, events } = await setup({ deathMode: "cooldown" });
        fixAttributes(player);
        await player.inventory.add(fish, 2);
        await player.inventory.sellItem("evt_fish", 1);
        world.combat.startWithEnemy(player, makeEnemy({ health: 1 }));
        await world.combat.attack(player.id);
        await player.jobs.perform("evt_job", "catch");
        await player.takeDamage(99999);
        await settle();
        assert.ok(events.all.length > 15, `recorded ${events.all.length} events`);
        assertConsistent(events.all);
    });

    it("a failing listener never prevents the action", async () => {
        const { world, player } = await setup();
        world.events.on("itemAdd", () => { throw new Error("boom"); });
        await assert.doesNotReject(player.inventory.add(fish, 1));
        assert.equal((await player.inventory.getItems()).some((record) => record.itemId === "evt_fish"), true);
    });
});
