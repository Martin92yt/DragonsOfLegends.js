import { countAvailable } from "../inventory/item-stacks.js";
import type PlayerEntity from "../player/player.entity.js";
import { FarmingError, CropNotReadyError, MissingIngredientsError, RecipeLevelTooLowError } from "../types/error.js";
import AsyncQueue from "../utils/async-queue.js";
import type World from "../world.js";
import CropRegistry from "./crop.registry.js";
import {
    BASE_FARM_PLOTS,
    FARMING_JOB_ID,
    GROWTH_REDUCTION_PER_LEVEL_PERCENT,
    LEVELS_PER_EXTRA_PLOT,
    MAX_FARM_PLOTS,
    MAX_GROWTH_REDUCTION_PERCENT,
    type CropDefinition,
    type HarvestResult,
    type PlantResult,
    type PlotView
} from "./crop.types.js";
import { createLogger } from "../utils/logger.js";
const log = createLogger("farming");


/**
 * Farming engine of the farmer job: plant seeds on plots, wait for the crops to grow, harvest them.
 * The growth time shrinks with the farming level and the farm gets more plots as the farmer levels up.
 */
export default class FarmingManager extends CropRegistry {
    private readonly queues = new Map<string, AsyncQueue>();

    /**
     * Creates the farming engine.
     *
     * @param world The world.
     */
    public constructor(private readonly world: World) {
        super();
    }

    /**
     * Gets the number of plots a player owns.
     *
     * @param player The player.
     * @returns The plot count (grows with the farming level).
     */
    public getPlotCount(player: PlayerEntity): number {
        const level = player.jobs.getLevel(FARMING_JOB_ID);
        return Math.min(MAX_FARM_PLOTS, BASE_FARM_PLOTS + Math.floor((level - 1) / LEVELS_PER_EXTRA_PLOT));
    }

    /**
     * Computes the growth time of a crop for a farmer.
     *
     * @param crop The crop.
     * @param farmingLevel The farming level.
     * @returns The growth time in milliseconds.
     */
    public getGrowTimeMs(crop: Readonly<CropDefinition>, farmingLevel: number): number {
        const bonusLevels = Math.max(0, farmingLevel - (crop.requiredLevel ?? 1));
        const reduction = Math.min(MAX_GROWTH_REDUCTION_PERCENT, bonusLevels * GROWTH_REDUCTION_PER_LEVEL_PERCENT);
        return Math.max(1, Math.round(crop.growTimeMs * (1 - reduction / 100)));
    }

    /**
     * Lists the plots of a player.
     *
     * @param player The player.
     * @returns One view per plot.
     */
    public getPlots(player: PlayerEntity): PlotView[] {
        const now = Date.now();
        return Array.from({ length: this.getPlotCount(player) }, (_, plot) => {
            const state = player.farm.get(plot);
            return { plot, cropId: state?.cropId ?? null, readyAt: state?.readyAt ?? null, ready: state !== undefined && state.readyAt <= now };
        });
    }

    private queueOf(player: PlayerEntity): AsyncQueue {
        let queue = this.queues.get(player.id);
        if (!queue) this.queues.set(player.id, (queue = new AsyncQueue()));
        return queue;
    }

    private requirePlot(player: PlayerEntity, plot: number): void {
        if (!Number.isInteger(plot) || plot < 0 || plot >= this.getPlotCount(player)) throw new FarmingError(`Plot ${plot} does not exist (you own ${this.getPlotCount(player)}).`);
    }

