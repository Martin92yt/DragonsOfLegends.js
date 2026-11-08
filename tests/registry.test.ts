/**
 * DragonsOfLegends.js — Generic Registry (the foundation of every extensible content kind).
 *
 * Run only this file:  npx tsx --test tests/registry.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import Registry, { type RegistryChange } from "../src/registry/registry.js";
import JobManager from "../src/jobs/job.manager.js";
import TitleManager from "../src/title/title.manager.js";
import { TitleRarity } from "../src/title/title.types.js";
import * as errors from "../src/types/error.js";
import { useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

interface Widget {
    readonly id: string;
    readonly label: string;
    readonly rank?: number;
}

const widget = (id: string, label = id, rank?: number): Widget => (rank === undefined ? { id, label } : { id, label, rank });

function createRegistry(extra: Partial<ConstructorParameters<typeof Registry<Widget>>[0]> = {}): Registry<Widget> {
    return new Registry<Widget>({
        kind: "widget",
        idOf: (entry) => entry.id,
        validate: (entry) => {
            if (entry.label === "") throw new errors.InvalidRegistryEntryError("widget", "empty label");
        },
        ...extra
    });
}

describe("Registry", () => {
    it("registers, reads, lists and counts entries", () => {
        const registry = createRegistry();
        assert.equal(registry.kind, "widget");
        assert.equal(registry.size, 0);
        registry.register(widget("a"));
        registry.bulkRegister([widget("b"), widget("c")]);
        assert.equal(registry.size, 3);
        assert.equal(registry.has("b"), true);
        assert.equal(registry.get("c")?.label, "c");
        assert.equal(registry.get("zzz"), undefined);
        assert.deepEqual(registry.ids(), ["a", "b", "c"]);
        assert.deepEqual(registry.list().map((entry) => entry.id), ["a", "b", "c"]);
        assert.deepEqual([...registry].map((entry) => entry.id), ["a", "b", "c"]);
        assert.deepEqual(registry.filter((entry) => entry.id !== "b").map((entry) => entry.id), ["a", "c"]);
    });

    it("stores frozen copies, so callers cannot mutate registered content", () => {
        const registry = createRegistry();
        const source = widget("a", "original");
        const stored = registry.register(source);
        assert.notEqual(stored, source);
        assert.equal(Object.isFrozen(stored), true);
        assert.throws(() => { (stored as { label: string }).label = "hacked"; }, TypeError);
        assert.equal(registry.require("a").label, "original");
    });

    it("rejects duplicates, inside a batch and against the registry", () => {
        const registry = createRegistry();
        registry.register(widget("a"));
        assert.throws(() => registry.register(widget("a")), errors.DuplicateRegistryEntryError);
        assert.throws(() => registry.bulkRegister([widget("x"), widget("x")]), errors.DuplicateRegistryEntryError);
        assert.equal(registry.has("x"), false, "a failing batch registers nothing");
    });

    it("is atomic: one invalid entry cancels the whole batch", () => {
        const registry = createRegistry();
        assert.throws(() => registry.bulkRegister([widget("a"), widget("b", ""), widget("c")]), errors.InvalidRegistryEntryError);
        assert.equal(registry.size, 0);
    });

    it("replaces entries only with { override: true }", () => {
        const registry = createRegistry();
        registry.register(widget("a", "first"));
        assert.throws(() => registry.register(widget("a", "second")), /override/);
        registry.register(widget("a", "second"), { override: true });
        assert.equal(registry.require("a").label, "second");
        assert.equal(registry.size, 1);
    });

    it("require throws the unknown error, default or custom", () => {
        assert.throws(() => createRegistry().require("nope"), errors.UnknownRegistryEntryError);
        const custom = createRegistry({ errors: { unknown: (id) => new RangeError(`custom ${id}`), duplicate: (id) => new TypeError(`dup ${id}`) } });
        assert.throws(() => custom.require("nope"), RangeError);
        custom.register(widget("a"));
        assert.throws(() => custom.register(widget("a")), TypeError);
    });

    it("unregisters entries", () => {
        const registry = createRegistry();
        registry.register(widget("a"));
        assert.equal(registry.unregister("a"), true);
        assert.equal(registry.unregister("a"), false);
        assert.equal(registry.size, 0);
    });

    it("normalizes definitions before storing and uses the custom order for listings", () => {
        const registry = createRegistry({
            normalize: (entry) => ({ ...entry, id: entry.id.trim() }),
            order: (first, second) => (second.rank ?? 0) - (first.rank ?? 0)
        });
        registry.bulkRegister([widget(" low ", "l", 1), widget("high", "h", 9)]);
        assert.equal(registry.has("low"), true);
        assert.deepEqual(registry.list().map((entry) => entry.id), ["high", "low"]);
    });

    it("notifies listeners of registrations, replacements and removals", () => {
        const registry = createRegistry();
        const seen: string[] = [];
        const stop = registry.onChange((change: RegistryChange<Widget>) => {
            seen.push(`${change.type}:${change.id}${change.previous ? `<-${change.previous.label}` : ""}`);
        });
        registry.register(widget("a", "one"));
        registry.register(widget("a", "two"), { override: true });
        registry.unregister("a");
        stop();
        registry.register(widget("b"));
        assert.deepEqual(seen, ["registered:a", "replaced:a<-one", "unregistered:a"]);
    });

    it("isolates failing listeners", () => {
        const registry = createRegistry();
        let delivered = 0;
        registry.onChange(() => { throw new Error("boom"); });
        registry.onChange(() => { delivered += 1; });
        assert.doesNotThrow(() => registry.register(widget("a")));
        assert.equal(delivered, 1);
        assert.equal(registry.has("a"), true);
    });

    it("can be locked and unlocked", () => {
        const registry = createRegistry();
        registry.register(widget("a"));
        registry.lock();
        assert.equal(registry.isLocked, true);
        assert.throws(() => registry.register(widget("b")), errors.RegistryLockedError);
        assert.throws(() => registry.bulkRegister([widget("c")]), errors.RegistryLockedError);
        assert.throws(() => registry.unregister("a"), errors.RegistryLockedError);
        assert.equal(registry.get("a")?.id, "a", "reads still work");
        registry.unlock();
        registry.register(widget("b"));
        assert.equal(registry.size, 2);
    });
});

describe("Registries built on Registry keep their historical behaviour", () => {
    it("JobManager and TitleManager are registries with their own errors", () => {
        const jobs = new JobManager();
        const titles = new TitleManager();
        assert.ok(jobs instanceof Registry && titles instanceof Registry);
        assert.throws(() => jobs.require("x"), errors.UnknownJobError);
        assert.throws(() => titles.require("x"), errors.UnknownTitleError);

        titles.register({ id: "  padded  ", name: "Padded", description: "d", rarity: TitleRarity.Common });
        assert.equal(titles.has("padded"), true);
        assert.throws(() => titles.register({ id: "padded", name: "Again", description: "d", rarity: TitleRarity.Common }), errors.TitleAlreadyExistsError);
        assert.throws(() => titles.register({ id: "t", name: " ", description: "d", rarity: TitleRarity.Common }), errors.InvalidTitleError);
    });

    it("titles are listed most prestigious first, and can now be overridden or observed", () => {
        const titles = new TitleManager();
        titles.bulkRegister([
            { id: "c", name: "Common", description: "d", rarity: TitleRarity.Common },
            { id: "l", name: "Legend", description: "d", rarity: TitleRarity.Legendary }
        ]);
        assert.deepEqual(titles.list().map((title) => title.id), ["l", "c"]);
        titles.register({ id: "c", name: "Renamed", description: "d", rarity: TitleRarity.Common }, { override: true });
        assert.equal(titles.require("c").name, "Renamed");
        assert.equal(titles.size, 2);
    });
});
