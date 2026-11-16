import type { PlayerFarmState, PlotState } from "./crop.types.js";

/**
 * The farm of a player: the plots and what grows on them.
 */
export default class PlayerFarm {
    private readonly plots = new Map<number, PlotState>();

    /**
     * Creates the farm from a saved state (invalid entries are ignored).
     *
     * @param state The saved farm.
     * @returns void
     */
    public constructor(state: unknown = {}) {
        if (typeof state !== "object" || state === null || Array.isArray(state)) return;
        for (const [key, value] of Object.entries(state)) {
            const plot = Number(key);
            const candidate = value as Partial<PlotState> | null;
            if (!Number.isInteger(plot) || plot < 0 || !candidate) continue;
            if (typeof candidate.cropId === "string" && typeof candidate.plantedAt === "number" && typeof candidate.readyAt === "number") {
                this.plots.set(plot, { cropId: candidate.cropId, plantedAt: candidate.plantedAt, readyAt: candidate.readyAt });
            }
        }
    }

    /**
     * Gets what grows on a plot.
     *
     * @param plot The plot index.
     * @returns The plot state, or undefined when it is empty.
     */
    public get(plot: number): PlotState | undefined {
        return this.plots.get(plot);
    }

    /**
     * Plants a crop on a plot.
     *
     * @param plot The plot index.
     * @param state The planted crop.
     * @returns void
     */
    public set(plot: number, state: PlotState): void {
        this.plots.set(plot, state);
    }

    /**
     * Empties a plot.
     *
     * @param plot The plot index.
     * @returns True if something was growing there.
     */
    public clear(plot: number): boolean {
        return this.plots.delete(plot);
    }

    /**
     * Exports the farm for persistence.
     *
     * @returns A copy of the farm state.
     */
    public toState(): PlayerFarmState {
        const state: PlayerFarmState = {};
        for (const [plot, value] of this.plots) state[String(plot)] = { ...value };
        return state;
    }
}
