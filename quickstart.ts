import { World, PlayerClass, ItemCategory, ItemRarity, TitleRarity, defineContentPack } from "dragons-of-legends.js";
import { PlayerDeadError } from "dragons-of-legends.js/errors";

// 1. A content pack: your own items, jobs and titles, loaded next to the official content.
const moonFish = { itemId: "moon_fish", name: "Moon Fish", category: ItemCategory.Materials, rarity: ItemRarity.Rare, maxStack: 64 };

const expansion = defineContentPack({
    id: "moonlit-lake",
    name: "Moonlit Lake",
    version: "1.0.0",
    items: [moonFish],
    jobs: [
        {
            id: "night_fishing",
            name: "Night fishing",
            actions: [
                {
                    id: "cast",
                    name: "Cast the line",
                    cooldownMs: 5_000,
                    xp: 60,
                    loot: [{ item: moonFish, weight: 1, minQuantity: 1, maxQuantity: 3 }]
                }
            ]
        }
    ],
    titles: [{ id: "moon_angler", name: "Moon Angler", rarity: TitleRarity.Rare }]
});

// 2. The world: storage, death rules and content in one place.
const world = new World({
    database: { adapter: "file", path: "./game.db" },
    deathMode: "cooldown",
    deathCooldown: "1m",
    starterGold: 500,
    bankUnlockCost: 100,
    packs: [expansion]
});

// 3. Typed events: names, payloads and entities are all checked by the compiler.
world.events.on("jobLevelUp", ({ player, jobId, level }) => {
    console.log(`${player.name} reached level ${level} in ${jobId}!`);
});
world.events.on("enemyDefeat", async ({ player, enemy, gold }) => {
    console.log(`${player.name} defeated ${enemy.name} (+${gold} gold)`);
});

// 4. Players
const hero = await world.players.create({ id: "hero-1", name: "Aria", playerClass: PlayerClass.Warrior });

// 5. Jobs
const fishing = await hero.jobs.perform("night_fishing", "cast");
console.log(`Caught ${fishing.loot.map(({ item, quantity }) => `${quantity}x ${item.name}`).join(", ")}`);

// 6. Titles and economy
await hero.titles.grant("moon_angler");
await hero.titles.equip("moon_angler");
world.bank.unlock(hero);
await world.bank.deposit(hero, 50);

// 7. Combat
world.combat.start(hero);
const turn = await world.combat.attack(hero.id);
console.log(turn.victory ? "Victory!" : `The enemy has ${turn.enemyHealth} HP left`);

// 8. Strict death: a dead player cannot act until the cooldown ends
try {
    await hero.takeDamage(99_999);
    await hero.jobs.perform("night_fishing", "cast");
} catch (error) {
    if (error instanceof PlayerDeadError) console.log(`Dead: back in ${Math.ceil(error.remainingMs / 1000)}s`);
}