    /**
     * Plants a seed. The seed is consumed once the cancellable `cropPlant` event has not been cancelled.
     *
     * @param player The farmer.
     * @param cropId The crop identifier.
     * @param plot The plot index.
     * @returns The result; `planted` is `false` when a listener cancelled it.
     * @throws {FarmingError} If the crop is unknown, the plot invalid or already planted.
     * @throws {RecipeLevelTooLowError} If the farming level is too low for the crop.
     * @throws {MissingIngredientsError} If the player has no seed.
     */
    public async plant(player: PlayerEntity, cropId: string, plot: number): Promise<PlantResult> {
        player.assertCanAct("farming.plant");
        return this.queueOf(player).run(async () => {
            player.assertCanAct("farming.plant");
            const crop = this.get(cropId);
            if (!crop) throw new FarmingError(`Unknown crop "${cropId}".`);
            this.requirePlot(player, plot);
            if (player.farm.get(plot)) throw new FarmingError(`Plot ${plot} is already planted.`);
            const level = player.jobs.getLevel(FARMING_JOB_ID);
            if (level < (crop.requiredLevel ?? 1)) throw new RecipeLevelTooLowError(cropId, crop.requiredLevel ?? 1, level);
            const available = countAvailable(await player.inventory.getItems(), crop.seed.itemId);
            if (available < 1) throw new MissingIngredientsError([{ itemId: crop.seed.itemId, required: 1, available }]);

            const now = Date.now();
            const readyAt = now + this.getGrowTimeMs(crop, level);
            const event = await this.world.events.emitCancellable("cropPlant", { playerId: player.id, player, cropId, plot, readyAt });
            if (event.isCancelled) return { planted: false, ...(event.cancelReason !== undefined ? { cancelReason: event.cancelReason } : {}), cropId, plot, readyAt };

            if (!(await player.inventory.remove(crop.seed.itemId, 1))) throw new MissingIngredientsError([{ itemId: crop.seed.itemId, required: 1, available: 0 }]);
            player.farm.set(plot, { cropId, plantedAt: now, readyAt });
            await this.world.players.save(player);
            log.success(`${player.name} planted ${cropId} on plot ${plot}.`);
            return { planted: true, cropId, plot, readyAt };
        });
    }

    /**
     * Harvests a plot: grants the yields and the seed return, empties the plot and grants farming experience.
     *
     * @param player The farmer.
     * @param plot The plot index.
     * @returns The result; `harvested` is `false` when a `cropHarvest` listener cancelled it (the crop stays planted).
     * @throws {FarmingError} If the plot is invalid or empty.
     * @throws {CropNotReadyError} If the crop is still growing.
     */
    public async harvest(player: PlayerEntity, plot: number): Promise<HarvestResult> {
        player.assertCanAct("farming.harvest");
        const outcome = await this.queueOf(player).run(async () => {
            player.assertCanAct("farming.harvest");
            this.requirePlot(player, plot);
            const planted = player.farm.get(plot);
            if (!planted) throw new FarmingError(`Plot ${plot} is empty.`);
            const crop = this.get(planted.cropId);
            if (!crop) throw new FarmingError(`Unknown crop "${planted.cropId}".`);
            const now = Date.now();
            if (planted.readyAt > now) throw new CropNotReadyError(plot, planted.readyAt - now);

            const roll = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min + 1));
            const gains = crop.yields.map((entry) => ({ item: entry.item, quantity: roll(entry.minQuantity, entry.maxQuantity) }));
            if (crop.seedReturn) gains.push({ item: crop.seed, quantity: roll(crop.seedReturn.minQuantity, crop.seedReturn.maxQuantity) });
            const harvest = gains.filter((gain) => gain.quantity > 0).map((gain) => ({ itemId: gain.item.itemId, quantity: gain.quantity }));

            const event = await this.world.events.emitCancellable("cropHarvest", { playerId: player.id, player, cropId: crop.id, plot, harvest });
            if (event.isCancelled) return { crop, harvested: false as const, ...(event.cancelReason !== undefined ? { cancelReason: event.cancelReason } : {}), harvest: [] };

            for (const gain of gains) if (gain.quantity > 0) await player.inventory.add(gain.item, gain.quantity);
            player.farm.clear(plot);
            await this.world.players.save(player);
            log.success(`${player.name} harvested ${crop.id} on plot ${plot}.`);
            return { crop, harvested: true as const, harvest };
        });

        const level = player.jobs.getLevel(FARMING_JOB_ID);
        if (!outcome.harvested) {
            return { harvested: false, ...("cancelReason" in outcome ? { cancelReason: outcome.cancelReason } : {}), cropId: outcome.crop.id, plot, harvest: [], xpGained: 0, level };
        }
        const progress = await player.jobs.addExperience(FARMING_JOB_ID, outcome.crop.xp ?? 0);
        return { harvested: true, cropId: outcome.crop.id, plot, harvest: outcome.harvest, xpGained: progress.xpGained, level: progress.level };
    }
}
