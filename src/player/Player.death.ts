import { consola } from "consola";
import PlayerEntity from "./player.entity.js";

export type DeathResult = 
    | { mode: "hardcore"; deleted: boolean }
    | { mode: "cooldown"; cooldownTime: string }
    | { mode: "loose"; lostGold: number }
    | { mode: "default"; revived: boolean };

/**
 * Handles the death mechanics of a player based on world configuration options.
 * 
 * @param player The player entity that has died.
 * @returns The result of the death processing.
 */
export function handlePlayerDeath(player: PlayerEntity): DeathResult {
    const worldOptions = player.worldInstance.initializationOptions;
    const deathMode = worldOptions.deathMode ?? "cooldown";

    consola.warn(`💀 Player ${player.name} has died! Death Mode: ${deathMode}`);

    switch (deathMode) {
        case "hardcore": {
            player.isDead = true;
            consola.error(`🔥 Hardcore death: ${player.name} has lost everything permanently.`);
            player.worldInstance.players.delete(player.id);
            return { mode: "hardcore", deleted: true };
        }

        case "cooldown": {
            player.isDead = true;
            const cooldownTime = worldOptions.deathCooldown ?? "1m";
            consola.info(`⏳ ${player.name} is dead and resting. Cooldown: ${cooldownTime}`);
            return { mode: "cooldown", cooldownTime };
        }

        case "loose": {
            const penaltyRate = worldOptions.deathPenaltyRate ?? 5; // ex: 5%
            const lostGold = Math.floor(player.gold * (penaltyRate / 100));
            
            player.gold = Math.max(0, player.gold - lostGold);
            player.health.current = player.health.max; // Réanimation directe avec pénalité
            
            consola.info(`💸 Loose death: ${player.name} lost ${lostGold} gold (${penaltyRate}% penalty).`);
            return { mode: "loose", lostGold };
        }

        default: {
            player.health.current = player.health.max;
            return { mode: "default", revived: true };
        }
    }
}