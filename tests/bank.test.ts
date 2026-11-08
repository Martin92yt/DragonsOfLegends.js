/**
 * DragonsOfLegends.js — Bank: unlock, deposit, withdraw, limits and married pooling.
 *
 * Run only this file:  npx tsx --test tests/bank.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import PlayerMarriage from "../src/player/player.marriage.js";
import * as errors from "../src/types/error.js";
import { createWorld, spawn, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("Bank", () => {
    it("unlocks the account against the configured price", async () => {
        const world = createWorld({ bankUnlockCost: 100 });
        const player = await spawn(world);
        assert.equal(world.bank.unlock(player), true);
        assert.equal(player.bankUnlocked, true);
        assert.equal(player.gold, 50);
        assert.equal(world.bank.unlock(player), false, "already unlocked");
        assert.equal(player.gold, 50, "no second charge");
    });

    it("refuses to unlock without enough gold, and unlocks for free when the price is 0", async () => {
        const poor = await spawn(createWorld({ bankUnlockCost: 1000 }));
        assert.equal(poor.worldInstance.bank.unlock(poor), false);
        assert.equal(poor.bankUnlocked, false);
        assert.equal(poor.gold, 150);

        const free = createWorld({ bankUnlockCost: 0 });
        const player = await spawn(free);
        assert.equal(free.bank.unlock(player), true);
        assert.equal(player.gold, 150);
    });

    it("requires an unlocked account for every operation", async () => {
        const world = createWorld();
        const player = await spawn(world);
        await assert.rejects(world.bank.deposit(player, 10), errors.BankLockedError);
        await assert.rejects(world.bank.withdraw(player, 10), errors.BankLockedError);
        await assert.rejects(world.bank.solde(player), errors.BankLockedError);
    });

    it("deposits and withdraws", async () => {
        const world = createWorld();
        const player = await spawn(world);
        player.bankUnlocked = true;
        assert.deepEqual(await world.bank.deposit(player, 100), { balance: 100, success: true });
        assert.equal(player.gold, 50);
        assert.deepEqual(await world.bank.solde(player), { balance: 100, success: true });
        assert.deepEqual(await world.bank.withdraw(player, 40), { balance: 60, success: true });
        assert.equal(player.gold, 90);
        assert.equal(await world.bank.getBalanceTotal(player), 60);
    });

    it("validates amounts and funds", async () => {
        const world = createWorld();
        const player = await spawn(world);
        player.bankUnlocked = true;
        await assert.rejects(world.bank.deposit(player, 0), errors.InvalidAmountError);
        await assert.rejects(world.bank.deposit(player, -5), errors.InvalidAmountError);
        await assert.rejects(world.bank.withdraw(player, 0), errors.InvalidAmountError);
        await assert.rejects(world.bank.deposit(player, 151), errors.InsufficientFundsError);
        await assert.rejects(world.bank.withdraw(player, 1), errors.InsufficientFundsError);
    });

    it("enforces the deposit ceiling, doubled for married players", async () => {
        const world = createWorld({ bankMaxGoldLimit: 100 });
        const [a, b] = [await spawn(world), await spawn(world)];
        a.gold = 1000;
        a.bankUnlocked = true;
        await assert.rejects(world.bank.deposit(a, 101), /limit/i);
        assert.equal((await world.bank.deposit(a, 100)).balance, 100);

        a.marriage = new PlayerMarriage(a, b.id);
        assert.equal((await world.bank.deposit(a, 100)).balance, 200);
        await assert.rejects(world.bank.deposit(a, 1), /limit/i);
    });

    it("supports an unlimited ceiling (-1) for single players", async () => {
        const world = createWorld({ bankMaxGoldLimit: -1 });
        const player = await spawn(world);
        player.gold = 10_000_000;
        player.bankUnlocked = true;
        assert.equal((await world.bank.deposit(player, 10_000_000)).balance, 10_000_000);
    });

    it("supports an unlimited ceiling (-1) for married players", { todo: "C11 the doubled -1 sentinel becomes -2 and every deposit is rejected" }, async () => {
        const world = createWorld({ bankMaxGoldLimit: -1 });
        const [a, b] = [await spawn(world), await spawn(world)];
        a.bankUnlocked = true;
        a.marriage = new PlayerMarriage(a, b.id);
        await assert.doesNotReject(world.bank.deposit(a, 10));
    });

    it("signals a reached ceiling with a bank error", { todo: "C2 deposit() throws a bare Error instead of a BankError subclass" }, async () => {
        const world = createWorld({ bankMaxGoldLimit: 10 });
        const player = await spawn(world);
        player.bankUnlocked = true;
        await assert.rejects(world.bank.deposit(player, 11), errors.BankError);
    });

    it("pools the balance of married partners that both unlocked their bank", async () => {
        const world = createWorld();
        const [a, b] = [await spawn(world), await spawn(world)];
        a.marriage = new PlayerMarriage(a, b.id);
        a.bankUnlocked = true;
        b.bankUnlocked = true;
        a.bankGold = 100;
        b.bankGold = 400;
        assert.equal(await world.bank.getBalanceTotal(a), 500);
        assert.deepEqual(await world.bank.solde(a), { balance: 500, success: true });

        const startGold = a.gold;
        assert.deepEqual(await world.bank.withdraw(a, 300), { balance: 200, success: true });
        assert.equal(a.bankGold, 0, "own account is drained first");
        assert.equal(b.bankGold, 200, "the remainder comes from the partner");
        assert.equal(a.gold, startGold + 300);
    });

    it("ignores a partner whose bank is locked", async () => {
        const world = createWorld();
        const [a, b] = [await spawn(world), await spawn(world)];
        a.marriage = new PlayerMarriage(a, b.id);
        a.bankUnlocked = true;
        a.bankGold = 100;
        b.bankGold = 400;
        assert.equal(await world.bank.getBalanceTotal(a), 100);
        await assert.rejects(world.bank.withdraw(a, 150), errors.InsufficientFundsError);
    });

    it("ignores a married partner who no longer exists", async () => {
        const world = createWorld();
        const player = await spawn(world);
        player.marriage = new PlayerMarriage(player, "ghost-partner");
        player.bankUnlocked = true;
        player.bankGold = 25;
        assert.equal(await world.bank.getBalanceTotal(player), 25);
    });

    it("never duplicates gold on concurrent withdrawals", { todo: "C2 withdraw() checks the balance, awaits, then mutates (TOCTOU)" }, async () => {
        const world = createWorld();
        const player = await spawn(world);
        player.gold = 500;
        player.bankUnlocked = true;
        await world.bank.deposit(player, 500);
        const wealthBefore = player.gold + player.bankGold;
        await Promise.allSettled([world.bank.withdraw(player, 500), world.bank.withdraw(player, 500)]);
        assert.equal(player.gold + player.bankGold, wealthBefore);
    });

    it("closes without error", () => {
        assert.doesNotThrow(() => createWorld().bank.close());
    });
});
