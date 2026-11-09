/**
 * DragonsOfLegends.js — Content packs: third-party enemies, items, classes, jobs, titles and locations.
 *
 * Run only this file:  npx tsx --test tests/content-packs.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defineContentPack, type ContentPack } from "../src/content/content-pack.js";
import { OFFICIAL_PACK_IDS, createOfficialPacks } from "../src/content/official-packs.js";
import EnemyManager from "../src/enemy/enemy.manager.js";
import type { EnemyDefinition, EnemySpawnRule } from "../src/enemy/enemy.definition.js";
import { OFFICIAL_ENEMIES } from "../src/enemy/official-enemies.js";
import { ItemCategory, ItemRarity } from "../src/inventory/item.enum.js";
import type { JobDefinition } from "../src/jobs/job.types.js";
import { LocationBuilder } from "../src/location/location.builder.js";
import { LocationFlags } from "../src/location/location.flags.js";
import { LocationType } from "../src/location/location.type.js";
import type { PlayerClassDefinition } from "../src/player/player-class.definition.js";
import { TitleRarity } from "../src/title/title.types.js";
import * as errors from "../src/types/error.js";
import { createWorld, defined, fakeEvents, makeItem, spawn, stubRandom, totalQuantity, travel, useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

const fireImp: EnemyDefinition = {
    id: "mypack:fire_imp",
    name: "Fire Imp",
    tier: "inferno",
    health: 20,
    strength: 7,
    defense: 1,
    experience: 20,
    gold: 9,
    discoveryGold: 33,
    bestiary: { name: "Imp", description: "A cackling ember with a grudge." },
    ambush: { land: { order: -1 } },
    loot: [{ itemId: "ember", name: "Ember", category: ItemCategory.Materials, rarity: ItemRarity.Common, maxStack: 64, minQuantity: 2, maxQuantity: 2, dropRate: 100 }]
};

const necromancer: PlayerClassDefinition = {
    id: "mypack:necromancer",
    name: "Necromancer",
    baseStats: { strength: 3, agility: 4, intelligence: 12, defense: 3 },
    attackStat: "intelligence"
};

const mining: JobDefinition = {
    id: "mypack:alchemy",
    name: "Alchemy",
    actions: [{ id: "brew", name: "Brew", cooldownMs: 0, xp: 5, loot: [{ item: makeItem("potion_base"), weight: 1, minQuantity: 1, maxQuantity: 1 }] }]
};

const hub = (): LocationBuilder => new LocationBuilder("Hub").setType(LocationType.City).setFlags(LocationFlags.StarterCity);

/** A pack providing the bare minimum needed to create a player in an empty world. */
const startPack = (): ContentPack => ({ id: "test:start", classes: [necromancer], locations: [hub()] });

const emptyWorld = (options: Parameters<typeof createWorld>[0] = {}) => createWorld({ premadeContent: false, ...options });

describe("Official content is a set of ordinary packs", () => {
    it("loads the five official packs by default (the items pack is opt-in)", () => {
        const world = createWorld();
        // Rationale: the items and achievements packs are opt-in (see `premadeItems`, `premadeAchievements`, `loadOfficialPack`).
        const { items: _items, achievements: _achievements, ...defaultPacks } = OFFICIAL_PACK_IDS;
        assert.deepEqual(world.content.list().map((pack) => pack.id).slice(0, 5), Object.values(defaultPacks));
        assert.equal(world.enemies.size, OFFICIAL_ENEMIES.length);
        assert.equal(world.classes.size, 3);
        assert.equal(world.jobs.size, 3);
        assert.ok(world.titles.size > 0);
        assert.ok(world.location.has("Embercross"));
        assert.equal(world.items.size, 0, "the library ships no item catalogue");
    });

    it("starts from a completely empty world with premadeContent: false", () => {
        const world = emptyWorld();
        assert.equal(world.enemies.size + world.classes.size + world.jobs.size + world.titles.size + world.items.size, 0);
        assert.equal(world.location.has("Embercross"), false);
        assert.deepEqual(world.content.list().map((pack) => pack.id), ["world:custom"]);
    });

    it("lets the individual premade options override the master switch", () => {
        const world = emptyWorld({ premadeJobs: true });
        assert.equal(world.jobs.size, 3);
        assert.equal(world.enemies.size, 0);
        const noEnemies = createWorld({ premadeEnemies: false });
        assert.equal(noEnemies.enemies.size, 0);
        assert.equal(noEnemies.classes.size, 3);
    });

    it("builds fresh official packs on every call", () => {
        const [first, second] = [createOfficialPacks(), createOfficialPacks()];
        const mapOf = (packs: ReturnType<typeof createOfficialPacks>) => packs.find((pack) => pack.id === OFFICIAL_PACK_IDS.map);
        assert.notEqual(mapOf(first)?.locations?.[0], mapOf(second)?.locations?.[0]);
    });
});

