<h1 align="center">🐉 DragonsOfLegends.js</h1> <p align="center"> <strong>A TypeScript library for building text-based RPGs, inventory systems, and adventure mechanics.</strong> </p> <p align="center"> <a href="https://discord.gg/bwCkQEFWEt"> <img src="https://img.shields.io/discord/1547998188621799476?style=for-the-badge&logo=discord&logoColor=white&label=Join%20us%20on%20Discord&color=5865F2" alt="Join us on Discord"> </a> <a href="https://www.npmjs.com/package/dragonsoflegends.js"> <img src="https://img.shields.io/npm/v/dragonsoflegends.js?style=for-the-badge&logo=npm&logoColor=white&label=npm" alt="NPM Version"> </a> <a href="https://www.npmjs.com/package/dragonsoflegends.js"> <img src="https://img.shields.io/npm/dm/dragonsoflegends.js?style=for-the-badge&logo=npm&logoColor=white&label=downloads" alt="NPM Downloads"> </a> <a href="https://github.com/Martin92yt/DragonsOfLegends.js/commits/main"> <img src="https://img.shields.io/github/last-commit/Martin92yt/DragonsOfLegends.js?style=for-the-badge&logo=git&logoColor=white" alt="Last Commit"> </a> <a href="https://github.com/Martin92yt/DragonsOfLegends.js"> <img src="https://img.shields.io/github/stars/Martin92yt/DragonsOfLegends.js?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Stars"> </a> </p> <p align="center"> <a href="#-about">About</a> • <a href="#-features">Features</a> • <a href="#-installation">Installation</a> • <a href="#-usage">Usage</a> • <a href="#-documentation">Documentation</a> • <a href="#-roadmap">Roadmap</a> • <a href="#-contributing">Contributing</a> </p>

 ## 📖 About

 **DragonsOfLegends.js** is a **TypeScript** library designed to make it easier to build **text-based role-playing games (RPGs)** and their various mechanics.

 The project provides a modular foundation for progressively building an RPG with different systems:

 - 👤 Characters and statistics
- 🎒 Inventory and items
- ⚔️ Equipment and durability
- 💥 Combat and damage
- 💰 Economy
- 🎁 Loot and rewards
- 🗺️ Adventure mechanics

 The goal is to provide a flexible library that can be adapted to different RPG projects while keeping the API simple and easy to understand.

 > 🚧 **The project is currently in alpha.**
>  The API and some features may change as development progresses.

---

 ## 💬 Join the Community

 <p align="center"> <a href="https://discord.gg/bwCkQEFWEt"> <img src="https://img.shields.io/badge/Join%20the%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join the Discord"> </a> </p> The project is still young, and **your feedback is especially important**.

 Whether you're a developer, RPG creator, or simply curious about the project, feel free to join the community and share your thoughts.

 You can share:

 - 💡 Feature ideas
