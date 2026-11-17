/**
 * DragonsOfLegends.js — Balance: the pure formulas and the mechanics they drive.
 *
 * Run only this file:  npx tsx --test tests/balance.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_BALANCE, resolveBalance } from "../src/balance/balance.js";
import {
    criticalMultiplier, criticalRate, defenseFactor, dodgeRate, enemyDefenseScale, enemyScale, experienceRequired,
    healthGainForLevel, intelligenceResistance, penetrate, resistanceFactor
} from "../src/balance/formulas.js";
import EnemyEntity from "../src/enemy/enemy.js";
import { createWorld, spawn, stubRandom, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();
const B = DEFAULT_BALANCE;
const close = (actual: number, expected: number): void => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

describe("Pure formulas", () => {
    it("critical chance grows with agility and is capped", () => {
        close(criticalRate(B, 0, 0), 0.1);
        close(criticalRate(B, 10, 0.05), 0.1 + 0.02 + 0.05);
        close(criticalRate(B, 10_000, 0), 0.75);
        close(criticalMultiplier(B, 0.25), 1.7);
        close(criticalMultiplier(B, 99), 3);
    });

    it("defense has diminishing returns and never absorbs more than 85%", () => {
        close(defenseFactor(B, 0, 2), 1);
        close(defenseFactor(B, 10, 2), 100 / 120);
        // Diminishing returns: the same 10 points protect less and less.
        assert.ok(defenseFactor(B, 10, 2.5) - defenseFactor(B, 20, 2.5) > defenseFactor(B, 110, 2.5) - defenseFactor(B, 120, 2.5));
        close(defenseFactor(B, 1_000_000, 2.5), 0.15);
    });

    it("penetration lowers the defense, capped at 80%", () => {
        close(penetrate(B, 100, 25), 75);
        close(penetrate(B, 100, 500), 20);
    });

    it("resistances reduce, weaknesses amplify, both bounded", () => {
        close(resistanceFactor(B, 50), 0.5);
        close(resistanceFactor(B, -50), 1.5);
        close(resistanceFactor(B, 500), 0.25);
        close(resistanceFactor(B, -500), 2);
        close(intelligenceResistance(B, 10), 4);
    });

    it("dodge grows with agility and is capped at 30%", () => {
        close(dodgeRate(B, 10, 0), 0.03);
        close(dodgeRate(B, 10_000, 0), 0.3);
    });

    it("progression curves", () => {
        assert.equal(experienceRequired(B, 1), 110);
        assert.equal(experienceRequired(B, 2), 244);
        assert.ok(experienceRequired(B, 50) > 50 * 110, "superlinear");
        assert.equal(healthGainForLevel(B, 9), 9);
        assert.equal(healthGainForLevel(B, 10), 14);
        close(enemyScale(B, 11), 2.2);
        close(enemyDefenseScale(B, 11), 1.6);
    });

    it("validates the balance option", () => {
        assert.equal(resolveBalance({ critical: { maxRate: 0.5 } }).critical.maxRate, 0.5);
        assert.throws(() => resolveBalance({ defense: { maxMitigation: 1 } }), RangeError);
        assert.throws(() => resolveBalance({ damage: { varianceMin: 2, varianceMax: 1 } }), RangeError);
        assert.throws(() => createWorld({ balance: { progression: { xpExponent: 0.5 } } }), RangeError);
    });
});

describe("Enemies: damage types, resistances, penetration", () => {
    it("applies resistances and weaknesses of the damage type, and ignores defense for non-physical damage", () => {
        const make = (): EnemyEntity => new EnemyEntity("slime", "Slime", 1000, 1000, 5, 50, 1, 1, [], "beginner", { fire: 50, ice: -50 });
        assert.equal(make().takeDamage(100, { damageType: "fire" }), 50);
        assert.equal(make().takeDamage(100, { damageType: "ice" }), 150);
        // Physical: factor 100 / (100 + 50 * 2) = 0.5.
        assert.equal(make().takeDamage(100), 50);
    });

    it("armor penetration cuts through the enemy defense", () => {
        const make = (): EnemyEntity => new EnemyEntity("slime", "Slime", 1000, 1000, 5, 50, 1, 1);
        assert.ok(make().takeDamage(100, { armorPenetration: 50 }) > make().takeDamage(100));
    });
});

describe("Player: dodge, resistances, class growth", () => {
    it("a dodgeable blow can be dodged, an ordinary one cannot", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        const before = player.health.current;
        stubRandom(t, 0);
        const dodged = await player.takeDamage(10, { dodgeable: true });
        assert.equal(dodged?.dodged, true);
        assert.equal(player.health.current, before);
        const hit = await player.takeDamage(10);
        assert.ok((hit?.reducedDamage ?? 0) > 0);
    });

    it("intelligence resists magic but not physical damage; defense is the opposite", async () => {
        const world = createWorld();
        const player = await spawn(world);
        player.attributes.intelligence = 100; // 40% resistance
        player.attributes.defense = 0;
        const magic = await player.takeDamage(100, { damageType: "magic" });
        assert.equal(magic?.reducedDamage, 60);
        player.health.current = player.health.max;
        const physical = await player.takeDamage(100);
        assert.equal(physical?.reducedDamage, 100);
    });

    it("each class levels up differently", async () => {
        const world = createWorld();
        const rogue = await spawn(world, "rogue" as never);
        const before = { ...rogue.attributes };
        rogue.addXP(110);
        assert.equal(rogue.attributes.agility - before.agility, 2);
        assert.equal(rogue.attributes.defense - before.defense, 0);
    });
});