describe("ContentManager", () => {
    it("loads a pack and reports what it registered", () => {
        const world = emptyWorld();
        const loaded = world.content.use(defineContentPack({
            id: "mypack",
            name: "My pack",
            version: "1.2.3",
            items: [makeItem("ember")],
            enemies: [fireImp],
            classes: [necromancer],
            jobs: [mining],
            titles: [{ id: "imp_slayer", name: "Imp Slayer", description: "d", rarity: TitleRarity.Rare }],
            locations: [hub()]
        }));
        assert.deepEqual(loaded.counts, { item: 1, enemy: 1, "player class": 1, job: 1, title: 1, location: 1 });
        assert.equal(loaded.version, "1.2.3");
        assert.equal(world.content.has("mypack"), true);
        assert.equal(world.content.get("mypack")?.name, "My pack");
        assert.equal(world.enemies.has("mypack:fire_imp"), true);
        assert.equal(world.items.has("ember"), true);
        assert.equal(world.classes.has("mypack:necromancer"), true);
        assert.equal(world.jobs.has("mypack:alchemy"), true);
        assert.equal(world.titles.has("imp_slayer"), true);
        assert.equal(world.location.getStartingCityId(), "Hub");
    });

    it("validates the pack identity and its dependencies", () => {
        const world = emptyWorld();
        assert.throws(() => world.content.use({ id: " " }), errors.InvalidContentPackError);
        assert.throws(() => world.content.use({ id: "child", dependsOn: ["base"] }), errors.MissingPackDependencyError);
        world.content.use({ id: "base" });
        world.content.use({ id: "child", dependsOn: ["base"] });
        assert.throws(() => world.content.use({ id: "base" }), errors.DuplicateContentPackError);
        assert.deepEqual(world.content.list().map((pack) => pack.id), ["world:custom", "base", "child"]);
    });

    it("rolls a pack back entirely when one of its sections is invalid", () => {
        const world = emptyWorld();
        const broken: ContentPack = {
            id: "broken",
            items: [makeItem("ember")],
            enemies: [fireImp],
            jobs: [{ ...mining, actions: [] }]
        };
        assert.throws(() => world.content.use(broken), errors.InvalidJobError);
        assert.equal(world.items.size + world.enemies.size + world.jobs.size, 0);
        assert.equal(world.content.has("broken"), false);
        world.content.use({ ...broken, jobs: [mining] });
        assert.equal(world.enemies.size, 1);
    });

    it("rolls back registrations and locations when the setup hook fails", () => {
        const world = emptyWorld();
        assert.throws(
            () => world.content.use({ id: "hook", enemies: [fireImp], locations: [hub()], setup: () => { throw new Error("setup failed"); } }),
            /setup failed/
        );
        assert.equal(world.enemies.size, 0);
        assert.equal(world.location.has("Hub"), false);
    });

    it("runs the setup hook with the world once everything is registered", () => {
        const world = emptyWorld();
        let seen = "";
        world.content.use({ id: "hook", enemies: [fireImp], setup: (target) => { seen = `${target === world}:${target.enemies.size}`; } });
        assert.equal(seen, "true:1");
    });

    it("rejects a location set that would corrupt the map, leaving the map untouched", () => {
        const world = createWorld();
        const before = world.location.serialize();
        assert.throws(() => world.content.use({ id: "second-start", locations: [hub()] }), errors.MultipleStartingCitiesError);
        assert.throws(
            () => world.content.use({ id: "island", locations: [new LocationBuilder("Lonely Island").setType(LocationType.City)] }),
            errors.UnreachableLocationsError
        );
        assert.equal(world.location.serialize(), before);
    });

    it("extends the official map with a connected region", () => {
        const world = createWorld();
        world.content.use({
            id: "expansion",
            locations: [new LocationBuilder("Emberfall").setType(LocationType.Dungeon)],
            links: [{ from: "Emberfall", to: "Embercross", mode: "landRoutes", distance: 5, danger: 2 }]
        });
        assert.equal(world.location.has("Emberfall"), true);
        assert.ok(world.location.get("Embercross")?.travelConnections.landRoutes.some((route) => route.destinationLocationId === "Emberfall"));
    });

    it("rolls the whole map back when a link targets an unknown location", () => {
        const world = createWorld();
        const before = world.location.serialize();
        assert.throws(
            () => world.content.use({ id: "bad-link", locations: [new LocationBuilder("Nowhere Land")], links: [{ from: "Nowhere Land", to: "Atlantis", mode: "landRoutes" }] }),
            errors.LocationInexistentLinkError
        );
        assert.equal(world.location.serialize(), before);
    });

    it("protects official content unless a pack explicitly overrides it", () => {
        const world = createWorld();
        const goblin = { ...OFFICIAL_ENEMIES.find((enemy) => enemy.id === "goblin") as EnemyDefinition, health: 999 };
        assert.throws(() => world.content.use({ id: "tweak", enemies: [goblin] }), errors.DuplicateRegistryEntryError);
        assert.equal(world.enemies.require("goblin").health, 50);

        world.content.use({ id: "tweak", enemies: [goblin] }, { override: true });
        assert.equal(world.enemies.require("goblin").health, 999);
    });

    it("restores overridden content when the overriding pack fails", () => {
        const world = createWorld();
        const goblin = { ...OFFICIAL_ENEMIES.find((enemy) => enemy.id === "goblin") as EnemyDefinition, health: 999 };
        assert.throws(() => world.content.use({ id: "bad", enemies: [goblin], setup: () => { throw new Error("nope"); } }, { override: true }), /nope/);
        assert.equal(world.enemies.require("goblin").health, 50);
    });

    it("can lock the content once the world is configured", () => {
        const world = createWorld();
        world.content.lock();
        assert.equal(world.content.isLocked, true);
        assert.throws(() => world.content.use({ id: "late" }), errors.RegistryLockedError);
        assert.throws(() => world.enemies.register(fireImp), errors.RegistryLockedError);
        assert.throws(() => world.jobs.unregister("fishing"), errors.RegistryLockedError);
        world.content.unlock();
        world.enemies.register(fireImp);
        assert.equal(world.enemies.has(fireImp.id), true);
    });

    it("loads content from world options, in a predictable order", () => {
        const world = emptyWorld({
            customItems: [makeItem("ember")],
            customEnemies: [fireImp],
            customClasses: [necromancer],
            customJobs: [mining],
            customTitles: [{ id: "t", name: "T", description: "d", rarity: TitleRarity.Common }],
            customLocations: [hub()],
            packs: [{ id: "extra", dependsOn: ["world:custom"], enemies: [{ ...fireImp, id: "mypack:ice_imp", ambush: undefined }] }]
        });
        assert.equal(world.enemies.size, 2);
        assert.deepEqual(world.content.list().map((pack) => pack.id), ["world:custom", "extra"]);
        assert.equal(world.location.getStartingCityId(), "Hub");
    });
});

