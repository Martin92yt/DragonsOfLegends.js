<div align="center">

# 🐉 DragonsOfLegends.js

**The TypeScript engine for text-based RPGs.**
Players, combat, inventories, economy, jobs, death rules, events and fully moddable content, ready to plug into a Discord bot, a website or any Node.js app.

<p>
  <a href="https://www.npmjs.com/package/dragons-of-legends.js"><img src="https://img.shields.io/npm/v/dragons-of-legends.js?style=for-the-badge&logo=npm&logoColor=white&label=Version&color=CB3837" alt="NPM Version"></a>
  <a href="https://www.npmjs.com/package/dragons-of-legends.js"><img src="https://img.shields.io/npm/dt/dragons-of-legends.js?style=for-the-badge&logo=npm&logoColor=white&label=Downloads&color=CB3837" alt="NPM Downloads"></a>
  <img src="https://img.shields.io/badge/TypeScript-100%25-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="100% TypeScript">
  <a href="https://discord.gg/bwCkQEFWEt"><img src="https://img.shields.io/discord/1547998188621799476?style=for-the-badge&logo=discord&logoColor=white&label=Discord&color=5865F2" alt="Discord"></a>
  <a href="https://github.com/Martin92yt/DragonsOfLegends.js/commits/main"><img src="https://img.shields.io/github/last-commit/Martin92yt/DragonsOfLegends.js?style=for-the-badge&logo=git&logoColor=white&label=Last%20update&color=F05032" alt="Last update"></a>
</p>

