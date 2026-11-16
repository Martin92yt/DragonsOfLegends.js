/**
 * DragonsOfLegends.js — Tagged logger and log modes.
 *
 * Run only this file:  npx tsx --test tests/logger.test.ts
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { consola } from "consola";

import { createLogger, getLogMode, setLogMode } from "../src/utils/logger.js";
import { createWorld, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();
afterEach(() => setLogMode("silent"));

/** Records what the tagged consola instance of a logger receives. */
function capture(t: import("node:test").TestContext, scope: string): Array<{ method: string; tag: unknown; message: unknown }> {
    const calls: Array<{ method: string; tag: unknown; message: unknown }> = [];
    const original = consola.withTag.bind(consola);
    t.mock.method(consola, "withTag", (tag: string) => {
        const child = original(tag);
        for (const method of ["error", "warn", "success", "info", "debug"] as const) {
            (child as unknown as Record<string, unknown>)[method] = (message: unknown) => void calls.push({ method, tag, message });
        }
        return child;
    });
    createLogger(scope);
    return calls;
}

describe("Tagged logger", () => {
    it("tags every message with the DoL root tag and its scope", (t) => {
        const calls = capture(t, "tagtest");
        setLogMode("normal");
        createLogger("tagtest").info("hello");
        assert.deepEqual(calls, [{ method: "info", tag: "DoL:tagtest", message: "hello" }]);
    });

    it("minimal mode keeps only warnings and errors", (t) => {
        const calls = capture(t, "minimal");
        setLogMode("minimal");
        const log = createLogger("minimal");
        log.debug("d");
        log.info("i");
        log.success("s");
        log.warn("w");
        log.error("e");
        assert.deepEqual(calls.map((call) => call.method), ["warn", "error"]);
    });

    it("normal hides debug, verbose shows it, silent shows nothing", (t) => {
        const calls = capture(t, "modes");
        const log = createLogger("modes");
        setLogMode("normal");
        log.debug("d");
        log.success("s");
        setLogMode("verbose");
        log.debug("d2");
        setLogMode("silent");
        log.error("nothing");
        assert.deepEqual(calls.map((call) => call.method), ["success", "debug"]);
    });

    it("the logMode world option sets the process-wide mode and is validated", () => {
        createWorld({ logMode: "minimal" });
        assert.equal(getLogMode(), "minimal");
        assert.throws(() => createWorld({ logMode: "chatty" as never }), RangeError);
    });
});
