/**
 * DragonsOfLegends.js — CombatManager and combat resolution.
 *
 * Run only this file:  npx tsx --test tests/combat.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import Combat from "../src/combat/combat.js";
import EnemyEntity from "../src/enemy/enemy.js";
import { EnemyType } from "../src/enemy/enemy.type.js";
import { ItemCategory } from "../src/inventory/item.enum.js";
import { PlayerClass } from "../src/player/player.class.js";
import * as errors from "../src/types/error.js";
import { createWorld, defined, findRecord, fixAttributes, giveAndEquip, makeEnemy, makeItem, NEUTRAL_RANDOM, spawn, stubRandom, totalQuantity, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("CombatManager", () => {
    it("starts a combat against a generated enemy", async () => {
        const world = createWorld();
        const player = await spawn(world);
        const combat = world.combat.start(player);
        assert.ok(combat instanceof Combat);
        assert.ok(combat.enemyEntity instanceof EnemyEntity);
        assert.equal(world.combat.has(player.id), true);
        assert.equal(world.combat.get(player.id), combat);
        assert.equal(world.combat.size, 1);
        assert.equal(player.inCombat, true);
        assert.equal(combat.isFinished(), false);
    });

    it("starts a combat against a chosen enemy", async () => {
        const world = createWorld();
        const player = await spawn(world);
        const enemy = makeEnemy();
        assert.equal(world.combat.startWithEnemy(player, enemy).enemyEntity, enemy);
    });

    it("refuses a second simultaneous combat, but accepts one after the first is over", async () => {
        const world = createWorld();
        const player = await spawn(world);
        const enemy = makeEnemy();
        world.combat.startWithEnemy(player, enemy);
        assert.throws(() => world.combat.start(player), errors.PlayerAlreadyInCombatError);
        enemy.takeDamage(100_000);
        assert.doesNotThrow(() => world.combat.startWithEnemy(player, makeEnemy()));
    });

    it("rejects attacks and lookups for players outside a combat", async () => {
        const world = createWorld();
        await assert.rejects(world.combat.attack("ghost"), errors.PlayerNotInCombatError);
        assert.equal(world.combat.get("ghost"), undefined);
        assert.equal(world.combat.has("ghost"), false);
    });

    it("clear removes a combat and resets the player flag", async () => {
        const world = createWorld();
        const player = await spawn(world);
        world.combat.start(player);
        assert.equal(world.combat.clear(player.id), true);
        assert.equal(world.combat.clear(player.id), false);
        assert.equal(player.inCombat, false);
        assert.equal(world.combat.size, 0);
    });

    it("stopAllCombats ends everything and compensates the players", async () => {
        const world = createWorld();
        const [a, b] = [await spawn(world), await spawn(world)];
        a.gold = 1000;
        world.combat.startWithEnemy(a, makeEnemy());
        world.combat.startWithEnemy(b, makeEnemy());
        world.combat.stopAllCombats();
        assert.equal(world.combat.size, 0);
        assert.equal(a.inCombat || b.inCombat, false);
        // Rationale: compensation is level * 5 XP and +0.5% gold (floored).
        assert.equal(a.experience.current, 5);
        assert.equal(a.gold, 1005);
    });
});

describe("Combat resolution", () => {
    it("resolves a standard exchange of blows", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        fixAttributes(player);
        world.combat.startWithEnemy(player, makeEnemy({ health: 100, strength: 5 }));
        stubRandom(t, NEUTRAL_RANDOM);
        const result = await world.combat.attack(player.id);
        // Rationale: warrior attacks with strength (10), roll offset is 0 at 0.5, no crit below 10%.
        assert.equal(result.enemyDamage, 10);
        assert.equal(result.enemyHealth, 90);
        assert.equal(result.playerDamage, 4);
        assert.equal(result.victory, false);
        assert.equal(result.defeat, false);
        assert.equal(world.combat.has(player.id), true);
    });

    it("rewards experience and gold on victory and closes the combat", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        fixAttributes(player);
        const enemy = makeEnemy({ health: 10, experience: 30, gold: 12 });
        world.combat.startWithEnemy(player, enemy);
        stubRandom(t, NEUTRAL_RANDOM);
        const result = await world.combat.attack(player.id);
        assert.equal(result.victory, true);
        assert.equal(result.defeat, false);
        assert.equal(result.enemyHealth, 0);
        assert.equal(result.playerDamage, 0);
        assert.equal(result.enemy, enemy);
        assert.equal(player.experience.current, 30);
        assert.equal(player.gold, 150 + 12 + 10, "combat gold + first-discovery bestiary gold (slime)");
        assert.equal(player.bestiary.isDiscovered(EnemyType.Slime), true);
        assert.equal(world.combat.has(player.id), false);
        assert.equal(player.inCombat, false);
    });

    it("emits enemyDefeat before resolving the victory", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        fixAttributes(player);
        const events: string[] = [];
        world.events.on("enemyDefeat", (payload) => { events.push(`${payload.playerId}:${payload.enemyType}:${payload.experience}:${payload.gold}`); });
        world.combat.startWithEnemy(player, makeEnemy({ health: 10, experience: 30, gold: 12 }));
        stubRandom(t, NEUTRAL_RANDOM);
        await world.combat.attack(player.id);
        assert.deepEqual(events, [`${player.id}:${EnemyType.Slime}:30:12`]);
    });

    it("reports a defeat, triggers the death mode and closes the combat", async () => {
        const world = createWorld();
        const player = await spawn(world);
        world.combat.startWithEnemy(player, makeEnemy({ health: 100_000, strength: 99_999 }));
        const result = await world.combat.attack(player.id);
        assert.equal(result.defeat, true);
        assert.equal(result.victory, false);
        assert.ok(result.playerDamage > 0);
        assert.equal(player.isAlive(), false);
        assert.equal(player.isDead, true);
        assert.equal(world.combat.has(player.id), false);
    });

    it("applies critical hits", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        fixAttributes(player);
        world.combat.startWithEnemy(player, makeEnemy({ health: 1000 }));
        stubRandom(t, 0);
        const result = await world.combat.attack(player.id);
        // Rationale: 10 * 0.92 (minimum variance) * 1.45 critical multiplier = 13.34 -> 13.
        assert.equal(result.enemyDamage, 13);
    });

    it("reduces the damage with the enemy defense (diminishing curve)", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        fixAttributes(player);
        world.combat.startWithEnemy(player, makeEnemy({ health: 1000, defense: 10 }));
        stubRandom(t, NEUTRAL_RANDOM);
        // factor = 100 / (100 + 10 * 2) = 0.833 -> floor(10 * 0.833) = 8.
        assert.equal((await world.combat.attack(player.id)).enemyDamage, 8);
    });

    it("uses the explorer's agility as attack stat", async (t) => {
        const world = createWorld();
        const player = await spawn(world, PlayerClass.Explorer);
        fixAttributes(player);
        world.combat.startWithEnemy(player, makeEnemy({ health: 100 }));
        stubRandom(t, NEUTRAL_RANDOM);
        assert.equal((await world.combat.attack(player.id)).enemyDamage, 8);
    });

    it("uses the rogue's agility as attack stat", async (t) => {
        const world = createWorld();
        const player = await spawn(world, PlayerClass.Rogue);
        player.attributes = { points: 0, strength: 5, agility: 10, intelligence: 4, defense: 4 };
        world.combat.startWithEnemy(player, makeEnemy({ health: 100 }));
        stubRandom(t, NEUTRAL_RANDOM);
        assert.equal((await world.combat.attack(player.id)).enemyDamage, 10);
    });

    it("adds flat weapon bonuses (and aliases) and wears the weapon down", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        fixAttributes(player);
        await giveAndEquip(player, "sword", makeItem("sabre", ItemCategory.Weapons), { damageBonus: 5, durability: 10 });
        world.combat.startWithEnemy(player, makeEnemy({ health: 1000 }));
        stubRandom(t, NEUTRAL_RANDOM);
        assert.equal((await world.combat.attack(player.id)).enemyDamage, 15);
        assert.equal((await findRecord(player, "sabre"))?.itemNbtData?.durability, 9);

        await player.inventory.unequip("sword");
        await giveAndEquip(player, "sword", makeItem("flat", ItemCategory.Weapons), { flatDamage: 7 });
        assert.equal((await world.combat.attack(player.id)).enemyDamage, 17);
    });

    it("applies percentage weapon bonuses", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        fixAttributes(player);
        await giveAndEquip(player, "sword", makeItem("fury", ItemCategory.Weapons), { damageBonusPercent: 100 });
        world.combat.startWithEnemy(player, makeEnemy({ health: 1000 }));
        stubRandom(t, NEUTRAL_RANDOM);
        // The Warrior's weapon affinity (+10%) amplifies the +100% bonus to +110%: 10 * 2.1.
        assert.equal((await world.combat.attack(player.id)).enemyDamage, 21);
    });

    it("raises the critical rate with weapon bonuses (and aliases), capped at 75%", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        fixAttributes(player);
        await giveAndEquip(player, "sword", makeItem("keen", ItemCategory.Weapons), { critRateBonus: 1 });
        world.combat.startWithEnemy(player, makeEnemy({ health: 1000 }));
        stubRandom(t, NEUTRAL_RANDOM);
        // Rationale: 0.5 < 0.75 cap -> critical; 10 * 1.45 = 14.5 -> 14.
        assert.equal((await world.combat.attack(player.id)).enemyDamage, 14);

        await player.inventory.unequip("sword");
        await giveAndEquip(player, "sword", makeItem("lucky", ItemCategory.Weapons), { critChance: 1 });
        assert.equal((await world.combat.attack(player.id)).enemyDamage, 14);
    });

    it("ignores bonuses of a broken weapon", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        fixAttributes(player);
        await giveAndEquip(player, "sword", makeItem("broken", ItemCategory.Weapons), { damageBonus: 1000, durability: 0 });
        world.combat.startWithEnemy(player, makeEnemy({ health: 100_000 }));
        stubRandom(t, NEUTRAL_RANDOM);
        assert.equal((await world.combat.attack(player.id)).enemyDamage, 10);
    });

    it("hands the enemy loot over to the winner", async (t) => {
        const world = createWorld();
        const player = await spawn(world);
        world.combat.startWithEnemy(player, makeEnemy({ type: EnemyType.Goblin, health: 1 }));
        stubRandom(t, 0);
        const result = await world.combat.attack(player.id);
        assert.equal(result.victory, true);
        assert.equal(await totalQuantity(player, "oreille_gobelin"), 1);
    });
});

describe("Class passives", () => {
    it("the Rogue crits harder and more often than a classless baseline", async (t) => {
        const world = createWorld();
        const rogue = await spawn(world, PlayerClass.Rogue);
        const passives = rogue.getClassPassives();
        assert.equal(passives.critRateBonus, 0.08);
        assert.equal(passives.critMultiplierBonus, 0.25);
        assert.equal(passives.jobXpPercent["enchanting"], 10);
    });

    it("the Warrior's armor affinity and defense passive reduce incoming damage", async () => {
        const world = createWorld();
        const warrior = await spawn(world, PlayerClass.Warrior);
        const explorer = await spawn(world, PlayerClass.Explorer);
        for (const p of [warrior, explorer]) { p.attributes.defense = 20; }
        const a = defined(await warrior.takeDamage(100));
        const b = defined(await explorer.takeDamage(100));
        assert.ok(a.reducedDamage < b.reducedDamage);
    });
});
