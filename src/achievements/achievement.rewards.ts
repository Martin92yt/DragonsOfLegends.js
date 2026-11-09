import { PlayerNoCharacterError } from "../types/error.js";
import type World from "../world.js";
import type { RewardHandler } from "./achievement.types.js";

/**
 * Creates the reward handler of the world: it pays the rewards of an achievement to the player.
 *
 * - `gold` is added to the wallet, `experience` goes through `gainXP` (amulets and potions apply),
 * - `item` enters the inventory (with the default item data of its definition),
 * - `title` is granted to the player.
 *
 * It fails when the player cannot be found or the reward references unknown content: the unlock is kept
 * and the reward stays pending (see `AchievementManager.claimPendingRewards`).
 *
 * @param world The world holding the players and the catalogue.
 * @returns A reward handler for `AchievementManager`.
 * @throws {PlayerNoCharacterError} When the rewarded player cannot be found.
 * @throws {UnknownRegistryEntryError} When the rewarded item is not registered.
 * @throws {UnknownTitleError} When the rewarded title is not registered.
 */
export function createPlayerRewardHandler(world: World): RewardHandler {
    return async (playerId, reward) => {
        const player = await world.players.get(playerId);
        if (!player) throw new PlayerNoCharacterError();

        switch (reward.kind) {
            case "gold":
                player.gold += reward.amount;
                return;
            case "experience":
                await player.gainXP(reward.amount);
                return;
            case "item":
                await player.inventory.add(world.items.require(reward.itemId), reward.quantity);
                return;
            case "title":
                await player.titles.grant(reward.titleId);
                return;
        }
    };
}