describe("Third-party content in play", () => {
    it("creates players of a custom class and rejects classes nobody registered", async () => {
        const world = emptyWorld({ packs: [startPack()] });
        const player = await world.players.create({ id: "p1", name: "Vex", playerClass: necromancer.id });
        assert.equal(player.location, "Hub");
        assert.ok(player.attributes.intelligence >= 10 && player.attributes.intelligence <= 14);
        await assert.rejects(world.players.create({ id: "p2", name: "X", playerClass: "warrior" }), errors.UnknownPlayerClassError);
    });

    it("drives the attack of a class from its attackStat", async () => {
        const world = emptyWorld({ packs: [startPack()] });
        const player = await world.players.create({ id: "p1", name: "Vex", playerClass: necromancer.id });
        player.attributes = { points: 0, strength: 1, agility: 2, intelligence: 40, defense: 1 };
        const combat = world.combat.startWithEnemy(player, new EnemyManager(world.enemies).createOfType("nothing"));
        assert.equal(combat["getPlayerAttackStat"](), 40);
    });

    it("spawns custom enemies through custom spawn rules, with their loot", (t) => {
        stubRandom(t, 0);
        const world = emptyWorld({
            packs: [{ id: "p", enemies: [fireImp] }],
            enemySpawnRules: [{ belowLevel: Number.POSITIVE_INFINITY, tiers: { inferno: 1 } }]
        });
        const imp = new EnemyManager(world.enemies, [{ belowLevel: Number.POSITIVE_INFINITY, tiers: { inferno: 1 } }]).createOfType(fireImp.id);
        assert.equal(imp.type, fireImp.id);
        imp.takeDamage(10_000);
        assert.deepEqual(imp.droppedLootList.map((drop) => [drop.loot.itemId, drop.quantity]), [["ember", 2]]);
    });

    it("picks the tier from the player level with fully custom rules, and falls back when a tier is empty", async (t) => {
        const world = emptyWorld({ packs: [startPack(), { id: "p", enemies: [fireImp, { ...fireImp, id: "mypack:cinder", tier: "ash" }] }] });
        const player = await world.players.create({ id: "p1", name: "Vex", playerClass: necromancer.id });
        stubRandom(t, 0);
        const rules: EnemySpawnRule[] = [{ belowLevel: 5, tiers: { ash: 1 } }, { belowLevel: Number.POSITIVE_INFINITY, tiers: { inferno: 1 } }];
        const manager = new EnemyManager(world.enemies, rules);
        assert.equal(manager.create(player).type, "mypack:cinder");
        player.level = 9;
        assert.equal(manager.create(player).type, fireImp.id);
        const fallback = new EnemyManager(world.enemies, [{ belowLevel: Number.POSITIVE_INFINITY, tiers: { missing: 1 } }]);
        assert.equal(fallback.create(player).type, fireImp.id, "an empty tier falls back to every registered enemy");
    });

    it("fails clearly when no enemy exists at all", async () => {
        const world = emptyWorld({ packs: [startPack()] });
        const player = await world.players.create({ id: "p1", name: "Vex", playerClass: necromancer.id });
        assert.throws(() => new EnemyManager(world.enemies).create(player), errors.NoEnemyAvailableError);
    });

    it("lets custom enemies join ambushes, and skips ambushes when nobody can ambush", async (t) => {
        const world = createWorld({ packs: [{ id: "p", enemies: [fireImp] }] });
        const player = await spawn(world);
        stubRandom(t, 0);
        const result = await travel(t, player, "Embercross", 1, 1);
        assert.equal(defined(result.enemy).type, fireImp.id, "order -1 puts the imp first in the land ambush pool");
        assert.equal(defined(result.enemy).name, "Mypack:fire_imp");
    });

    it("arrives safely when no registered enemy can ambush in the zone", async (t) => {
        const world = createWorld({ premadeEnemies: false });
        const player = await spawn(world);
        stubRandom(t, 0);
        const result = await travel(t, player, "Ironmill", 1, 1);
        assert.equal(result.arrived, true);
        assert.equal(result.attacked, false);
        assert.equal(player.location, "Ironmill");
    });

    it("feeds the bestiary with custom species (text, discovery gold, progress)", async () => {
        const world = createWorld({ packs: [{ id: "p", enemies: [fireImp] }] });
        const player = await spawn(world);
        const gold = player.gold;
        await world.events.emitAsync("enemyDefeat", fakeEvents.enemyDefeat({ playerId: player.id, enemyType: fireImp.id }));
        assert.equal(player.gold, gold + 33);
        const entry = player.bestiary.getEntry(fireImp.id);
        assert.equal(entry.discovered && entry.name, "Imp");
        assert.equal(entry.discovered && entry.description, "A cackling ember with a grudge.");
        assert.equal(player.bestiary.list().length, world.enemies.size);
        assert.equal(player.bestiary.getProgress().total, OFFICIAL_ENEMIES.length + 1);
    });

    it("keeps the bestiary of a species whose pack is gone, without counting it", async () => {
        const world = createWorld({ packs: [{ id: "p", enemies: [fireImp] }] });
        const player = await spawn(world);
        await world.events.emitAsync("enemyDefeat", fakeEvents.enemyDefeat({ playerId: player.id, enemyType: fireImp.id }));
        world.enemies.unregister(fireImp.id);
        assert.equal(player.bestiary.getProgress().discovered, 0);
        assert.equal(player.bestiary.toState()[fireImp.id]?.kills, 1, "the discovery is not lost");
        assert.equal(player.bestiary.getEntry(fireImp.id).discovered && player.bestiary.getEntry(fireImp.id).name, fireImp.id);
    });

    it("gives the starter items found in the item catalogue and skips the others", async () => {
        const world = createWorld({ customItems: [makeItem("starter_ration")], starterItems: { starter_ration: 3, health_potion: 3 } });
        const player = await spawn(world);
        assert.equal(await totalQuantity(player, "starter_ration"), 3);
        assert.equal(await totalQuantity(player, "health_potion"), 0);
    });

    it("runs custom jobs registered by a pack", async () => {
        const world = createWorld({ packs: [{ id: "p", jobs: [mining] }] });
        const player = await spawn(world);
        const result = await player.jobs.perform("mypack:alchemy", "brew");
        assert.equal(result.loot[0]?.item.itemId, "potion_base");
        assert.equal(await totalQuantity(player, "potion_base"), 1);
    });

    it("validates enemy, item and class definitions", () => {
        const world = emptyWorld();
        assert.throws(() => world.enemies.register({ ...fireImp, id: " " }), errors.InvalidRegistryEntryError);
        assert.throws(() => world.enemies.register({ ...fireImp, health: 0 }), errors.InvalidRegistryEntryError);
        assert.throws(() => world.enemies.register({ ...fireImp, tier: "" }), errors.InvalidRegistryEntryError);
        assert.throws(() => world.enemies.register({ ...fireImp, discoveryGold: -1 }), errors.InvalidRegistryEntryError);
        assert.throws(() => world.enemies.register({ ...fireImp, loot: [{ ...(fireImp.loot ?? [])[0]!, dropRate: 150 }] }), errors.InvalidRegistryEntryError);
        assert.throws(() => world.enemies.register({ ...fireImp, ambush: { land: { weight: 0 } } }), errors.InvalidRegistryEntryError);
        assert.throws(() => world.items.register({ ...makeItem("x"), maxStack: 0 }), errors.InvalidRegistryEntryError);
        assert.throws(() => world.items.register({ ...makeItem("x"), name: " " }), errors.InvalidRegistryEntryError);
        assert.throws(() => world.classes.register({ ...necromancer, baseStats: { ...necromancer.baseStats, defense: 0 } }), errors.InvalidRegistryEntryError);
        assert.equal(world.enemies.size + world.items.size + world.classes.size, 0);
    });

    it("lists enemies by tier and ambush zone, and items by category", () => {
        const world = createWorld({ customItems: [makeItem("sword", ItemCategory.Weapons), makeItem("ore")] });
        assert.deepEqual(world.enemies.listByTier("boss").map((enemy) => enemy.id), ["lich", "demon_lord", "ancient_dragon", "hydra"]);
        assert.deepEqual(world.enemies.listAmbushers("land").map((enemy) => enemy.id), ["slime", "goblin", "wolf", "bandit", "wild_boar", "skeleton"]);
        assert.deepEqual(world.enemies.listAmbushers("water").map((enemy) => enemy.id), ["hydra", "giant_rat"]);
        assert.deepEqual(world.enemies.tiers(), ["beginner", "intermediate", "advanced", "boss"]);
        assert.deepEqual(world.items.listByCategory(ItemCategory.Weapons).map((item) => item.itemId), ["sword"]);
    });
});
