/**
 * Shared fixtures and helpers for every test file.
 *
 * Each test file calls `useIsolatedWorkspace()` once: every file then runs inside a throw-away
 * working directory, because several modules use relative database paths (`./inventory.db`, `./data/player.db`).
 */
import { OFFICIAL_ENEMIES } from "../../src/enemy/official-enemies.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, type TestContext } from "node:test";
import { consola } from "consola";

import EnemyEntity from "../../src/enemy/enemy.js";
import { EnemyType } from "../../src/enemy/enemy.type.js";
import type { InventoryItemRecord, Item } from "../../src/inventory/inventory.interface.js";
import { ItemCategory, ItemRarity, type EquipmentSlot } from "../../src/inventory/item.enum.js";
import { LocationFlags } from "../../src/location/location.flags.js";
import type { LocationCreateParameters } from "../../src/location/location.interface.js";
import LocationManager from "../../src/location/location.js";
import { LocationType } from "../../src/location/location.type.js";
import { PlayerClass } from "../../src/player/player.class.js";
import PlayerEntity from "../../src/player/player.entity.js";
import type { ExplorationResult } from "../../src/types/result.js";
import World from "../../src/world.js";
import type Combat from "../../src/combat/combat.js";
import type { GameEvents } from "../../src/events/game-events.js";

export type WorldOptions = NonNullable<ConstructorParameters<typeof World>[0]>;

/** Silences library logging; spies installed with `t.mock.method` still observe every call. */
consola.level = -999;

export let workspace = "";
let previousWorkingDirectory = "";
let worldSequence = 0;
let playerSequence = 0;

// Rationale: 0.5 maps `0.9 + random * 0.2` to exactly 1.0, so class base stats are returned unmodified.
export const NEUTRAL_RANDOM = 0.5;
// Rationale: a registry-wide semver far above any real release, so "update available" is always triggered.
export const FUTURE_VERSION = "999.0.0";
export const REGISTRY_URL = "https://registry.npmjs.org/dragons-of-legends.js/latest";
// Rationale: PlayerManager unloads idle players after 15 minutes (private INACTIVITY_TIME_MS).
export const INACTIVITY_TIME_MS = 15 * 60 * 1000;
export const MONGODB_URI: string | undefined = process.env["MONGODB_URI"];

/**
 * Waits for floating promises (such as the un-awaited `updateMaxHealth`) to settle.
 *
 * @returns A promise resolved after two event-loop turns.
 */
export async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
}

/**
 * Sleeps using the real timer (never the mocked one).
 *
 * @param milliseconds The delay in milliseconds.
 * @returns A promise resolved after the delay.
 */
