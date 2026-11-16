/**
 * DragonsOfLegends.js — Bank upgrades: progressive cost, gold ceiling, item slots, cancellation, persistence.
 *
 * Run only this file:  npx tsx --test tests/bank-upgrade.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as errors from "../src/types/error.js";
import { createWorld, spawn, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

const UPGRADES = { baseCost: 1000, costGrowth: 2, goldLimitPerLevel: 1000, slotsPerLevel: 5, maxLevel: 2 };

describe("Bank upgrade", () => {
    it("charges a growing price and raises the gold ceiling and the item slots", async () => {
        const world = createWorld({ bankMaxGoldLimit: 1000, bankUpgrades: UPGRADES });
        const player = await spawn(world);
        player.bankUnlocked = true;
        player.gold = 10_000;

        assert.equal(world.bank.getUpgradeCost(player), 1000);
        assert.equal(await world.bank.upgrade(player), true);
        assert.equal(player.gold, 9000);
        assert.equal(player.bankLevel, 1);
        assert.equal(world.bank.getGoldLimit(player), 2000);
        assert.equal(player.itemBank.getCapacity(), 45);

        assert.equal(world.bank.getUpgradeCost(player), 2000, "progressive cost");
        assert.equal(await world.bank.upgrade(player), true);
        assert.equal(player.gold, 7000);
        assert.equal(world.bank.getGoldLimit(player), 3000);
        assert.equal(player.itemBank.getCapacity(), 50);

        await world.bank.deposit(player, 3000); // allowed only thanks to the upgrades
        assert.equal(player.bankGold, 3000);
    });

    it("stops at the maximum level and refuses when the wallet is too poor or the bank locked", async () => {
        const world = createWorld({ bankUpgrades: { ...UPGRADES, maxLevel: 1 } });
        const player = await spawn(world);
        await assert.rejects(world.bank.upgrade(player), errors.BankLockedError);
        player.bankUnlocked = true;
        player.gold = 500;
        await assert.rejects(world.bank.upgrade(player), errors.InsufficientFundsError);
        player.gold = 5000;
        await world.bank.upgrade(player);
        await assert.rejects(world.bank.upgrade(player), errors.BankMaxLevelError);
        assert.equal(world.bank.getUpgradeCost(player), undefined);
    });

    it("can be cancelled by a bankUpgrade listener: nothing is charged", async () => {
        const world = createWorld({ bankUpgrades: UPGRADES });
        const player = await spawn(world);
        player.bankUnlocked = true;
        player.gold = 5000;
        world.events.on("bankUpgrade", (event) => {
            assert.equal(event.cost, 1000);
            event.cancel("maintenance");
        });
        assert.equal(await world.bank.upgrade(player), false);
        assert.equal(player.gold, 5000);
        assert.equal(player.bankLevel, 0);
    });

    it("persists the bank level", async () => {
        const world = createWorld({ bankUpgrades: UPGRADES });
        const player = await spawn(world);
        player.bankUnlocked = true;
        player.gold = 5000;
        await world.bank.upgrade(player);
        await world.players.save(player);
        const row = await world.players.get(player.id);
        assert.equal(row?.bankLevel, 1);
    });

    it("rejects an invalid configuration at world creation", () => {
        assert.throws(() => createWorld({ bankUpgrades: { costGrowth: 0.5 } }), errors.InvalidBankUpgradeConfigError);
    });
});
