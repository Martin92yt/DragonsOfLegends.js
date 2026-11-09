/**
 * DragonsOfLegends.js — PlayerEntity: construction, progression, damage and travel.
 *
 * Run only this file:  npx tsx --test tests/player.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EnemyType } from "../src/enemy/enemy.type.js";
import { ItemCategory, ItemRarity } from "../src/inventory/item.enum.js";
import { PlayerClass } from "../src/player/player.class.js";
import PlayerEntity from "../src/player/player.entity.js";
import * as errors from "../src/types/error.js";
import { createWorld, defined, findRecord, fixAttributes, giveAndEquip, makeItem, NEUTRAL_RANDOM, settle, spawn, stubRandom, travel, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("PlayerEntity construction", () => {
    it("generates the documented base stats per class", async (t) => {
        stubRandom(t, NEUTRAL_RANDOM);
        const world = createWorld();
        const warrior = await spawn(world, PlayerClass.Warrior);
        const explorer = await spawn(world, PlayerClass.Explorer);
        const rogue = await spawn(world, PlayerClass.Rogue);
        assert.deepEqual(warrior.attributes, { points: 0, strength: 10, agility: 4, intelligence: 3, defense: 8 });
        assert.deepEqual(explorer.attributes, { points: 0, strength: 6, agility: 8, intelligence: 6, defense: 5 });
        assert.deepEqual(rogue.attributes, { points: 0, strength: 5, agility: 10, intelligence: 4, defense: 4 });
    });

    it("randomises base stats within +/-10%", async (t) => {
        stubRandom(t, 0);
        const low = await spawn(createWorld(), PlayerClass.Warrior);
        t.mock.restoreAll();
        stubRandom(t, 0.999);
        const high = await spawn(createWorld(), PlayerClass.Warrior);
        assert.equal(low.attributes.strength, 9);
        assert.equal(high.attributes.strength, 11);
    });

    it("clamps invalid constructor values", async () => {
        const world = createWorld();
        const player = new PlayerEntity(world, "clamp-1", "Clamp", PlayerClass.Warrior, "Embercross", -5, -10, 50, 40, "", -100, -50, true, 7, 7, 7, 7, -3);
        await settle();
        assert.equal(player.level, 1);
        assert.equal(player.experience.current, 0);
        assert.equal(player.gold, 0);
        assert.equal(player.bankGold, 0);
        assert.equal(player.bankUnlocked, true);
        assert.equal(player.attributes.points, 0);
        assert.equal(player.attributes.strength, 7);
        assert.equal(player.experience.required, 110);
    });

    it("rejects unknown classes", () => {
        assert.throws(
            () => new PlayerEntity(createWorld(), "bad-class", "Bad", "mage" as unknown as PlayerClass, "Embercross"),
            errors.UnknownPlayerClassError
        );
    });

    it("computes maximum health from base value and level", async () => {
        const player = await spawn(createWorld());
        // Rationale: BASE_HEALTH (85) + level (1) * HP_PER_LEVEL (9).
        assert.deepEqual(player.health, { current: 94, max: 94 });
        player.level = 5;
        await player.updateMaxHealth();
        assert.equal(player.health.max, 85 + 5 * 9);
    });

    it("adds equipped healthBonus items to the maximum health", async () => {
        const player = await spawn(createWorld());
        await giveAndEquip(player, "helmet", makeItem("hp_helm", ItemCategory.Armor), { healthBonus: 20 });
        assert.equal(player.health.max, 94 + 20);
        await player.inventory.unequip("helmet");
        await settle();
        assert.equal(player.health.max, 94);
        assert.equal(player.health.current <= player.health.max, true);
    });

    it("serialises to a detached snapshot", async () => {
        const player = await spawn(createWorld());
        const snapshot = player.toJSON();
        assert.deepEqual(Object.keys(snapshot).sort(), ["attributes", "classId", "experience", "gold", "health", "id", "level", "locationId", "name", "title"]);
        snapshot.health.current = 1;
        snapshot.attributes.strength = 999;
        assert.notEqual(player.health.current, 1);
        assert.notEqual(player.attributes.strength, 999);
        assert.equal(snapshot.locationId, player.location);
    });
});

describe("PlayerEntity progression", () => {
    it("accumulates experience below the level threshold", async () => {
        const player = await spawn(createWorld());
        assert.deepEqual(player.addXP(50), { gainedAmount: 50, totalExperience: 50, isLeveledUp: false, currentLevel: 1 });
        assert.equal(player.experience.current, 50);
    });

    it("ignores zero and negative experience", async () => {
        const player = await spawn(createWorld());
        for (const amount of [0, -20]) {
            assert.deepEqual(player.addXP(amount), { gainedAmount: 0, totalExperience: 0, isLeveledUp: false, currentLevel: 1 });
        }
    });

    it("levels up, grants attributes and raises the requirement", async (t) => {
        stubRandom(t, NEUTRAL_RANDOM);
        const player = await spawn(createWorld());
        const result = player.addXP(110);
        await settle();
        assert.deepEqual(result, { gainedAmount: 110, totalExperience: 0, isLeveledUp: true, currentLevel: 2 });
        assert.equal(player.experience.required, 220);
        assert.deepEqual(player.attributes, { points: 1, strength: 11, agility: 5, intelligence: 4, defense: 9 });
        assert.equal(player.health.max, 85 + 2 * 9);
    });

    it("chains several level-ups from a single gain and keeps the remainder", async () => {
        const player = await spawn(createWorld());
        const result = player.addXP(110 + 220 + 7);
        await settle();
        assert.equal(result.currentLevel, 3);
        assert.equal(result.totalExperience, 7);
        assert.equal(player.attributes.points, 2);
    });

    it("heals the player completely on level-up", async () => {
        const player = await spawn(createWorld());
        player.addXP(110);
        await settle();
        assert.equal(player.health.current, player.health.max);
    });

    it("spends attribute points", async () => {
        const player = await spawn(createWorld());
        player.addXP(110);
        await settle();
        const before = player.attributes.strength;
        player.levelUpSkill("strength");
        assert.equal(player.attributes.strength, before + 1);
        assert.equal(player.attributes.points, 0);
    });

    it("refuses to spend points it does not have", async () => {
        const player = await spawn(createWorld());
        assert.throws(() => player.levelUpSkill("defense"), errors.NoAttributePointsError);
    });
});

describe("PlayerEntity damage", () => {
    it("mitigates damage with the defense attribute", async () => {
        const player = await spawn(createWorld());
        fixAttributes(player);
        // Rationale: defense 8 -> 100 / (100 + 8 * 2.5) = 0.8333 -> 100 raw damage becomes floor(83.33) = 83.
        const result = defined(await player.takeDamage(100));
        assert.equal(result.rawDamage, 100);
        assert.equal(result.reducedDamage, 83);
        assert.equal(result.currentHealth, 94 - 83);
        assert.equal(result.death, undefined);
        assert.equal(player.isAlive(), true);
    });

    it("always inflicts at least one damage point", async () => {
        const player = await spawn(createWorld());
        fixAttributes(player);
        assert.equal(defined(await player.takeDamage(1)).reducedDamage, 1);
    });

    it("ignores non-positive damage and damage on a dead player", async () => {
        const player = await spawn(createWorld());
        assert.equal(await player.takeDamage(0), null);
        assert.equal(await player.takeDamage(-5), null);
        await player.takeDamage(99999);
        assert.equal(await player.takeDamage(10), null);
    });

    it("applies equipped armor defense bonuses", async () => {
        const player = await spawn(createWorld());
        fixAttributes(player);
        await giveAndEquip(player, "chest", makeItem("plate", ItemCategory.Armor, ItemRarity.Epic, 1), { defenseBonus: 500, durability: 100 });
        const result = defined(await player.takeDamage(100));
        assert.ok(result.reducedDamage < 20, `expected heavy mitigation, got ${result.reducedDamage}`);
    });

    it("wears equipped armor down when it absorbs damage", async () => {
        const player = await spawn(createWorld());
        await giveAndEquip(player, "chest", makeItem("plate", ItemCategory.Armor, ItemRarity.Common, 1), { defenseBonus: 5, durability: 100 });
        await player.takeDamage(50);
        const durability = (await findRecord(player, "plate"))?.itemNbtData?.durability;
        assert.ok(typeof durability === "number" && durability < 100);
    });
});

describe("PlayerEntity travel", () => {
    it("arrives at the destination when no ambush happens", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        stubRandom(t, 0.99);
        const result = await travel(t, player, "Embercross", 2, 1);
        assert.equal(result.arrived, true);
        assert.equal(result.attacked, false);
        assert.equal(result.locationId, "Embercross");
        assert.equal(player.location, "Embercross");
        assert.equal(player.isTravelling, false);
        assert.ok(result.travelDurationMs >= 1000 + 2 * 900 && result.travelDurationMs < 1000 + 1500 + 2 * 900);
    });

    it("flags the player as travelling and refuses concurrent trips", async (t) => {
        const player = await spawn(createWorld());
        stubRandom(t, 0.99);
        t.mock.timers.enable({ apis: ["setTimeout"] });
        const pending = player.moveTo("Ironmill");
        assert.equal(player.isTravelling, true);
        await assert.rejects(player.moveTo("Cang"), errors.PlayerAlreadyTravellingError);
        t.mock.timers.tick(60_000);
        await pending;
        assert.equal(player.isTravelling, false);
    });

    it("refuses to move during a combat", async () => {
        const player = await spawn(createWorld());
        player.inCombat = true;
        await assert.rejects(player.moveTo("Ironmill"), errors.MoveInCombatError);
        assert.equal(player.isTravelling, false);
    });

    it("starts a combat against a land enemy on ambush", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        stubRandom(t, 0);
        const result = await travel(t, player, "Embercross", 1, 1);
        const enemy = defined(result.enemy);
        assert.equal(result.arrived, false);
        assert.equal(result.attacked, true);
        assert.equal(result.locationId, "Embercross");
        assert.equal(result.travelDurationMs, 950);
        assert.equal(enemy.type, EnemyType.Slime);
        assert.equal(enemy.health, 37);
        assert.equal(enemy.experience, 8);
        assert.equal(enemy.gold, 6);
        assert.equal(world.combat.has(player.id), true);
        assert.equal(player.inCombat, true);
        assert.equal(player.isTravelling, false);
    });

    it("spawns aquatic enemies for water destinations", async (t) => {
        const player = await spawn(createWorld());
        stubRandom(t, 0);
        const result = await travel(t, player, "Deep Coast");
        assert.equal(defined(result.enemy).type, EnemyType.Hydra);
    });

    it("does not treat 'Palace Of Stars' as a water area", async (t) => {
        const player = await spawn(createWorld());
        stubRandom(t, 0);
        const result = await travel(t, player, "Palace Of Stars");
        assert.ok(![EnemyType.Hydra, EnemyType.GiantRat].map(String).includes(defined(result.enemy).type));
    });

    it("rejects destinations that do not exist in the world graph", async (t) => {
        const player = await spawn(createWorld());
        stubRandom(t, 0.99);
        t.mock.timers.enable({ apis: ["setTimeout"] });
        const pending = player.moveTo("Nowhere", 1, 1);
        t.mock.timers.tick(60_000);
        await assert.rejects(pending);
    });
});
