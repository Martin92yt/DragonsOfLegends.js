/**
 * DragonsOfLegends.js — Public API surface, enums and type guards.
 *
 * Run only this file:  npx tsx --test tests/public-api.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EnemyType, isEnemyType } from "../src/enemy/enemy.type.js";
import { ItemCategory, ItemRarity, VALID_EQUIPMENT_SLOTS, isEquipmentSlot, isItemCategory, isItemRarity } from "../src/inventory/item.enum.js";
import { LocationType, isLocationType } from "../src/location/location.type.js";
import { PlayerClass, isPlayerClass } from "../src/player/player.class.js";
import * as publicApi from "../src/index.js";
import { useIsolatedWorkspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("Public API surface", () => {
    it("exports every documented symbol", () => {
        const expected = [
            "World", "PlayerMarriage", "PlayerEntity", "PlayerManager", "PlayerClass", "EnemyManager", "EnemyEntity", "EnemyType",
            "CombatManager", "Combat", "ItemCategory", "ItemRarity", "InventoryEntity", "LocationManager", "LocationBuilder",
            "LocationFlags", "LocationType", "BankClass",
            "EventEngine", "EventEngineError", "EventListenerError", "EventTimeoutError", "EventAbortedError",
            "AchievementManager", "AchievementError", "InvalidAchievementError", "DuplicateAchievementError", "UnknownAchievementError",
            "AchievementSerializationError", "ACHIEVEMENT_SNAPSHOT_VERSION", "parsePlayerSnapshot", "parseDump",
            "TitleManager", "PlayerTitles", "TitleRarity", "TITLE_RARITY_WEIGHTS", "OFFICIAL_TITLES", "registerOfficialTitles", "createTitleRewardHandler",
            "handlePlayerDeath", "resolveDeathItemLossConfig", "DEFAULT_DEATH_LOSS_RATES",
            "ItemBank", "DEFAULT_ITEM_BANK_CAPACITY_SLOTS", "resolveItemBankCapacity",
            "PlayerLife", "resolveDeathRespawnConfig", "parseDuration", "PlayerDeadError", "InvalidDurationError", "InvalidDeathRespawnError",
            "BestiaryManager", "PlayerBestiary", "BESTIARY_SPECIES", "DEFAULT_DISCOVERY_GOLD", "BESTIARY_UNKNOWN_LABEL", "parseBestiaryState",
            "JobManager", "PlayerJobs", "FISHING_JOB", "MINING_JOB", "WOODCUTTING_JOB", "OFFICIAL_JOBS", "applyYield", "registerOfficialJobs", "parsePlayerJobsState", "RARITY_LUCK_FACTORS",
            "xpRequiredForLevel", "effectiveCooldownMs", "readToolModifiers", "pickLootEntry", "DEFAULT_JOB_MAX_LEVEL", "DEFAULT_JOB_XP_CURVE",
            "JOB_TOOL_NBT_KEYS", "MAX_COOLDOWN_REDUCTION_PERCENT",
            "Registry", "EnemyRegistry", "ItemRegistry", "PlayerClassRegistry", "ContentManager", "defineContentPack", "createOfficialPacks", "OFFICIAL_PACK_IDS",
            "DEFAULT_ENEMY_SPAWN_RULES", "OFFICIAL_ENEMIES", "registerOfficialEnemies", "OFFICIAL_CLASSES", "registerOfficialClasses", "createOfficialLocations",
            "RegistryError", "InvalidRegistryEntryError", "DuplicateRegistryEntryError", "UnknownRegistryEntryError", "RegistryLockedError",
            "NoEnemyAvailableError", "ContentPackError", "InvalidContentPackError", "DuplicateContentPackError", "MissingPackDependencyError"
        ];
        for (const symbol of expected) {
            assert.ok(symbol in publicApi, `missing export: ${symbol}`);
        }
    });

    it("exposes the default export used by the README quick start", () => {
        assert.ok("default" in publicApi);
    });
});

describe("Enums and type guards", () => {
    it("validates player classes", () => {
        for (const value of Object.values(PlayerClass)) assert.equal(isPlayerClass(value), true);
        assert.equal(isPlayerClass("mage"), false);
        assert.equal(isPlayerClass(undefined), false);
    });

    it("validates enemy types", () => {
        for (const value of Object.values(EnemyType)) assert.equal(isEnemyType(value), true);
        assert.equal(isEnemyType("dragonling"), false);
        assert.equal(isEnemyType(42), false);
    });

    it("validates location types", () => {
        for (const value of Object.values(LocationType)) assert.equal(isLocationType(value), true);
        assert.equal(isLocationType("castle"), false);
    });

    it("validates item categories, rarities and equipment slots", () => {
        for (const value of Object.values(ItemCategory)) assert.equal(isItemCategory(value), true);
        for (const value of Object.values(ItemRarity)) assert.equal(isItemRarity(value), true);
        for (const value of VALID_EQUIPMENT_SLOTS) assert.equal(isEquipmentSlot(value), true);
        assert.equal(isItemCategory("junk"), false);
        assert.equal(isItemRarity("mythic"), false);
        assert.equal(isEquipmentSlot("cape"), false);
        assert.equal(VALID_EQUIPMENT_SLOTS.length, 9);
    });
});
