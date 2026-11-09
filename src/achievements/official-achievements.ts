import type { AchievementDefinition } from "./achievement.types.js";

/**
 * Achievements shipped with the official pack, from the easiest to the most extreme.
 *
 * They need the official titles and items (the `dol:achievements` pack depends on `dol:titles` and `dol:items`).
 * Every title of the official ladder is earned through one of them.
 */
export const OFFICIAL_ACHIEVEMENTS: readonly AchievementDefinition[] = [
    // ── Tier 1: first steps ────────────────────────────────────────────────
    {
        id: "first_blood",
        name: "First Blood",
        description: "Defeat your first monster.",
        category: "combat",
        criteria: [{ id: "kills", event: "enemyDefeat", target: 1 }],
        rewards: [{ kind: "gold", amount: 20 }, { kind: "title", titleId: "first_blood" }]
    },
    {
        id: "pouch_opener",
        name: "What's Inside?",
        description: "Open your first mystery pouch.",
        category: "loot",
        criteria: [{ id: "opened", event: "lootboxOpen", target: 1 }],
        rewards: [{ kind: "gold", amount: 25 }, { kind: "title", titleId: "pouch_opener" }]
    },
    {
        id: "level_5",
        name: "Apprentice",
        description: "Reach level 5.",
        category: "progression",
        criteria: [{ id: "level", event: "playerLevelUp", target: 5, mode: "max", value: (payload) => payload.level }],
        rewards: [{ kind: "item", itemId: "health_potion", quantity: 3 }, { kind: "title", titleId: "apprentice" }]
    },
    // ── Tier 2: dedication ─────────────────────────────────────────────────
    {
        id: "slime_slayer",
        name: "Slime Slayer",
        description: "Defeat 50 slimes.",
        category: "combat",
        criteria: [{ id: "slimes", event: "enemyDefeat", target: 50, filter: (payload) => payload.enemyId === "slime" }],
        rewards: [{ kind: "gold", amount: 100 }, { kind: "title", titleId: "slime_slayer" }]
    },
    {
        id: "goblin_hunter",
        name: "Goblin Hunter",
        description: "Defeat 50 goblins.",
        category: "combat",
        criteria: [{ id: "goblins", event: "enemyDefeat", target: 50, filter: (payload) => payload.enemyId === "goblin" }],
        rewards: [{ kind: "gold", amount: 150 }, { kind: "title", titleId: "goblin_hunter" }]
    },
    {
        id: "bandit_bane",
        name: "Bandit's Bane",
        description: "Defeat 50 bandits.",
        category: "combat",
        criteria: [{ id: "bandits", event: "enemyDefeat", target: 50, filter: (payload) => payload.enemyId === "bandit" }],
        rewards: [{ kind: "gold", amount: 200 }, { kind: "title", titleId: "bandit_bane" }]
    },
    {
        id: "savvy_shopper",
        name: "Savvy Shopper",
        description: "Make 10 purchases in the shops.",
        category: "economy",
        criteria: [{ id: "purchases", event: "shopBuy", target: 10 }],
        rewards: [{ kind: "item", itemId: "pouch_common", quantity: 1 }, { kind: "title", titleId: "savvy_shopper" }]
    },
    {
        id: "potion_enthusiast",
        name: "Potion Enthusiast",
        description: "Use 25 consumables.",
        category: "consumables",
        criteria: [{ id: "uses", event: "itemUse", target: 25, value: (payload) => payload.quantity }],
        rewards: [{ kind: "item", itemId: "regeneration_potion", quantity: 3 }, { kind: "title", titleId: "potion_enthusiast" }]
    },
    {
        id: "lucky_one",
        name: "Lucky One",
        description: "Open 10 mystery pouches.",
        category: "loot",
        criteria: [{ id: "opened", event: "lootboxOpen", target: 10 }],
        rewards: [{ kind: "item", itemId: "luck_amulet", quantity: 1 }, { kind: "title", titleId: "lucky_one" }]
    },
    {
        id: "level_10",
        name: "Rising Hero",
        description: "Reach level 10.",
        category: "progression",
        criteria: [{ id: "level", event: "playerLevelUp", target: 10, mode: "max", value: (payload) => payload.level }],
        rewards: [{ kind: "gold", amount: 250 }, { kind: "item", itemId: "pouch_common", quantity: 2 }]
    },
    // ── Tier 3: long-term goals ────────────────────────────────────────────
    {
        id: "seasoned_traveller",
        name: "Seasoned Traveller",
        description: "Complete 100 journeys.",
        category: "exploration",
        criteria: [{ id: "journeys", event: "travelComplete", target: 100 }],
        rewards: [{ kind: "experience", amount: 500 }, { kind: "title", titleId: "seasoned_traveller" }]
    },
    {
        id: "gilded_purse",
        name: "Gilded Purse",
        description: "Carry 10 000 gold at once.",
        category: "economy",
        criteria: [{ id: "gold", event: "playerGoldChange", target: 10_000, mode: "max", value: (payload) => payload.current }],
        rewards: [{ kind: "item", itemId: "pouch_rare", quantity: 1 }, { kind: "title", titleId: "gilded_purse" }]
    },
    {
        id: "level_20",
        name: "Veteran",
        description: "Reach level 20.",
        category: "progression",
        criteria: [{ id: "level", event: "playerLevelUp", target: 20, mode: "max", value: (payload) => payload.level }],
        rewards: [{ kind: "item", itemId: "xp_amulet", quantity: 1 }, { kind: "title", titleId: "veteran" }]
    },
    {
        id: "monster_hunter",
        name: "Monster Hunter",
        description: "Defeat 200 monsters.",
        category: "combat",
        criteria: [{ id: "kills", event: "enemyDefeat", target: 200 }],
        rewards: [{ kind: "item", itemId: "critical_amulet", quantity: 1 }, { kind: "title", titleId: "monster_hunter" }]
    },
    {
        id: "treasure_hunter",
        name: "Treasure Hunter",
        description: "Open 50 mystery pouches.",
        category: "loot",
        criteria: [{ id: "opened", event: "lootboxOpen", target: 50 }],
        rewards: [{ kind: "item", itemId: "pouch_epic", quantity: 1 }, { kind: "title", titleId: "treasure_hunter" }]
    },
    // ── Tier 4: feats ──────────────────────────────────────────────────────
    {
        id: "lich_breaker",
        name: "Lichbreaker",
        description: "Defeat a Supreme Lich.",
        category: "boss",
        criteria: [{ id: "lich", event: "enemyDefeat", target: 1, filter: (payload) => payload.enemyId === "lich" }],
        rewards: [{ kind: "item", itemId: "pouch_epic", quantity: 1 }, { kind: "title", titleId: "lich_breaker" }]
    },
    {
        id: "demon_bane",
        name: "Demon Bane",
        description: "Defeat a Demon Lord.",
        category: "boss",
        criteria: [{ id: "demon", event: "enemyDefeat", target: 1, filter: (payload) => payload.enemyId === "demon_lord" }],
        rewards: [{ kind: "item", itemId: "pouch_epic", quantity: 1 }, { kind: "title", titleId: "demon_bane" }]
    },
    {
        id: "dragon_slayer",
        name: "Dragon Slayer",
        description: "Defeat an Ancient Dragon.",
        category: "boss",
        criteria: [{ id: "dragon", event: "enemyDefeat", target: 1, filter: (payload) => payload.enemyId === "ancient_dragon" }],
        rewards: [{ kind: "item", itemId: "pouch_legendary", quantity: 1 }, { kind: "title", titleId: "dragon_slayer" }]
    },
    {
        id: "boss_hunter",
        name: "Boss Hunter",
        description: "Defeat 25 bosses.",
        category: "boss",
        criteria: [{ id: "bosses", event: "enemyDefeat", target: 25, filter: (payload) => payload.tier === "boss" }],
        rewards: [{ kind: "item", itemId: "steel_sword", quantity: 1 }, { kind: "title", titleId: "boss_hunter" }]
    },
    {
        id: "level_40",
        name: "Master",
        description: "Reach level 40.",
        category: "progression",
        criteria: [{ id: "level", event: "playerLevelUp", target: 40, mode: "max", value: (payload) => payload.level }],
        rewards: [{ kind: "item", itemId: "pouch_epic", quantity: 2 }, { kind: "title", titleId: "master" }]
    },
    // ── Tier 5: the extreme end ────────────────────────────────────────────
    {
        id: "level_50",
        name: "Legend of the Realm",
        description: "Reach level 50.",
        category: "progression",
        criteria: [{ id: "level", event: "playerLevelUp", target: 50, mode: "max", value: (payload) => payload.level }],
        rewards: [{ kind: "item", itemId: "pouch_legendary", quantity: 1 }, { kind: "title", titleId: "realm_legend" }]
    },
    {
        id: "apex_predator",
        name: "Apex Predator",
        description: "Defeat 1 000 monsters.",
        category: "combat",
        criteria: [{ id: "kills", event: "enemyDefeat", target: 1_000 }],
        rewards: [{ kind: "item", itemId: "pouch_legendary", quantity: 2 }, { kind: "title", titleId: "apex_predator" }]
    },
    {
        id: "eternal_champion",
        name: "Eternal Champion",
        description: "Reach level 50, defeat 100 bosses and open 100 mystery pouches.",
        category: "progression",
        hidden: true,
        criteria: [
            { id: "level", event: "playerLevelUp", target: 50, mode: "max", value: (payload) => payload.level },
            { id: "bosses", event: "enemyDefeat", target: 100, filter: (payload) => payload.tier === "boss" },
            { id: "opened", event: "lootboxOpen", target: 100 }
        ],
        rewards: [{ kind: "gold", amount: 100_000 }, { kind: "title", titleId: "eternal_champion" }]
    }
];