- 🎮 RPG mechanics you'd like to see
- 🐛 Bugs or unexpected behavior
- 🧩 API suggestions
- 📚 Documentation feedback
- 💭 Ideas for improvements
- 💬 Or simply a constructive comment

 **You don't need to contribute code to help the project.**

 Even a simple comment or idea can help significantly improve the library.

 👉 **[Join the Discord server](<https://discord.gg/bwCkQEFWEt>)**

---

 ## ✨ Features

 ### 🎒 Inventory & Equipment

 A flexible system for managing character items and equipment.

 - 📦 Inventory management
- 🗂️ Item categories
- ⚔️ Equipment system
- 🧩 Equipment slots
- 🔨 Item durability
- 🔄 Item management and modification
- 🛠️ Extensible system for creating custom item types

 ### ⚔️ Characters & Statistics

 Characters have various systems for building their own RPG profiles.

 - 🧙 Character classes
- 📊 Statistics and attributes
- 💪 Customizable characteristics
- 🎲 Damage rolls
- 💥 Critical hits
- ⚔️ Combat mechanics
- 🔧 Customizable systems

 ### 💰 Economy & Loot

 A collection of mechanics for building your RPG's economy and reward systems.

 - 💰 Currencies and values
- 🎁 Reward systems
- 🎲 Loot
- 📦 Item generation
- 🏆 Customizable rewards
- 🔮 Loot tables

---

 ## 📦 Installation

 ### npm

```
npm install dragonsoflegends.js
```

 ### Yarn

```
yarn add dragonsoflegends.js
```

 ### pnpm

```
pnpm add dragonsoflegends.js
```

---

 ## 🚀 Usage

 ### Quick Example

 Here is a simple example showing how to create a world, create a player, and give them a weapon:

```
import World, {
    ItemCategory,
    ItemRarity,
    PlayerClass,
} from "../packages/src/world";

const rpg = new World({
    useWorld: true,
});

const player = rpg.players.create({
    id: "Player001",
    name: "OneXPlayerX_",
    playerClass: PlayerClass.Explorer,
    locationId: rpg.location.getStartingCityId(),
});

player.inventory.add(
    {
        itemId: "iron_sword",
        name: "Iron Sword",
        category: ItemCategory.Weapons,
        rarity: ItemRarity.Common,
        data: {
            damageBonus: 5,
            durability: 100,
        },
    },
    1,
);

console.log(player);
```

 ### 🎲 Damage Handling

```
const damage = player.takeDamage(1);

console.log(`⚔️ Damage dealt: ${damage?.rawDamage}`);
```

 > ⚠️ As the API is still under development, some elements may change before the first stable release.

---

 ## 🧱 Architecture

 DragonsOfLegends.js is organized around several independent systems to make the project easier to evolve.

```
DragonsOfLegends.js
│
├── 👤 Characters
│   ├── Classes
│   ├── Attributes
│   ├── Statistics
│   └── Combat
│
├── 🎒 Inventory
│   ├── Items
│   ├── Categories
│   ├── Equipment
│   ├── Slots
│   └── Durability
│
├── 💰 Economy
│   ├── Currency
│   ├── Rewards
│   └── Transactions
│
└── 🎁 Loot
    ├── Loot Tables
    ├── Drops
    └── Rewards
```

 This architecture aims to keep the project **modular, extensible, and easy to maintain**.

---

 ## 📚 Documentation

 > 🚧 **Documentation is currently being created.**

 Two documentation resources are planned:

 ### 🔌 API — Developers

 Documentation focused on developers who want to use **DragonsOfLegends.js** in their own projects.

 It will cover the library's API, classes, methods, parameters, systems, and code examples.

 ### 📖 Guide — Users

 A practical guide for users who want to understand **how to build their RPG with DragonsOfLegends.js** without having to know the entire API.

 It will cover topics such as:

 - 👹 Creating an enemy
- ⚔️ Configuring enemy statistics
- 💥 Setting up damage
- 🎁 Configuring loot
- 📊 Setting drop rates
- 🗺️ Creating and managing parts of the game world
- 🎒 Configuring rewards and items

---

 ## 🗺️ Roadmap

 > 🚧 **The detailed roadmap will be available soon.**

 The project is currently in alpha, so features and priorities may evolve depending on development and community feedback.

---

 ## 🤖 Transparency

 I want to be transparent about how this project is being developed.

 **DragonsOfLegends.js was developed largely with the help of AI, using a "vibe-coding" approach.**

 This means that parts of the code and project content were generated or developed with the assistance of artificial intelligence tools.

 Since the project is still young, it may contain questionable design choices, imperfections, or areas that could be improved.

 I'm still learning, and **constructive criticism is genuinely welcome**.

 If you find something that could be improved, have an idea, or simply want to point something out, **please come and discuss it on Discord**.

 👉 **[Share feedback on Discord](<https://discord.gg/bwCkQEFWEt>)**

---

 ## 🤝 Contributing

 For now, the best way to contribute to the project is to **share your ideas and feedback**.

 You can suggest:

 - 💡 New features
- ⚔️ New RPG mechanics
- 🧩 API improvements
- 🐛 Bug reports
- 📚 Documentation improvements
- 🏗️ Architecture suggestions
- 💭 Any other idea that could improve the project

 ### 💬 Even a simple comment helps

 You don't need to know how to code or use TypeScript to contribute to the project.

 If you simply think:

 > "This feature could be done better."

 or:

 > "Why not add this mechanic?"

 **Don't hesitate to say it.**

 Constructive feedback is exactly what can help DragonsOfLegends.js grow and improve.

 👉 **[Join the Discord and share your feedback](<https://discord.gg/bwCkQEFWEt>)**

---

 ## 🔗 Useful Links

 | Resource | Link |
| --- | --- |
| 💬 **Discord** | [Join the server](<https://discord.gg/bwCkQEFWEt>) |
| 🐙 **GitHub** | [Martin92yt/DragonsOfLegends.js](<https://github.com/Martin92yt/DragonsOfLegends.js>) |
| 📦 **NPM** | [View package](<https://www.npmjs.com/package/dragonsoflegends.js>) |
| 📋 **Trello** | Coming soon |
| 📚 **Documentation** | Currently being created |

---

 ## 📄 License

 > ⚠️ **The project license has not been defined yet.**

 A license will be added before the first stable release.

---

 ## 🐉 DragonsOfLegends.js

 <p align="center"> <strong>Build your world. Create your legends.</strong> <br> <sub>Made with ❤️, TypeScript & AI-assisted development.</sub> </p> <p align="center"> <a href="https://discord.gg/bwCkQEFWEt"> 💬 Join the community </a> </p>