/**
 * DragonsOfLegends.js — EnemyEntity and EnemyManager.
 *
 * Run only this file:  npx tsx --test tests/enemy.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import EnemyEntity from "../src/enemy/enemy.js";
import EnemyManager from "../src/enemy/enemy.manager.js";
import { EnemyType } from "../src/enemy/enemy.type.js";
import { createWorld, makeEnemy, NEUTRAL_RANDOM, spawn, stubRandom, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("EnemyEntity", () => {
    it("mitigates damage with 40% of its defense and inflicts at least 1", () => {
        const enemy = makeEnemy({ health: 50, defense: 10 });
        // Rationale: floor(10 * 0.4) = 4 points of mitigation.
        assert.equal(enemy.takeDamage(10), 6);
        assert.equal(enemy.health, 44);
        assert.equal(enemy.takeDamage(1), 1);
    });

    it("ignores negative damage and never drops below zero", () => {
        const enemy = makeEnemy({ health: 10 });
        assert.equal(enemy.takeDamage(-5), 0);
        assert.equal(enemy.health, 10);
        enemy.takeDamage(10_000);
        assert.equal(enemy.health, 0);
        assert.equal(enemy.isAlive(), false);
    });

    it("rolls its loot exactly once, at the moment of death", (t) => {
        stubRandom(t, 0);
        const enemy = makeEnemy({ type: EnemyType.Goblin, health: 5 });
        assert.equal(enemy.droppedLootList.length, 0);
        enemy.takeDamage(100);
        const firstRoll = enemy.droppedLootList;
        assert.equal(firstRoll.length, 3);
        assert.ok(firstRoll.every((drop) => drop.quantity === drop.loot.minQuantity));
        enemy.takeDamage(100);
        assert.equal(enemy.droppedLootList, firstRoll);
    });

    it("heals within bounds and ignores negative amounts", () => {
        const enemy = makeEnemy({ health: 50 });
        enemy.takeDamage(40);
        assert.equal(enemy.heal(20), 30);
        assert.equal(enemy.heal(500), 50);
        assert.equal(enemy.heal(-5), 50);
    });

    it("resets health and loot", (t) => {
        stubRandom(t, 0);
        const enemy = makeEnemy({ type: EnemyType.Wolf, health: 10 });
        enemy.takeDamage(100);
        assert.ok(enemy.droppedLootList.length > 0);
        assert.equal(enemy.resetHealth(), 10);
        assert.deepEqual(enemy.droppedLootList, []);
        enemy.takeDamage(100);
        assert.ok(enemy.droppedLootList.length > 0, "loot can drop again after a reset");
    });

    it("exposes its health ratio", () => {
        const enemy = makeEnemy({ health: 50 });
        enemy.takeDamage(25);
        assert.equal(enemy.healthRatio, 0.5);
        assert.equal(new EnemyEntity(EnemyType.Slime, "Broken", 0, 0, 1, 0, 1, 1).healthRatio, 0);
    });

    it("rolls drops by rate and quantity", (t) => {
        // Rationale: one roll per loot entry (rate check), plus one extra roll per entry that drops (quantity).
        stubRandom(t, [0, 0.999, 0.99, 0.99]);
        const drops = makeEnemy({ type: EnemyType.AncientDragon }).rollDrops();
        assert.equal(drops.length, 1);
        assert.equal(drops[0].loot.itemId, "ecailles_dragon");
        assert.equal(drops[0].quantity, 5);
    });

    it("drops nothing when every roll fails", (t) => {
        stubRandom(t, 0.99999);
        assert.deepEqual(makeEnemy({ type: EnemyType.Goblin }).rollDrops(), []);
    });

    it("has a loot table for every enemy type and none for unknown ones", (t) => {
        stubRandom(t, 0);
        for (const type of Object.values(EnemyType)) {
            assert.ok(makeEnemy({ type }).rollDrops().length >= 2, `loot table for ${type}`);
        }
        assert.deepEqual(makeEnemy({ type: "ufo" as unknown as EnemyType }).rollDrops(), []);
    });
});

describe("EnemyManager", () => {
    it("creates every enemy type with its base stats at level 1", (t) => {
        stubRandom(t, NEUTRAL_RANDOM);
        const manager = new EnemyManager();
        for (const type of Object.values(EnemyType)) {
            const enemy = manager.createOfType(type);
            assert.equal(enemy.type, type);
            assert.notEqual(enemy.name, "Unknown Enemy");
            assert.equal(enemy.health, enemy.maxHealth);
            assert.ok(enemy.health >= 1 && enemy.strength >= 1 && enemy.experience >= 1 && enemy.gold >= 1);
        }
        const goblin = manager.createOfType(EnemyType.Goblin);
        assert.deepEqual(
            [goblin.name, goblin.health, goblin.strength, goblin.defense, goblin.experience, goblin.gold],
            ["Goblin", 50, 6, 2, 25, 8]
        );
    });

    it("scales stats with the player level", (t) => {
        stubRandom(t, NEUTRAL_RANDOM);
        const manager = new EnemyManager();
        const base = manager.createOfType(EnemyType.Goblin, 1);
        const scaled = manager.createOfType(EnemyType.Goblin, 11);
        // Rationale: multiplier = 1 + (level - 1) * 0.09 = 1.9 at level 11.
        assert.ok(Math.abs(scaled.health / base.health - 1.9) < 0.05);
        assert.ok(scaled.strength > base.strength && scaled.experience > base.experience && scaled.gold > base.gold);
    });

    it("spawns elites with boosted stats and a distinctive name", (t) => {
        stubRandom(t, 0);
        const elite = new EnemyManager().createOfType(EnemyType.Goblin, 1);
        assert.match(elite.name, /^★ Goblin \(Elite\)$/);
        assert.ok(elite.health >= 59);
        assert.ok(elite.experience > 25 * 0.85);
    });

    it("falls back to a generic enemy for unknown types", () => {
        const enemy = new EnemyManager().createOfType("ufo" as unknown as EnemyType);
        assert.equal(enemy.name, "Unknown Enemy");
        assert.equal(enemy.health, 50);
    });

    it("picks the tier from the player level (low roll)", async (t) => {
        const player = await spawn(createWorld());
        stubRandom(t, NEUTRAL_RANDOM);
        const manager = new EnemyManager();
        const typeAt = (level: number): string => {
            player.level = level;
            return manager.create(player).type;
        };
        assert.equal(typeAt(1), EnemyType.Slime);
        assert.equal(typeAt(3), EnemyType.Orc);
        assert.equal(typeAt(6), EnemyType.Vampire);
    });

    it("picks the tier from the player level (high roll)", async (t) => {
        const player = await spawn(createWorld());
        stubRandom(t, 0.95);
        const manager = new EnemyManager();
        const typeAt = (level: number): string => {
            player.level = level;
            return manager.create(player).type;
        };
        assert.equal(typeAt(1), EnemyType.Zombie);
        assert.equal(typeAt(3), EnemyType.StoneGolem);
        assert.equal(typeAt(10), EnemyType.Hydra);
        assert.equal(typeAt(0), EnemyType.WildBoar, "invalid levels use the beginner pool");
    });
});
