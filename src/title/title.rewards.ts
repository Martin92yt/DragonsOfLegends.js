import type { RewardHandler } from "../achievements/achievement.types.js";
import { PlayerNoCharacterError } from "../types/error.js";
import type World from "../world.js";

/**
 * Creates an achievement reward handler that grants `title` rewards to players.
 *
 * Other reward kinds are forwarded to `next`.
 *
 * @param world The world holding the players.
 * @param next Optional handler for the other reward kinds (gold, items, ...).
 * @returns A reward handler for `AchievementManager`.
 * @throws {PlayerNoCharacterError} When the rewarded player cannot be found (the reward stays pending).
 * @throws {UnknownTitleError} When the rewarded title is not registered (the reward stays pending).
 */
export function createTitleRewardHandler(world: World, next?: RewardHandler): RewardHandler {
    return async (playerId, reward, achievement) => {
        if (reward.kind !== "title") {
            await next?.(playerId, reward, achievement);
            return;
        }

        const player = await world.players.get(playerId);
        if (!player) throw new PlayerNoCharacterError();
        await player.titles.grant(reward.titleId);
    };
}
