/**
 * DragonsOfLegends.js — Business error classes.
 *
 * Run only this file:  npx tsx --test tests/errors.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as errors from "../src/types/error.js";
import { useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("Business errors", () => {
    const cases: ReadonlyArray<readonly [string, () => Error, RegExp]> = [
        ["PlayerNoCharacterError", () => new errors.PlayerNoCharacterError(), /registered character/],
        ["SelfCombatError", () => new errors.SelfCombatError(), /yourself/],
        ["PlayerAlreadyInCombatError", () => new errors.PlayerAlreadyInCombatError("p1"), /p1.*already in combat/],
        ["PlayerNotInCombatError", () => new errors.PlayerNotInCombatError("p1"), /p1.*not in combat/],
        ["LocationIdEmptyError", () => new errors.LocationIdEmptyError(), /cannot be empty/],
        ["LocationAlreadyExistsError", () => new errors.LocationAlreadyExistsError("A"), /"A" already exists/],
        ["LocationInexistentLinkError", () => new errors.LocationInexistentLinkError("A", "B"), /"A" <-> "B"/],
        ["NoStartingCityError", () => new errors.NoStartingCityError(), /No starting city/],
        ["MultipleStartingCitiesError", () => new errors.MultipleStartingCitiesError(["A", "B"]), /A, B/],
        ["SelfConnectionError", () => new errors.SelfConnectionError("A", "landRoutes"), /"A".*landRoutes/],
        ["InvalidConnectionTargetError", () => new errors.InvalidConnectionTargetError("A", "boatRoutes", "B"), /boatRoutes.*"B"/],
        ["NonReciprocalConnectionError", () => new errors.NonReciprocalConnectionError("landRoutes", "A", "B"), /"A" -> "B".*not reciprocal/],
        ["BoatWaterFlagRequiredError", () => new errors.BoatWaterFlagRequiredError("A", "B"), /OnWater/],
        ["UnreachableLocationsError", () => new errors.UnreachableLocationsError(["X", "Y"]), /X, Y/],
        ["PlayerAlreadyTravellingError", () => new errors.PlayerAlreadyTravellingError(), /already travelling/],
        ["MoveInCombatError", () => new errors.MoveInCombatError(), /while in combat/],
        ["NoAttributePointsError", () => new errors.NoAttributePointsError(), /No attribute points/],
        ["UnknownPlayerClassError", () => new errors.UnknownPlayerClassError("mage"), /mage/],
        ["PlayerAlreadyExistsError", () => new errors.PlayerAlreadyExistsError("p1"), /p1 already exists/],
        ["BankError", () => new errors.BankError("boom"), /boom/],
        ["BankLockedError", () => new errors.BankLockedError(), /not unlocked/],
        ["InsufficientFundsError", () => new errors.InsufficientFundsError(), /Insufficient funds/],
        ["InvalidAmountError", () => new errors.InvalidAmountError(), /invalid/],
        ["InvalidDeathLossRateError", () => new errors.InvalidDeathLossRateError("epic", 150), /"epic".*150/],
        ["InvalidTitleError", () => new errors.InvalidTitleError("bad title"), /bad title/],
        ["TitleAlreadyExistsError", () => new errors.TitleAlreadyExistsError("t1"), /"t1" is already registered/],
        ["UnknownTitleError", () => new errors.UnknownTitleError("t1"), /Unknown title "t1"/],
        ["TitleNotOwnedError", () => new errors.TitleNotOwnedError("p1", "t1"), /p1.*"t1"/],
        ["BankCapacityError", () => new errors.BankCapacityError(40, 42), /42 slots required, 40 available/],
        ["BankItemNotFoundError", () => new errors.BankItemNotFoundError("ore", 5, 2), /"ore": 5 requested, 2 available/],
        ["InvalidBankCapacityError", () => new errors.InvalidBankCapacityError(0), /capacity: 0/],
        ["InvalidBestiaryRewardError", () => new errors.InvalidBestiaryRewardError("slime", -1), /"slime": -1/],
        ["InvalidJobError", () => new errors.InvalidJobError("bad job"), /bad job/],
        ["JobAlreadyExistsError", () => new errors.JobAlreadyExistsError("fishing"), /"fishing" is already registered/],
        ["UnknownJobError", () => new errors.UnknownJobError("x"), /Unknown job "x"/],
        ["UnknownJobActionError", () => new errors.UnknownJobActionError("fishing", "x"), /no action "x"/],
        ["JobCooldownError", () => new errors.JobCooldownError("fishing", "fish", 2500), /cooldown for 3s/],
        ["JobLevelTooLowError", () => new errors.JobLevelTooLowError("fishing", "fish", 5, 2), /level 5 \(current: 2\)/],
        ["JobToolRequiredError", () => new errors.JobToolRequiredError("fishing", "fish"), /requires an equipped tool/],
        ["InvalidJobToolError", () => new errors.InvalidJobToolError("fishing", "rod"), /"rod" is not an owned tool/],
        ["RegistryError", () => new errors.RegistryError("boom"), /boom/],
        ["InvalidRegistryEntryError", () => new errors.InvalidRegistryEntryError("enemy", "bad"), /Invalid enemy definition: bad/],
        ["DuplicateRegistryEntryError", () => new errors.DuplicateRegistryEntryError("item", "ore"), /item "ore" is already registered.*override/],
        ["UnknownRegistryEntryError", () => new errors.UnknownRegistryEntryError("item", "ore"), /Unknown item "ore"/],
        ["RegistryLockedError", () => new errors.RegistryLockedError("enemy"), /enemy registry is locked/],
        ["NoEnemyAvailableError", () => new errors.NoEnemyAvailableError(), /No enemy is registered/],
        ["InvalidContentPackError", () => new errors.InvalidContentPackError("p", "bad"), /pack "p": bad/],
        ["DuplicateContentPackError", () => new errors.DuplicateContentPackError("p"), /"p" is already loaded/],
        ["MissingPackDependencyError", () => new errors.MissingPackDependencyError("p", "base"), /"p" requires "base"/]
    ];

    for (const [name, factory, pattern] of cases) {
        it(`${name} carries its name and message`, () => {
            const error = factory();
            assert.ok(error instanceof Error);
            assert.equal(error.name, name);
            assert.match(error.message, pattern);
        });
    }

    it("bank errors share the BankError base class", () => {
        assert.ok(new errors.BankLockedError() instanceof errors.BankError);
        assert.ok(new errors.InsufficientFundsError() instanceof errors.BankError);
        assert.ok(new errors.InvalidAmountError() instanceof errors.BankError);
        assert.ok(new errors.BankCapacityError(1, 2) instanceof errors.BankError);
        assert.ok(new errors.BankItemNotFoundError("a", 1, 0) instanceof errors.BankError);
        assert.ok(new errors.InvalidBankCapacityError(0) instanceof errors.BankError);
    });

    it("registry errors share the RegistryError base class", () => {
        assert.ok(new errors.DuplicateRegistryEntryError("a", "b") instanceof errors.RegistryError);
        assert.ok(new errors.MissingPackDependencyError("a", "b") instanceof errors.ContentPackError);
        assert.ok(new errors.ContentPackError("x") instanceof errors.RegistryError);
    });

    it("exposes the details of job and bank errors", () => {
        const cooldown = new errors.JobCooldownError("fishing", "fish", 1200);
        assert.equal(cooldown.remainingMs, 1200);
        const level = new errors.JobLevelTooLowError("fishing", "fish", 5, 2);
        assert.deepEqual([level.requiredLevel, level.currentLevel], [5, 2]);
        const capacity = new errors.BankCapacityError(40, 42);
        assert.deepEqual([capacity.capacity, capacity.requiredSlots], [40, 42]);
    });
    it("describes death lock errors", () => {
        const timed = new errors.PlayerDeadError("p1", 4200, "player.moveTo");
        assert.equal(timed.remainingMs, 4200);
        assert.equal(timed.permanent, false);
        assert.equal(timed.action, "player.moveTo");
        assert.match(timed.message, /respawn in 5s/);
        const permanent = new errors.PlayerDeadError("p1", Number.POSITIVE_INFINITY, "x");
        assert.equal(permanent.permanent, true);
        assert.equal(permanent.respawnAt, null);
        assert.ok(new errors.InvalidDurationError("abc") instanceof Error);
        assert.ok(new errors.InvalidDeathRespawnError("bad") instanceof Error);
    });
});
