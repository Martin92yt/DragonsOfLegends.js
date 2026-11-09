/**
 * DragonsOfLegends.js — SQLite persistence adapters (player and inventory).
 *
 * Run only this file:  npx tsx --test tests/adapters.test.ts
 * Run everything:      npx tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import Database from "better-sqlite3";

import SqliteInventoryAdapter from "../src/adapters/sqlite-inventory.adapter.js";
import SqlitePlayerAdapter from "../src/adapters/sqlite-player.adapter.js";
import { type InventoryItemRecord } from "../src/inventory/inventory.interface.js";
import { ItemCategory, ItemRarity } from "../src/inventory/item.enum.js";
import { PlayerClass } from "../src/player/player.class.js";
import PlayerDatabase from "../src/player/player.database.js";
import { type PlayerData } from "../src/player/player.interface.js";
import { createWorld, defined, spawn, useIsolatedWorkspace, workspace } from "./helpers/fixtures.js";

useIsolatedWorkspace();

describe("SqlitePlayerAdapter", () => {
    const sample: PlayerData = {
        id: "adapter-1", name: "Ada", classId: PlayerClass.Explorer, locationId: "Embercross", level: 3, experience: 42, health: 50,
        maxHealth: 120, partnerId: "", attributePoints: 2, strength: 7, agility: 8, intelligence: 9, defense: 6, gold: 321, bankGold: 654,
        bankUnlocked: true
    };

    it("round-trips every field and upserts on conflict", () => {
        const adapter = new SqlitePlayerAdapter(createWorld().players, join(workspace, "adapter-player.db"));
        const extras = {
            titles: ["slime_slayer", "gilded_purse"],
            equippedTitleId: "gilded_purse",
            bestiary: { slime: { kills: 3, firstDefeatedAt: 1000 } },
            jobs: { fishing: { level: 2, xp: 5, equippedToolItemId: "wooden_fishing_rod", lastActionAt: { fish: 123 } } },
            deadUntil: 1_900_000_000_000,
            effects: { regeneration: { appliedAt: 1_000, expiresAt: 61_000, lastTickAt: 5_000 } },
            achievements: { first_blood: { progress: { kills: 1 }, unlockedAt: 2_000, rewardsGranted: true } }
        };
        adapter.save({ ...sample, ...extras });
        assert.deepEqual(adapter.get(sample.id), { ...sample, ...extras });
        adapter.save({ ...sample, ...extras, deadUntil: null });
        assert.equal(defined(adapter.get(sample.id)).deadUntil, null, "null is stored as 0 and read back as null");
        adapter.save({ ...sample, gold: 1, bankUnlocked: false });
        assert.equal(defined(adapter.get(sample.id)).gold, 1);
        assert.equal(defined(adapter.get(sample.id)).bankUnlocked, false);
        assert.equal(adapter.count(), 1);
    });

    it("returns undefined for unknown players and reports deletions", () => {
        const adapter = new SqlitePlayerAdapter(createWorld().players, join(workspace, "adapter-player-2.db"));
        assert.equal(adapter.get("ghost"), undefined);
        adapter.save(sample);
        assert.equal(adapter.delete(sample.id), true);
        assert.equal(adapter.delete(sample.id), false);
        assert.equal(adapter.count(), 0);
    });

    it("derives the partner from the Marriage table and clears it on delete", () => {
        const path = join(workspace, "adapter-player-3.db");
        const adapter = new SqlitePlayerAdapter(createWorld().players, path);
        adapter.save(sample);
        adapter.save({ ...sample, id: "adapter-2", name: "Bob" });
        const raw = new Database(path);
        raw.prepare("INSERT INTO Marriage (Player1, Player2, DateStart) VALUES (?, ?, ?)").run(sample.id, "adapter-2", new Date().toISOString());
        raw.close();
        assert.equal(defined(adapter.get(sample.id)).partnerId, "adapter-2");
        assert.equal(defined(adapter.get("adapter-2")).partnerId, sample.id);
        adapter.delete(sample.id);
        assert.equal(defined(adapter.get("adapter-2")).partnerId, "");
    });

    it("migrates legacy schemas by adding the missing columns", () => {
        const path = join(workspace, "legacy.db");
        const legacy = new Database(path);
        legacy.exec(`
            CREATE TABLE Player (Name TEXT NOT NULL, Identifier TEXT NOT NULL UNIQUE, Class TEXT NOT NULL DEFAULT 'unknown', Gold INTEGER NOT NULL DEFAULT 0, LocationId TEXT NOT NULL DEFAULT '');
            CREATE TABLE Stats (Identifier TEXT NOT NULL UNIQUE, Level INTEGER NOT NULL DEFAULT 1, Experience INTEGER NOT NULL DEFAULT 0, Health INTEGER NOT NULL DEFAULT 100, MaxHealth INTEGER NOT NULL DEFAULT 100);
            INSERT INTO Player (Name, Identifier, Class, Gold, LocationId) VALUES ('Old', 'old-1', 'warrior', 9, 'Embercross');
            INSERT INTO Stats (Identifier, Level) VALUES ('old-1', 5);
        `);
        legacy.close();
        const adapter = new SqlitePlayerAdapter(createWorld().players, path);
        const migrated = defined(adapter.get("old-1"));
        assert.equal(migrated.level, 5);
        assert.equal(migrated.gold, 9);
        assert.equal(migrated.bankGold, 0);
        assert.equal(migrated.bankUnlocked, false);
        assert.equal(migrated.strength, 0);
        adapter.save({ ...sample, id: "old-1" });
        assert.equal(defined(adapter.get("old-1")).strength, sample.strength);
    });

    it("is reachable through the PlayerDatabase facade", () => {
        const players = createWorld().players;
        const database = new PlayerDatabase(players);
        database.save({ ...sample, id: "facade-1" });
        assert.equal(defined(database.get("facade-1") as PlayerData | undefined).name, "Ada");
        assert.ok((database.count() as number) >= 1);
        assert.equal(database.delete("facade-1"), true);
    });
});

describe("SqliteInventoryAdapter", () => {
    /**
     * Creates an adapter on a private file.
     *
     * @param name The database file name.
     * @returns The adapter and its file path.
     */
    async function adapterFor(name: string): Promise<{ adapter: SqliteInventoryAdapter; path: string }> {
        const player = await spawn(createWorld());
        const path = join(workspace, name);
        return { adapter: new SqliteInventoryAdapter(player.inventory, path), path };
    }

    const record: InventoryItemRecord = {
        playerId: "inv-owner", itemId: "relic", name: "Relic", category: ItemCategory.Weapons, rarity: ItemRarity.Rare, maxStack: 1,
        description: "An old relic", quantity: 2, itemNbtData: { durability: 7 }, isEquipped: true, equipmentSlot: "sword"
    };

    it("round-trips records (NBT, flags, description)", async () => {
        const { adapter } = await adapterFor("inv-1.db");
        adapter.savePlayerInventory("inv-owner", [record]);
        const [stored] = adapter.getPlayerInventory("inv-owner");
        assert.equal(stored.itemId, "relic");
        assert.equal(stored.quantity, 2);
        assert.equal(stored.category, ItemCategory.Weapons);
        assert.equal(stored.rarity, ItemRarity.Rare);
        assert.equal(stored.maxStack, 1);
        assert.equal(stored.description, "An old relic");
        assert.deepEqual(stored.itemNbtData, { durability: 7 });
        assert.equal(stored.isEquipped, true);
        assert.equal(stored.equipmentSlot, "sword");
    });

    it("keeps the display name", async () => {
        const { adapter } = await adapterFor("inv-2.db");
        adapter.savePlayerInventory("inv-owner", [record]);
        assert.equal(adapter.getPlayerInventory("inv-owner")[0].name, "Relic");
    });

    it("replaces the whole inventory on save and skips invalid rows", async () => {
        const { adapter } = await adapterFor("inv-3.db");
        adapter.savePlayerInventory("inv-owner", [record, { ...record, itemId: "ghost", quantity: 0 }, { ...record, itemId: "" }]);
        assert.deepEqual(adapter.getPlayerInventory("inv-owner").map((entry) => entry.itemId), ["relic"]);
        adapter.savePlayerInventory("inv-owner", []);
        assert.deepEqual(adapter.getPlayerInventory("inv-owner"), []);
    });

    it("isolates inventories per player and clears them", async () => {
        const { adapter } = await adapterFor("inv-4.db");
        adapter.savePlayerInventory("owner-a", [{ ...record, playerId: "owner-a" }]);
        adapter.savePlayerInventory("owner-b", [{ ...record, playerId: "owner-b" }]);
        assert.equal(adapter.clearInventory("owner-a"), true);
        assert.equal(adapter.clearInventory("owner-a"), false);
        assert.equal(adapter.getPlayerInventory("owner-b").length, 1);
    });

    it("falls back safely on corrupted rows", async () => {
        const { adapter, path } = await adapterFor("inv-5.db");
        const raw = new Database(path);
        raw.prepare(
            "INSERT INTO Inventory (playerId, itemId, quantity, nbt, name, category, rarity, maxStack, description, isEquipped, equipmentSlot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run("corrupt", "odd", 1, "{not-json", "Odd", "weird", "weird", 8, null, 1, "weird");
        raw.close();
        const [stored] = adapter.getPlayerInventory("corrupt");
        assert.equal(stored.itemNbtData, null);
        assert.equal(stored.category, ItemCategory.Valuables);
        assert.equal(stored.rarity, ItemRarity.Common);
        assert.equal(stored.equipmentSlot, null);
    });

    it("lists worn items and survives save / close", async () => {
        const { adapter } = await adapterFor("inv-6.db");
        adapter.savePlayerInventory("inv-owner", [record]);
        assert.equal(adapter.getPlayerEquipment("inv-owner").playerId, "inv-owner");
        assert.doesNotThrow(() => adapter.save());
        assert.doesNotThrow(() => adapter.saveAndClose());
        assert.doesNotThrow(() => adapter.saveAndClose(), "closing twice is harmless");
    });
});