export async function sleep(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Narrows a nullable value and fails the test when it is missing.
 *
 * @param value The value to check.
 * @param label A label used in the assertion message.
 * @returns The same value, typed as defined.
 * @throws AssertionError If the value is null or undefined.
 */
export function defined<T>(value: T | null | undefined, label = "value"): T {
    assert.ok(value !== null && value !== undefined, `${label} should be defined`);
    return value;
}

/**
 * Replaces `Math.random` for the duration of one test.
 *
 * @param t The test context owning the mock.
 * @param sequence A constant, or a list of values returned in order (the last value repeats forever).
 * @returns void
 */
export function stubRandom(t: TestContext, sequence: number | readonly number[]): void {
    const values = typeof sequence === "number" ? [sequence] : [...sequence];
    let cursor = 0;
    t.mock.method(Math, "random", (): number => values[Math.min(cursor++, values.length - 1)]);
}

/**
 * Creates an isolated world: own SQLite file, no network, no regeneration timer.
 *
 * @param options Overrides merged on top of the test defaults.
 * @returns The new world.
 */
export function createWorld(options: WorldOptions = {}): World {
    worldSequence += 1;
    return new World({
        checkUpdates: false,
        regen: { enabled: false, rate: 5, cooldown: 10 },
        database: { adapter: "file", path: join(workspace, `world-${worldSequence}.db`) },
        ...options
    });
}

/**
 * Reads the SQLite path configured for a world.
 *
 * @param world The world to inspect.
 * @returns The database path.
 */
export function databasePathOf(world: World): string {
    return defined(world.initializationOptions.database?.path, "database path");
}

/**
 * Creates a persisted player with a unique identifier and waits for async initialisation to settle.
 *
 * @param world The world that owns the player.
 * @param playerClass The class of the new player.
 * @returns The created player.
 */
export async function spawn(world: World, playerClass: PlayerClass = PlayerClass.Warrior): Promise<PlayerEntity> {
    playerSequence += 1;
    const player = await world.players.create({ id: `player-${playerSequence}`, name: `Hero ${playerSequence}`, playerClass });
    await settle();
    return player;
}

/**
 * Forces deterministic combat attributes on a player.
 *
 * @param player The player to configure.
 * @returns void
 */
export function fixAttributes(player: PlayerEntity): void {
    player.attributes = { points: 0, strength: 10, agility: 8, intelligence: 3, defense: 8 };
}

/**
 * Builds an item definition.
 *
 * @param itemId The item identifier.
 * @param category The item category.
 * @param rarity The item rarity.
 * @param maxStack The maximum stack size.
 * @returns The item definition.
 */
export function makeItem(
    itemId: string,
    category: ItemCategory = ItemCategory.Materials,
    rarity: ItemRarity = ItemRarity.Common,
    maxStack = 64
): Item {
    return { itemId, name: `Display ${itemId}`, category, rarity, maxStack };
}

/**
 * Builds a combat dummy.
 *
 * @param overrides Optional stat overrides.
 * @returns A new enemy.
 */
export function makeEnemy(
    overrides: Partial<{ type: EnemyType; health: number; strength: number; defense: number; experience: number; gold: number }> = {}
): EnemyEntity {
    const { type = EnemyType.Slime, health = 100, strength = 5, defense = 0, experience = 30, gold = 12 } = overrides;
    // The entity is content-agnostic: the loot table comes from the official definition of the species, if any.
    const loot = OFFICIAL_ENEMIES.find((definition) => definition.id === type)?.loot ?? [];
    return new EnemyEntity(type, "Dummy", health, health, strength, defense, experience, gold, loot);
}

/**
 * Finds the first inventory record for an item.
 *
 * @param player The inventory owner.
 * @param itemId The item identifier.
 * @returns The record, or undefined.
 */
export async function findRecord(player: PlayerEntity, itemId: string): Promise<InventoryItemRecord | undefined> {
    return (await player.inventory.getItems()).find((record) => record.itemId === itemId);
}

/**
 * Sums the quantity of every record of an item.
 *
 * @param player The inventory owner.
 * @param itemId The item identifier.
 * @returns The total quantity.
 */
export async function totalQuantity(player: PlayerEntity, itemId: string): Promise<number> {
    return (await player.inventory.getItems())
        .filter((record) => record.itemId === itemId)
        .reduce((sum, record) => sum + record.quantity, 0);
}

/**
 * Adds an item (optionally with NBT data) and equips it.
 *
 * @param player The inventory owner.
 * @param slot The target equipment slot.
 * @param item The item definition.
 * @param nbt Optional item data.
 * @returns void
 */
export async function giveAndEquip(player: PlayerEntity, slot: EquipmentSlot, item: Item, nbt?: Record<string, unknown>): Promise<void> {
    await player.inventory.add(item, 1, nbt ?? null);
    assert.equal(await player.inventory.equip(slot, item.itemId), true, `equip ${item.itemId} -> ${slot}`);
    await settle();
}

/**
 * Starts a travel with mocked timers and fast-forwards it.
 * The caller must have stubbed `Math.random` beforehand.
 *
 * @param t The test context owning the mocks.
 * @param player The travelling player.
 * @param destination The destination identifier.
 * @param distance The travel distance.
 * @param danger The travel danger level.
 * @returns The exploration result.
 */
export async function travel(t: TestContext, player: PlayerEntity, destination: string, distance = 1, danger = 1): Promise<ExplorationResult> {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = player.moveTo(destination, distance, danger);
    t.mock.timers.tick(60_000);
    return pending;
}

/**
 * Builds raw location parameters with unit-distance connections.
 *
 * @param locationId The location identifier.
 * @param flags The location flags.
 * @param land Land destinations.
 * @param boat Boat destinations.
 * @returns Parameters accepted by `LocationManager.create`.
 */
export function loc(
    locationId: string,
    flags: LocationFlags = LocationFlags.None,
    land: readonly string[] = [],
    boat: readonly string[] = []
): LocationCreateParameters {
    const toRecord = (destinationLocationId: string) => ({ destinationLocationId, travelDistance: 1, dangerLevel: 0 });
    return {
        locationId,
        locationType: LocationType.City,
        locationFlags: flags,
        travelConnections: { landRoutes: land.map(toRecord), boatRoutes: boat.map(toRecord) }
    };
}

/**
 * Builds a valid two-node graph.
 *
 * @returns A validated location manager.
 */
export function validGraph(): LocationManager {
    const manager = new LocationManager();
    manager.bulkCreate([
        manager.add("Home").setType(LocationType.City).setFlags(LocationFlags.StarterCity).linkLand("Field", 2, 1),
        manager.add("Field").setType(LocationType.Village).linkLand("Home", 2, 1)
    ]);
    manager.validate();
    return manager;
}

/**
 * Stubs the npm registry response used by `World.checkForUpdates`.
 *
 * @param t The test context owning the mock.
 * @param respond The fake response factory.
 * @returns The fetch mock, for call inspection.
 */
export function stubRegistry(t: TestContext, respond: () => Promise<Response>) {
    return t.mock.method(globalThis, "fetch", respond);
}

/**
 * Builds a registry response carrying a version.
 *
 * @param version The version to advertise.
 * @returns A successful fake response.
 */
export function registryResponse(version: string): Response {
    return new Response(JSON.stringify({ version }), { status: 200, headers: { "content-type": "application/json" } });
}

/**
 * Registers the hooks that run the current test file inside a throw-away working directory.
 * Call it once at the top of every test file that creates worlds or players.
 *
 * @returns void
 */
export function useIsolatedWorkspace(): void {
    before(() => {
        previousWorkingDirectory = process.cwd();
        workspace = mkdtempSync(join(tmpdir(), "dol-tests-"));
        process.chdir(workspace);
    });

    after(() => {
        process.chdir(previousWorkingDirectory);
        rmSync(workspace, { recursive: true, force: true });
    });
}

/**
 * Builders of synthetic event payloads for tests that drive a bare `EventEngine` (no real world).
 * The entity references are inert stand-ins: listeners under test only read the identifying fields.
 */
export const fakeEvents = {
    enemyDefeat: (fields: { playerId: string; enemyType: string; enemyId?: string; experience?: number; gold?: number; locationId?: string }): GameEvents["enemyDefeat"] => ({
        playerId: fields.playerId,
        player: {} as unknown as PlayerEntity,
        combat: {} as unknown as Combat,
        enemy: {} as unknown as EnemyEntity,
        enemyId: fields.enemyId ?? "x",
        enemyType: fields.enemyType,
        locationId: fields.locationId ?? "nowhere",
        experience: fields.experience ?? 0,
        gold: fields.gold ?? 0
    }),
    playerLevelUp: (playerId: string, previousLevel: number, level: number): GameEvents["playerLevelUp"] => ({
        playerId,
        player: {} as unknown as PlayerEntity,
        previousLevel,
        level,
        attributePoints: 0
    }),
    travelComplete: (playerId: string, fromId = "x", toId = "y", distance = 1): GameEvents["travelComplete"] => ({
        playerId,
        player: {} as unknown as PlayerEntity,
        fromId,
        toId,
        distance,
        durationMs: 0
    }),
    playerDeath: (playerId: string, mode: GameEvents["playerDeath"]["mode"] = "loose"): GameEvents["playerDeath"] => ({
        playerId,
        player: {} as unknown as PlayerEntity,
        mode,
        locationId: "nowhere"
    })
};
