import { World, PlayerClass } from "./src/index";


const world = new World({
    premadeMap: true,
    checkUpdates: false,
    
    database: {
        adapter: "file",
        path: "./data/data.db",
    },

    deathMode: "cooldown",
    deathCooldown: "1m",
    deathPenaltyRate: 5,

    starterGold: 150,
    starterItems: {
        health_potion: 3,
        rusty_sword: 1,
    },

    bankUnlockCost: 1000,
    bankCapacitySlots: 50,
    bankMaxGoldLimit: 500000,
});

const player = world.players.create({
    id: "player_001",
    name: "Arthas",
    playerClass: PlayerClass.Warrior,
});

console.log(player);
