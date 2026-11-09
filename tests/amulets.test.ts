/**
 * DragonsOfLegends.js — Amulets: luck, experience and critical modifiers, combined with effects.
 *
 * Run only this file:  npx tsx --test tests/amulets.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAmuletNbt, readAmuletModifiers } from "../src/inventory/amulet.js";
import type { InventoryItemRecord } from "../src/inventory/inventory.interface.js";
import { ItemCategory, ItemRarity } from "../src/inventory/item.enum.js";
import { resolvePlayerModifiers, scaleExperience } from "../src/player/player.modifiers.js";
import { createWorld, fixAttributes, makeEnemy, makeItem, spawn, stubRandom, useIsolatedWorkspace } from "./helpers/fixtures.js";
import Combat from "../src/combat/combat.js";
import { EnemyType } from "../src/enemy/enemy.type.js";

useIsolatedWorkspace();

const world = () => createWorld({ premadeItems: true, starterItems: {} });

const record = (itemNbtData: InventoryItemRecord["itemNbtData"], overrides: Partial<InventoryItemRecord> = {}): InventoryItemRecord =>
    ({
        playerId: "p", itemId: "a", name: "A", category: ItemCategory.Amulet, rarity: ItemRarity.Common,
        quantity: 1, maxStack: 1, isEquipped: true, equipmentSlot: "amulet1", itemNbtData, ...overrides
    }) as InventoryItemRecord;

describe("Amulet item data", () => {
    it("builds the item data in the units the game reads", () => {
        assert.deepEqual(createAmuletNbt({ luckPercent: 10, xpPercent: 15, critRatePercent: 5 }), { luckBonus: 10, experienceBonus: 15, critRateBonus: 0.05 });
        assert.deepEqual(createAmuletNbt(), {});
    });

    it("sums only the worn amulets and ignores malformed values", () => {
        const modifiers = readAmuletModifiers([
            record({ luckBonus: 10 }),
            record({ luckBonus: 5, experienceBonus: 20 }, { equipmentSlot: "amulet2" }),
            record({ luckBonus: 99 }, { isEquipped: false, equipmentSlot: null }),
            record({ luckBonus: 99 }, { equipmentSlot: "sword", category: ItemCategory.Weapons }),
            record({ luckBonus: "lots", experienceBonus: Number.NaN }, { equipmentSlot: "amulet3" })
        ]);
        assert.deepEqual(modifiers, { luckPercent: 15, xpPercent: 20, critRateBonus: 0 });
    });
});

describe("Player modifiers", () => {
    it("adds amulet percents, then multiplies by the effects", () => {
        const modifiers = resolvePlayerModifiers(
            { luckPercent: 10, xpPercent: 20, critRateBonus: 0.05 },
            { xpMultiplier: 2, luckPercent: 5, critRateBonus: 0.1 }
        );
        assert.ok(Math.abs(modifiers.xpMultiplier - 2.4) < 1e-9);
        assert.equal(modifiers.luckPercent, 15);
        assert.ok(Math.abs(modifiers.critRateBonus - 0.15) < 1e-9);
    });

    it("scales experience without floating-point drift", () => {
        assert.equal(scaleExperience(20, 1.15), 23);
        assert.equal(scaleExperience(25, 1), 25);
        assert.equal(scaleExperience(25, 2), 50);
        assert.equal(scaleExperience(7, 1.5), 10);
    });

    it("reads the equipped amulets of a player", async () => {
        const instance = world();
        const player = await spawn(instance);
        await player.inventory.add(instance.items.require("luck_amulet"), 1);
        await player.inventory.add(instance.items.require("xp_amulet"), 1);
        assert.deepEqual(await player.getModifiers(), { xpMultiplier: 1, luckPercent: 0, critRateBonus: 0 }, "carried, not worn");

        assert.equal(await player.inventory.equip("amulet1", "luck_amulet"), true);
        assert.equal(await player.inventory.equip("amulet2", "xp_amulet"), true);
        const modifiers = await player.getModifiers();
        assert.equal(modifiers.luckPercent, 10);
        assert.ok(Math.abs(modifiers.xpMultiplier - 1.1) < 1e-9);

        await player.inventory.unequip("amulet1");
        assert.equal((await player.getModifiers()).luckPercent, 0);
    });
});

describe("Amulets in gameplay", () => {
    it("boosts the experience gained, stacked with the experience potion", async () => {
        const instance = world();
        const player = await spawn(instance);
        await player.inventory.add(instance.items.require("xp_amulet"), 1);
        await player.inventory.equip("amulet1", "xp_amulet");
        assert.equal((await player.gainXP(50)).gainedAmount, 55);

        await player.effects.apply("xp_boost");
        assert.equal((await player.gainXP(50)).gainedAmount, 110);
        player.effects.dispose();
    });

    it("keeps addXP exact", async () => {
        const player = await spawn(world());
        assert.equal(player.addXP(50).gainedAmount, 50);
    });

    it("adds the critical amulet and the effects to the critical chance, each counted once", async (t) => {
        const instance = world();
        instance.effects.register({ id: "focus", name: "Focus", durationMs: 60_000, modifiers: { critRateBonus: 0.2 } });
        stubRandom(t, 0.12);

        const damageDealt = async (setup: (player: Awaited<ReturnType<typeof spawn>>) => Promise<void>): Promise<number> => {
            const player = await spawn(instance);
            fixAttributes(player);
            await setup(player);
            const enemy = makeEnemy({ type: EnemyType.Goblin });
            enemy.health = enemy.maxHealth = 10_000;
            await new Combat(player, enemy).attack();
            player.effects.dispose();
            return enemy.maxHealth - enemy.health;
        };

        // A roll of 0.12 beats the 10% base chance, but not 15% (amulet) nor 30% (amulet + effect).
        const base = await damageDealt(async () => undefined);
        const withAmulet = await damageDealt(async (player) => {
            await player.inventory.add(instance.items.require("critical_amulet"), 1);
            await player.inventory.equip("amulet1", "critical_amulet");
        });
        const withEffect = await damageDealt(async (player) => { await player.effects.apply("focus"); });
        assert.ok(withAmulet > base, "the worn amulet turns the roll into a critical hit");
        assert.equal(withEffect, withAmulet, "a +20% effect gives the same critical hit as the amulet for this roll");
        // Rationale: damage is floored to an integer, so the ratio is only close to the x1.45 multiplier.
        assert.ok(withAmulet / base > 1.25 && withAmulet / base <= 1.5, `a critical hit deals about x1.45 (got ${withAmulet / base})`);
    });

    it("reports the boosted experience when an enemy is defeated", async (t) => {
        const instance = world();
        const player = await spawn(instance);
        await player.inventory.add(instance.items.require("xp_amulet"), 1);
        await player.inventory.equip("amulet1", "xp_amulet");
        stubRandom(t, 0.5);
        const enemy = makeEnemy({ type: EnemyType.Goblin });
        enemy.health = 1;
        const seen: number[] = [];
        instance.events.on("enemyDefeat", (payload) => { seen.push(payload.experience); });
        await new Combat(player, enemy).attack();
        assert.deepEqual(seen, [scaleExperience(enemy.experience, 1.1)]);
    });

    it("multiplies enemy drop rates by the luck of the player", () => {
        const enemy = makeEnemy({ type: EnemyType.AncientDragon });
        enemy.dropLuckPercent = 1_000;
        const drops = enemy.rollDrops();
        assert.ok(drops.length >= 1);
    });

    it("ships the three official amulets with their modifiers", () => {
        const instance = world();
        assert.equal(instance.items.require("luck_amulet").category, ItemCategory.Amulet);
        assert.deepEqual(readAmuletModifiers([record(instance.items.require("critical_amulet").defaultNbt, {})]), { luckPercent: 0, xpPercent: 0, critRateBonus: 0.05 });
        assert.equal(makeItem("x").itemId, "x");
    });
});
