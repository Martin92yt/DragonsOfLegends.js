/**
 * DragonsOfLegends.js — Stat requirements to wear an item (e.g. 10 intelligence for an iron sword).
 *
 * Run only this file:  npx tsx --test tests/equip-requirements.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findUnmetRequirements, readEquipRequirements } from "../src/inventory/equip-requirements.js";
import * as errors from "../src/types/error.js";
import { createWorld, defined, findRecord, settle, spawn, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("Equip requirements", () => {
    it("an iron sword needs 10 intelligence", async () => {
        const world = createWorld({ officialPack: true });
        const player = await spawn(world);
        await player.inventory.add(defined(world.items.get("iron_sword")), 1);
        player.attributes.intelligence = 9;

        await assert.rejects(player.inventory.equip("sword", "iron_sword"), (error: unknown) => {
            assert.ok(error instanceof errors.EquipRequirementError);
            assert.deepEqual(error.unmet, [{ stat: "intelligence", required: 10, actual: 9 }]);
            assert.match(error.message, /intelligence 10 \(you have 9\)/);
            return true;
        });
        assert.equal((await findRecord(player, "iron_sword"))?.isEquipped, false, "nothing was equipped");

        player.attributes.intelligence = 10;
        assert.equal(await player.inventory.equip("sword", "iron_sword"), true);
        await settle();
        assert.equal((await findRecord(player, "iron_sword"))?.isEquipped, true);
    });

    it("getUnmetRequirements reports without equipping, and returns undefined for a missing item", async () => {
        const world = createWorld({ officialPack: true });
        const player = await spawn(world);
        await player.inventory.add(defined(world.items.get("steel_sword")), 1);
        player.attributes.intelligence = 3;
        assert.deepEqual(await player.inventory.getUnmetRequirements("steel_sword"), [{ stat: "intelligence", required: 15, actual: 3 }]);
        assert.equal(await player.inventory.getUnmetRequirements("nothing"), undefined);
    });

    it("items without requirements, and a replaced slot, are unaffected", async () => {
        const world = createWorld({ officialPack: true });
        const player = await spawn(world);
        player.attributes.intelligence = 1;
        assert.equal(await player.inventory.equip("sword", "rusty_sword"), true);
    });

    it("supports several stats and the level at once", () => {
        const player = { level: 3, attributes: { strength: 12, agility: 4, intelligence: 5, defense: 6 } };
        const unmet = findUnmetRequirements({ level: 5, strength: 10, intelligence: 8 }, player);
        assert.deepEqual(unmet, [
            { stat: "level", required: 5, actual: 3 },
            { stat: "intelligence", required: 8, actual: 5 }
        ]);
    });

    it("ignores malformed requirement data", () => {
        assert.deepEqual(readEquipRequirements({ itemNbtData: { requirements: { intelligence: "10", strength: -2, agility: 4 } } }), { agility: 4 });
        assert.deepEqual(readEquipRequirements({ itemNbtData: { requirements: [1] } }), {});
        assert.deepEqual(readEquipRequirements(undefined), {});
    });

    it("a blacksmith-forged iron sword keeps the requirement", async () => {
        const world = createWorld({ officialPack: true });
        const player = await spawn(world);
        const { makeItem } = await import("./helpers/fixtures.js");
        await player.jobs.addExperience("blacksmithing", 5000);
        await player.inventory.add(makeItem("iron_ingot"), 3);
        await player.inventory.add(makeItem("oak_log"), 1);
        const result = await world.crafting.craft(player, "forge_iron_sword");
        assert.deepEqual(result.produced[0]?.nbt?.["requirements"], { intelligence: 10 });
    });
});