[📚 Documentation](https://martin92yt.github.io/DragonsOfLegends.js/) • [🌐 Live demo](https://dragons-of-legends-web.vercel.app) • [📦 NPM](https://www.npmjs.com/package/dragons-of-legends.js) • [🗺️ Roadmap](https://trello.com/b/Tj4XzGtn/dragonsoflegendsjs) • [💬 Discord](https://discord.gg/bwCkQEFWEt)

</div>

---

## Why DragonsOfLegends.js?

Building an RPG means rewriting the same systems again and again. This library gives you the game logic so you can focus on what makes your game unique: the interface, the story and your players.

- 🧱 **100% TypeScript, strict by design.** No `any` in the public API: names, payloads, options and results are all checked by the compiler.
- 🧩 **Modular and moddable.** Nothing is hard-coded: items, enemies, classes, jobs, titles and maps are registries, loaded through **content packs**. The official content is just another pack.
- 📡 **Typed events everywhere.** Every important action (`playerCreate`, `combatStart`, `itemEquip`, `jobAction`...) emits an event carrying the entities involved.
- 🛡️ **Strict, predictable rules.** A dead player is locked out of every action until the respawn time ends, with a dedicated error that tells you how long is left.
- 💾 **Persistence included.** SQLite out of the box, MongoDB as an alternative.
- 🪶 **Clean public API.** The package root only contains what you need; helpers and internals live in dedicated sub-paths.

## Features

| Domain | What you get |
| --- | --- |
| **Players** | Classes, levels, experience, attributes, health, regeneration, marriage, titles |
| **Combat** | Turn-based fights, critical hits, equipment bonuses and durability, ambushes while travelling |
| **Inventory** | Stacks, equipment slots, rarity, item data (NBT), selling |
| **Economy** | Gold bank (with marriage pooling) and item bank with slot capacity |
| **Jobs** | Fishing, mining and woodcutting, plus your own jobs: levels, cooldowns, loot tables, tools with luck/yield/XP modifiers |
| **World** | Locations, travel, boat routes and a validated map graph |
| **Death** | Three modes: timed lockout (`cooldown`), gold and item loss (`loose`), permadeath (`hardcore`) |
| **Progression** | Titles, bestiary with discovery rewards, achievements |
| **Modding** | Generic registries, content packs with dependencies, atomic loading with rollback |
| **Events** | Strongly typed event engine with priorities, filters, `once` and `waitFor` |

## Installation

```bash
npm install dragons-of-legends.js
# or
yarn add dragons-of-legends.js
# or
pnpm add dragons-of-legends.js
```

The package is ESM and ships its own type declarations.

## Quick start

A complete example: a content pack, a world, typed events, a player, a job, titles, the bank, combat and the strict death rules.

```ts
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
```

## Core concepts

### Content packs and registries

Everything playable is registered, never hard-coded. A pack can bring items, enemies, classes, jobs, titles and locations, declare dependencies and run a `setup` hook. If anything is invalid, the whole pack is rolled back.

```ts
world.content.use(expansion);          // after startup
world.items.get("moon_fish");          // typed registries: items, enemies, classes, jobs, titles
```

The official content (map, enemies, classes, titles, fishing, mining and woodcutting) is loaded by default. Start from scratch with `premadeContent: false`.

### Events

Event names follow one convention: `<subject><Verb>` in camelCase. They are emitted **after** the action succeeds, and each payload carries the entities involved.

```ts
world.events.on("playerLevelUp", ({ player, previousLevel, level }) => { /* ... */ });
world.events.on("itemEquip", ({ player, itemId, slot }) => { /* ... */ }, { priority: 10 });

const { result } = await world.events.waitFor("combatTurn", { timeoutMs: 5_000 });
```

| Subject | Events |
| --- | --- |
| World | `worldLaunch`, `contentPackLoad` |
| Player | `playerCreate`, `playerLoad`, `playerUnload`, `playerDelete`, `playerExperienceGain`, `playerLevelUp`, `playerAttributeUpgrade`, `playerGoldChange`, `playerDamage`, `playerDeath`, `playerRevive` |
| Travel | `travelStart`, `travelComplete`, `travelAmbush` |
| Combat | `combatStart`, `combatTurn`, `combatEnd`, `enemyDefeat` |
| Inventory | `itemAdd`, `itemRemove`, `itemEquip`, `itemUnequip`, `itemSell` |
| Banks | `bankUnlock`, `bankDeposit`, `bankWithdraw`, `itemBankDeposit`, `itemBankWithdraw` |
| Jobs | `jobAction`, `jobLevelUp`, `jobToolEquip`, `jobToolUnequip` |
| Progression | `titleGrant`, `titleRevoke`, `titleEquip`, `titleUnequip`, `marriageStart`, `marriageDivorce`, `bestiaryDiscover`, `achievementProgress`, `achievementUnlock` |

### Death rules

Choose how death works with `deathMode`:

| Mode | Behaviour |
| --- | --- |
| `"cooldown"` (default) | The player is locked for `deathCooldown` (`"30s"`, `"5m"`, a number of ms...). Every action throws `PlayerDeadError` with the remaining time. |
| `"loose"` | Immediate respawn with a gold penalty (`deathPenaltyRate`) and, optionally, item loss by rarity (`deathItemLoss`). |
| `"hardcore"` | The character is permanently deleted. |

```ts
const world = new World({
    deathMode: "cooldown",
    deathCooldown: "2m",
    deathRespawn: { healthRatio: 0.5, relocateToStartingCity: true }
});
```

### Choosing a storage

```ts
new World({ database: { adapter: "file", path: "./game.db" } });                          // SQLite
new World({ database: { adapter: "mongodb", uri: "mongodb://localhost:27017", name: "rpg" } }); // MongoDB
```

## Imports

The package root is intentionally small. Everything else is one import away:

| Import | Contents |
| --- | --- |
| `dragons-of-legends.js` | The engine: `World`, managers, entities, enums, registries, content packs, `EventEngine` |
| `dragons-of-legends.js/errors` | Every business error (`PlayerDeadError`, `JobCooldownError`, `BankLockedError`...) |
| `dragons-of-legends.js/events` | The full event API: engine, listener types, `GameEvents` |
| `dragons-of-legends.js/types` | All types and interfaces (no runtime code) |
| `dragons-of-legends.js/official` | The official content: enemies, classes, jobs, titles, map, packs |
| `dragons-of-legends.js/advanced` | Helpers, default constants and serialization functions |

```ts
import { World, PlayerClass } from "dragons-of-legends.js";
import { PlayerDeadError } from "dragons-of-legends.js/errors";
import type { CombatResult, JobDefinition } from "dragons-of-legends.js/types";
```

## Documentation and community

- 📚 [Full API documentation](https://martin92yt.github.io/DragonsOfLegends.js/)
- 🌐 [Live demo](https://dragons-of-legends-web.vercel.app)
- 💬 [Discord server](https://discord.gg/bwCkQEFWEt) for questions and feedback
- 🐛 [Issues](https://github.com/Martin92yt/DragonsOfLegends.js/issues) for bugs and feature requests

> ⚠️ The library is under active development (alpha): the API may still change between minor versions.

## Contributing

Contributions are welcome. Fork the repository, create a branch, and open a pull request. Please keep the code strictly typed (no `any`), documented with TSDoc, and covered by tests:

```bash
npm install
npx tsx --test tests/*.test.ts
```

## License

Distributed under the **MIT** License. See the [`LICENSE`](./LICENSE) file for details.

<div align="center">

**Build your world. Create your legends.**

</div>
