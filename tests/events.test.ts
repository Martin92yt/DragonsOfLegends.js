/**
 * DragonsOfLegends.js — Event engine (typed emitter, priorities, filters, waitFor, error isolation).
 *
 * Run only this file:  npx tsx --test tests/events.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EventEngine, EventTimeoutError, type GameEventEngine } from "../src/index.js";
import { fakeEvents } from "./helpers/fixtures.js";

describe("EventEngine", () => {
    it("delivers by priority, filter and once; unsubscribes", () => {
        const e: GameEventEngine = new EventEngine();
        const seen: string[] = [];
        e.on("playerLevelUp", () => { seen.push("low"); }, { priority: -1 });
        e.on("playerLevelUp", () => { seen.push("high"); }, { priority: 5 });
        e.on("playerLevelUp", () => { seen.push("once"); }, { once: true });
        const off = e.on("playerLevelUp", () => { seen.push("filtered"); }, { filter: (p) => p.level > 5 });
        assert.equal(e.emit("playerLevelUp", fakeEvents.playerLevelUp("a", 1, 2)), 3);
        assert.deepEqual(seen, ["high", "once", "low"]);
        off();
        e.emit("playerLevelUp", fakeEvents.playerLevelUp("a", 5, 6));
        assert.equal(e.listenerCount("playerLevelUp"), 2);
    });
    it("isolates listener errors (sync and async)", async () => {
        const errors: string[] = [];
        const e = new EventEngine<{ x: { n: number } }>({ onError: (er) => errors.push(er.eventName) });
        let ok = 0;
        e.on("x", () => { throw new Error("boom"); });
        e.on("x", async () => { throw new Error("async boom"); });
        e.on("x", () => { ok++; });
        e.emit("x", { n: 1 });
        await new Promise((r) => setImmediate(r));
        assert.equal(ok, 1);
        assert.deepEqual(errors, ["x", "x"]);
    });
    it("emitAsync awaits, onAny sees everything, waitFor resolves/times out", async () => {
        const e = new EventEngine<{ x: { n: number }; y: { s: string } }>();
        const order: string[] = [];
        e.on("x", async () => { await new Promise((r) => setTimeout(r, 5)); order.push("a"); });
        e.on("x", () => { order.push("b"); });
        const names: string[] = [];
        e.onAny(({ name }) => { names.push(String(name)); });
        await e.emitAsync("x", { n: 1 });
        assert.deepEqual(order, ["a", "b"]);
        const pending = e.waitFor("y", { filter: (p) => p.s === "go" });
        e.emit("y", { s: "no" }); e.emit("y", { s: "go" });
        assert.deepEqual(await pending, { s: "go" });
        await assert.rejects(e.waitFor("y", { timeoutMs: 5 }), EventTimeoutError);
        assert.deepEqual(names, ["x", "y", "y"]);
        assert.equal(e.listenerCount("y"), 0);
    });
    it("survives unsubscribe during emit", () => {
        const e = new EventEngine<{ x: { n: number } }>();
        let calls = 0;
        const off = e.on("x", () => { calls++; off(); });
        e.on("x", () => { calls++; });
        e.emit("x", { n: 1 }); e.emit("x", { n: 2 });
        assert.equal(calls, 3);
    });
});
