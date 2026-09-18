<div align="center">

### [📚 Documentation](https://martin92yt.github.io/DragonsOfLegends.js/) • [🌐 Demo](https://dragons-of-legends-web.vercel.app) • [📦 NPM](https://www.npmjs.com/package/dragons-of-legends.js) • [🗺️ Trello](https://trello.com/b/Tj4XzGtn/dragonsoflegendsjs) • [🐙 GitHub](https://github.com/Martin92yt/DragonsOfLegends.js) • [💬 Discord](https://discord.gg/bwCkQEFWEt)

</div>

# 🐉 DragonsOfLegends.js

**A TypeScript library for creating and structuring your text-based RPGs.**

<div> 
  <p> 
    <a href="https://www.npmjs.com/package/dragons-of-legends.js"> <img src="https://img.shields.io/npm/v/dragons-of-legends.js?style=for-the-badge&logo=npm&logoColor=white&label=Version&color=CB3837" alt="NPM Version"> </a> 
    <a href="https://dragons-of-legends-web.vercel.app"> 
      <img src="https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=rocket&logoColor=white" alt="Live Demo"> 
    </a>
    <a href="https://www.npmjs.com/package/dragons-of-legends.js"> <img src="https://img.shields.io/npm/dt/dragons-of-legends.js?style=for-the-badge&logo=npm&logoColor=white&label=Downloads&color=CB3837" alt="NPM Downloads"> </a> 
    <a href="https://discord.gg/bwCkQEFWEt"> <img src="https://img.shields.io/discord/1547998188621799476?style=for-the-badge&logo=discord&logoColor=white&label=Discord&color=5865F2" alt="Discord Server"> </a> 
    <a href="https://github.com/Martin92yt/DragonsOfLegends.js/commits/main"> <img src="https://img.shields.io/github/last-commit/Martin92yt/DragonsOfLegends.js?style=for-the-badge&logo=git&logoColor=white&label=Last%20update&color=F05032" alt="Last update"> </a> 
  </p> 
</div>

> 🚀 **Want to try it out right away?** Give our [Online Demo](https://dragons-of-legends-web.vercel.app) a spin to see the library in action!

## About

**DragonsOfLegends.js** is a **TypeScript** library designed to simplify the development of text-based role-playing games. 

The main goal is to save you from the tedious task of building all game logic from scratch. The library handles data structures behind the scenes (players, inventories, combat, economy, worlds) using ready-to-use entities. 

Thus, **you can focus entirely on what matters most: the interface, the story, and your players' experience**, whether you are powering a Discord RPG bot, a website, or any other JavaScript application.


## Quick Start

### Installation

```bash
# npm
npm install dragons-of-legends.js

# Yarn
yarn add dragons-of-legends.js

# pnpm
pnpm add dragons-of-legends.js


```

### Basic Example

```typescript
import World, { PlayerClass } from "dragons-of-legends.js";

const world = new World({ useWorld: true });

// Create a player
const player = world.players.create({
    id: "Player001",
    name: "OneXPlayerX_",
    playerClass: PlayerClass.Explorer,
    locationId: world.location.getStartingCityId(),
});

// The library returns a structured object (PlayerEntity) containing 
// all the data, inventory, and sub-systems of the player.
console.log(player);
/*
PlayerEntity {
  id: 'Player001',
  name: 'OneXPlayerX_',
  classId: 'explorer',
  location: 'Embercross',
  level: 1,
  gold: 0,
  experience: { current: 0, required: 100 },
  health: { current: 100, max: 110 },
  attributes: { points: 0, strength: 5, agility: 11, intelligence: 6, defense: 5 },
  inventory: InventoryEntity { ... },
  marriage: PlayerMarriage { ... },
  isTravelling: false,
  inCombat: false
}
*/


```

## License

Distributed under the **MIT** License. See the `LICENSE` file for more information.

**Build your world. Create your legends.**

*Made with TypeScript and AI-assisted development.*