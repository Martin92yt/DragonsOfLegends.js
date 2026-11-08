/**
 * DragonsOfLegends.js — Locations: flags, builder, manager, graph validation and the official map.
 *
 * Run only this file:  npx tsx --test tests/location.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LocationBuilder } from "../src/location/location.builder.js";
import { LocationFlags, addFlag, hasFlag, removeFlag, toggleFlag } from "../src/location/location.flags.js";
import { type LocationCreateParameters } from "../src/location/location.interface.js";
import LocationManager from "../src/location/location.js";
import { LocationType } from "../src/location/location.type.js";
import OfficialMap from "../src/location/official-map.js";
import { PlayerClass } from "../src/player/player.class.js";
import * as errors from "../src/types/error.js";
import { createWorld, defined, loc, useIsolatedWorkspace, validGraph } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("LocationFlags helpers", () => {
    it("tests, adds, removes and toggles flags", () => {
        const water = LocationFlags.OnWater;
        const both = addFlag(LocationFlags.StarterCity, water);
        assert.equal(hasFlag(both, water), true);
        assert.equal(hasFlag(both, LocationFlags.StarterCity), true);
        assert.equal(hasFlag(both, LocationFlags.TeleportOnly), false);
        assert.equal(removeFlag(both, water), LocationFlags.StarterCity);
        assert.equal(toggleFlag(LocationFlags.None, water), water);
        assert.equal(toggleFlag(water, water), LocationFlags.None);
    });
});

describe("LocationBuilder", () => {
    it("builds sensible defaults", () => {
        assert.deepEqual(new LocationBuilder("Home").build(), {
            locationId: "Home",
            locationType: LocationType.City,
            locationFlags: LocationFlags.None,
            travelConnections: { landRoutes: [], boatRoutes: [] }
        });
    });

    it("rejects blank identifiers", () => {
        assert.throws(() => new LocationBuilder("   ").build(), errors.LocationIdEmptyError);
    });

    it("sets the type and replaces flags", () => {
        const built = new LocationBuilder("Dock").setType(LocationType.Village).setFlags([LocationFlags.StarterCity, LocationFlags.TeleportOnly]).build();
        assert.equal(built.locationType, LocationType.Village);
        const manager = new LocationManager();
        assert.equal(manager.create(built).locationFlags, LocationFlags.StarterCity | LocationFlags.TeleportOnly);
    });

    it("accumulates flags without duplicates", () => {
        const built = new LocationBuilder("Dock")
            .addFlag(LocationFlags.OnWater)
            .addFlag(LocationFlags.StarterCity)
            .addFlag(LocationFlags.OnWater)
            .build();
        const flags = [built.locationFlags].flat();
        assert.equal(flags.filter((flag) => flag === LocationFlags.OnWater).length, 1);
        assert.equal(new LocationManager().create(built).locationFlags, LocationFlags.OnWater | LocationFlags.StarterCity);
    });

    it("links by land and by boat with default distance and danger", () => {
        const built = new LocationBuilder("A").linkLand("B").linkBoat("C", 5, 2).build();
        assert.deepEqual(built.travelConnections.landRoutes, [{ destinationLocationId: "B", travelDistance: 1, dangerLevel: 0 }]);
        assert.deepEqual(built.travelConnections.boatRoutes, [{ destinationLocationId: "C", travelDistance: 5, dangerLevel: 2 }]);
    });

    it("ignores duplicate destinations per transport mode", () => {
        const built = new LocationBuilder("A").linkLand("B", 1, 0).linkLand("B", 9, 9).linkBoat("B", 3, 1).build();
        assert.equal(built.travelConnections.landRoutes.length, 1);
        assert.equal(built.travelConnections.landRoutes[0].travelDistance, 1);
        assert.equal(built.travelConnections.boatRoutes.length, 1);
    });

    it("setConnections replaces everything, addConnections appends", () => {
        const builder = new LocationBuilder("A").linkLand("B").linkBoat("C");
        builder.setConnections({ transportMode: "boat", targetLocationId: "D", connectionDistance: 4, connectionDanger: 3 });
        let built = builder.build();
        assert.equal(built.travelConnections.landRoutes.length, 0);
        assert.deepEqual(built.travelConnections.boatRoutes, [{ destinationLocationId: "D", travelDistance: 4, dangerLevel: 3 }]);
        builder.addConnections({ transportMode: "land", targetLocationId: "E" });
        built = builder.build();
        assert.equal(built.travelConnections.landRoutes[0].destinationLocationId, "E");
    });

    it("returns defensive copies of connection arrays", () => {
        const builder = new LocationBuilder("A").linkLand("B");
        builder.build().travelConnections.landRoutes.push({ destinationLocationId: "Z", travelDistance: 1, dangerLevel: 0 });
        assert.equal(builder.build().travelConnections.landRoutes.length, 1);
    });
});

describe("LocationManager", () => {
    it("creates, reads and checks locations", () => {
        const manager = new LocationManager();
        const created = manager.create(loc("A", LocationFlags.StarterCity));
        assert.equal(created.locationFlags, LocationFlags.StarterCity);
        assert.equal(manager.has("A"), true);
        assert.equal(manager.has("B"), false);
        assert.equal(manager.get("A"), created);
        assert.equal(manager.get("B"), undefined);
    });

    it("defaults flags and routes when omitted", () => {
        const manager = new LocationManager();
        const created = manager.create({ locationId: "A", locationType: LocationType.Dungeon } as unknown as LocationCreateParameters);
        assert.equal(created.locationFlags, LocationFlags.None);
        assert.deepEqual(created.travelConnections, { landRoutes: [], boatRoutes: [] });
    });

    it("rejects duplicate identifiers", () => {
        const manager = new LocationManager();
        manager.create(loc("A"));
        assert.throws(() => manager.create(loc("A")), errors.LocationAlreadyExistsError);
    });

    it("bulkCreate accepts builders and raw parameters", () => {
        const manager = new LocationManager();
        const created = manager.bulkCreate([manager.add("A").setFlags(LocationFlags.StarterCity), loc("B")]);
        assert.deepEqual(created.map((entry) => entry.locationId), ["A", "B"]);
    });

    it("link creates bidirectional, idempotent connections", () => {
        const manager = new LocationManager();
        manager.bulkCreate([loc("A"), loc("B")]);
        manager.link("A", "B", "landRoutes", 3, 1);
        manager.link("B", "A", "landRoutes", 3, 1);
        assert.deepEqual(defined(manager.get("A")).travelConnections.landRoutes, [{ destinationLocationId: "B", travelDistance: 3, dangerLevel: 1 }]);
        assert.deepEqual(defined(manager.get("B")).travelConnections.landRoutes, [{ destinationLocationId: "A", travelDistance: 3, dangerLevel: 1 }]);
        manager.link("A", "B", "boatRoutes");
        assert.equal(defined(manager.get("A")).travelConnections.boatRoutes[0].travelDistance, 1);
    });

    it("link rejects unknown locations", () => {
        const manager = new LocationManager();
        manager.create(loc("A"));
        assert.throws(() => manager.link("A", "ghost", "landRoutes"), errors.LocationInexistentLinkError);
    });

    it("serializes and deserializes a graph (string and array input)", () => {
        const source = validGraph();
        const fromString = new LocationManager();
        fromString.deserialize(source.serialize());
        assert.deepEqual(JSON.parse(fromString.serialize()), JSON.parse(source.serialize()));
        const fromArray = new LocationManager();
        fromArray.deserialize(JSON.parse(source.serialize()));
        assert.equal(fromArray.has("Field"), true);
    });

    it("deserialize replaces existing locations and validates the result", () => {
        const manager = validGraph();
        manager.deserialize(validGraph().serialize());
        assert.equal(manager.has("Home"), true);
        assert.throws(() => manager.deserialize([loc("Lonely") as never]), errors.NoStartingCityError);
    });

    it("exposes the starting city", () => {
        const manager = validGraph();
        assert.equal(manager.getStartingCityId(), "Home");
        assert.equal(manager.getStartingCity().locationId, "Home");
    });
});

describe("LocationManager graph validation", () => {
    it("accepts a valid graph", () => {
        assert.doesNotThrow(() => validGraph().validate());
    });

    it("requires a starting city", () => {
        const manager = new LocationManager();
        manager.create(loc("A"));
        assert.throws(() => manager.validate(), errors.NoStartingCityError);
        assert.throws(() => manager.getStartingCityId(), errors.NoStartingCityError);
    });

    it("rejects several starting cities", () => {
        const manager = new LocationManager();
        manager.bulkCreate([loc("A", LocationFlags.StarterCity), loc("B", LocationFlags.StarterCity)]);
        assert.throws(() => manager.validate(), errors.MultipleStartingCitiesError);
    });

    it("rejects self connections", () => {
        const manager = new LocationManager();
        manager.create(loc("A", LocationFlags.StarterCity, ["A"]));
        assert.throws(() => manager.validate(), errors.SelfConnectionError);
    });

    it("rejects connections to unknown targets", () => {
        const manager = new LocationManager();
        manager.create(loc("A", LocationFlags.StarterCity, ["ghost"]));
        assert.throws(() => manager.validate(), errors.InvalidConnectionTargetError);
    });

    it("rejects non-reciprocal connections", () => {
        const manager = new LocationManager();
        manager.bulkCreate([loc("A", LocationFlags.StarterCity, ["B"]), loc("B")]);
        assert.throws(() => manager.validate(), errors.NonReciprocalConnectionError);
    });

    it("requires the OnWater flag on both ends of a boat route", () => {
        const manager = new LocationManager();
        manager.bulkCreate([
            loc("A", LocationFlags.StarterCity | LocationFlags.OnWater, [], ["B"]),
            loc("B", LocationFlags.None, [], ["A"])
        ]);
        assert.throws(() => manager.validate(), errors.BoatWaterFlagRequiredError);
    });

    it("accepts boat routes between water locations", () => {
        const manager = new LocationManager();
        manager.bulkCreate([
            loc("A", LocationFlags.StarterCity | LocationFlags.OnWater, [], ["B"]),
            loc("B", LocationFlags.OnWater, [], ["A"])
        ]);
        assert.doesNotThrow(() => manager.validate());
    });

    it("rejects unreachable locations but tolerates TeleportOnly ones", () => {
        const unreachable = new LocationManager();
        unreachable.bulkCreate([loc("A", LocationFlags.StarterCity), loc("B")]);
        assert.throws(() => unreachable.validate(), (error: unknown) => error instanceof errors.UnreachableLocationsError && /B/.test(error.message));

        const teleport = new LocationManager();
        teleport.bulkCreate([loc("A", LocationFlags.StarterCity), loc("B", LocationFlags.TeleportOnly)]);
        assert.doesNotThrow(() => teleport.validate());
    });
});

describe("Official map", () => {
    it("is created and validated by default", () => {
        const world = createWorld();
        const ids: string[] = (JSON.parse(world.location.serialize()) as Array<{ locationId: string }>).map((entry) => entry.locationId);
        assert.equal(ids.length, 23);
        assert.equal(world.location.getStartingCityId(), "Embercross");
        assert.doesNotThrow(() => world.location.validate());
    });

    it("keeps the documented routes and flags", () => {
        const { location } = createWorld();
        const embercross = defined(location.get("Embercross"));
        assert.deepEqual(embercross.travelConnections.landRoutes[0], { destinationLocationId: "Twilight Farm", travelDistance: 6, dangerLevel: 2 });
        assert.equal(defined(location.get("Dawnwind")).locationFlags, LocationFlags.TeleportOnly);
        assert.equal(defined(location.get("Palace Of Stars")).locationType, LocationType.Dungeon);
        assert.equal(hasFlag(defined(location.get("Ironmill")).locationFlags, LocationFlags.OnWater), true);
    });

    it("cannot be created twice on the same world", () => {
        assert.throws(() => new OfficialMap(createWorld()), errors.LocationAlreadyExistsError);
    });

    it("can be disabled, leaving the world without a starting city", async () => {
        const world = createWorld({ premadeMap: false });
        assert.equal(world.location.has("Embercross"), false);
        await assert.rejects(world.players.create({ id: "nomap", name: "NoMap", playerClass: PlayerClass.Rogue }), errors.NoStartingCityError);
    });
});
