import { consola } from "consola";
import { parsePlayerEffectsState } from "../effects/effect.serialization.js";
import type {
    ActiveEffectState,
    ActiveEffectView,
    ApplyEffectOptions,
    EffectContext,
    EffectDefinition,
    PlayerEffectsState,
    ResolvedEffectModifiers
} from "../effects/effect.types.js";
import { InvalidDurationError } from "../types/error.js";
import type PlayerEntity from "./player.entity.js";

/** Neutral modifiers of a player without active effect. */
export const NO_EFFECT_MODIFIERS: ResolvedEffectModifiers = { xpMultiplier: 1, luckPercent: 0, critRateBonus: 0 };

/**
 * Largest delay accepted by `setTimeout` (about 24.8 days); longer waits are re-armed when they fire.
 */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/**
 * Temporary effects of a player: potions, buffs, damage or heal over time.
 *
 * The state is *lazy and exact*: ticks and expirations are computed from timestamps against the clock, so
 * the result is correct even if no timer fired (process restart, eviction from the cache). A timer
 * additionally processes them on time so heals and events are not late.
 *
 * State changes are synchronous (no `await` in between), so concurrent calls cannot corrupt the state.
 * Hooks and events run afterwards, outside of any critical section.
 */
export default class PlayerEffects {
    private readonly states = new Map<string, ActiveEffectState>();
    private timer: NodeJS.Timeout | undefined;

    /**
     * Creates the effects of a player.
     *
     * @param player The owning player.
     * @param state The saved effects state (validated).
     * @returns void
     */
    public constructor(private readonly player: PlayerEntity, state: unknown = {}) {
        for (const [effectId, effectState] of Object.entries(parsePlayerEffectsState(state))) {
            this.states.set(effectId, effectState);
        }
        this.schedule();
    }

    /**
     * Checks whether an effect is currently active.
     *
     * @param effectId The effect identifier.
     * @param now The reference time (epoch ms).
     * @returns True if the effect is active and has not ended.
     */
    public has(effectId: string, now: number = Date.now()): boolean {
        const state = this.states.get(effectId);
        return state !== undefined && state.expiresAt > now;
    }

    /**
     * Gets the time left of an effect.
     *
     * @param effectId The effect identifier.
     * @param now The reference time (epoch ms).
     * @returns The remaining milliseconds, 0 if the effect is not active.
     */
    public getRemainingMs(effectId: string, now: number = Date.now()): number {
        const state = this.states.get(effectId);
        return state === undefined ? 0 : Math.max(0, state.expiresAt - now);
    }

    /**
     * Lists the active effects, soonest to end first.
     *
     * @param now The reference time (epoch ms).
     * @returns The views of the active effects whose definition is registered.
     */
    public list(now: number = Date.now()): ActiveEffectView[] {
        const views: ActiveEffectView[] = [];
        for (const [effectId, state] of this.states) {
            const definition = this.player.worldInstance.effects.get(effectId);
            if (!definition || state.expiresAt <= now) continue;
            views.push({ effectId, name: definition.name, expiresAt: state.expiresAt, remainingMs: state.expiresAt - now });
        }
        return views.sort((first, second) => first.expiresAt - second.expiresAt);
    }

    /**
     * Combines the passive modifiers of every active effect: experience multipliers multiply,
     * luck and critical bonuses add up.
     *
     * @param now The reference time (epoch ms).
     * @returns The combined modifiers (neutral without active effect).
     */
    public getModifiers(now: number = Date.now()): ResolvedEffectModifiers {
        let xpMultiplier = 1;
        let luckPercent = 0;
        let critRateBonus = 0;
        for (const [effectId, state] of this.states) {
            const modifiers = this.player.worldInstance.effects.get(effectId)?.modifiers;
            if (!modifiers || state.expiresAt <= now) continue;
            xpMultiplier *= modifiers.xpMultiplier ?? 1;
            luckPercent += modifiers.luckPercent ?? 0;
            critRateBonus += modifiers.critRateBonus ?? 0;
        }
        return { xpMultiplier, luckPercent, critRateBonus };
    }

    /**
     * Applies an effect to the player. An active effect is refreshed (or extended, see `EffectDefinition.stacking`):
     * one effect is never active twice at the same time.
     *
     * @param effectId The effect identifier.
     * @param options The application options.
     * @returns The view of the effect after the application.
     * @throws {UnknownRegistryEntryError} If the effect is not registered.
     * @throws {InvalidDurationError} If the duration override is not a positive number.
     * @throws {PlayerDeadError} If the player is dead.
     */
    public async apply(effectId: string, options: ApplyEffectOptions = {}): Promise<ActiveEffectView> {
        this.player.assertCanAct("effects.apply");
        const definition = this.player.worldInstance.effects.require(effectId);
        const durationMs = options.durationMs ?? definition.durationMs;
        if (!Number.isFinite(durationMs) || durationMs <= 0) throw new InvalidDurationError(durationMs);

        const now = Date.now();
        // Credit what accrued under the previous state first (ticks, expiration), then apply on a clean slate.
        const pending = this.collectDue(now);
        const previous = this.states.get(effectId);
        const refreshed = previous !== undefined;
        const extend = refreshed && definition.stacking === "extend";
        const state: ActiveEffectState = {
            appliedAt: previous?.appliedAt ?? now,
            expiresAt: extend ? previous.expiresAt + durationMs : now + durationMs,
            lastTickAt: previous?.lastTickAt ?? now
        };
        this.states.set(effectId, state);
        this.schedule();

        await this.flush(pending);
        if (!refreshed) await this.runHook(definition, definition.onApply, now, state.expiresAt);
        await this.player.worldInstance.events.emitAsync("effectApply", {
            playerId: this.player.id,
            player: this.player,
            effectId,
            effect: definition,
            expiresAt: state.expiresAt,
            refreshed
        });
        return { effectId, name: definition.name, expiresAt: state.expiresAt, remainingMs: Math.max(0, state.expiresAt - now) };
    }

    /**
     * Removes an active effect before its end (a cleanse). `onExpire` is not run.
     *
     * @param effectId The effect identifier.
     * @returns True if the effect was active.
     */
    public async remove(effectId: string): Promise<boolean> {
        const pending = this.collectDue(Date.now());
        const removed = this.detach(effectId);
        this.schedule();
        await this.flush(pending);
        if (!removed) return false;
        await this.emitRemoval(effectId, removed);
        return true;
    }

    /**
     * Removes every active effect (e.g. on a custom death rule).
     *
     * @returns The number of effects removed.
     */
    public async clear(): Promise<number> {
        const pending = this.collectDue(Date.now());
        const removed = [...this.states.keys()].map((effectId) => [effectId, this.detach(effectId)] as const);
        this.schedule();
        await this.flush(pending);
        let count = 0;
        for (const [effectId, definition] of removed) {
            if (!definition) continue;
            count += 1;
            await this.emitRemoval(effectId, definition);
        }
        return count;
    }

    /**
     * Processes what is due: ticks that elapsed and effects that ended.
     * It runs by itself on a timer and when a player is loaded; call it before reading the health if you need it exact right now.
     *
     * @param now The reference time (epoch ms).
     * @returns void
     */
    public async sync(now: number = Date.now()): Promise<void> {
        const pending = this.collectDue(now);
        this.schedule();
        await this.flush(pending);
    }

    /**
     * Exports the state for persistence.
     *
     * @returns A copy of the effects state.
     */
    public toState(): PlayerEffectsState {
        const state: PlayerEffectsState = {};
        for (const [effectId, effectState] of this.states) state[effectId] = { ...effectState };
        return state;
    }

    /**
     * Stops the pending timer (the player is unloaded from memory or deleted).
     *
     * @returns void
     */
    public dispose(): void {
        this.clearTimer();
    }

    /**
     * Applies the due ticks that need no await (heals) and detaches the ended effects, synchronously.
     *
     * @returns The asynchronous work left to run (custom tick hooks, `onExpire`, events), in order.
     */
    private collectDue(now: number): Array<() => Promise<void>> {
        const pending: Array<() => Promise<void>> = [];
        for (const [effectId, state] of [...this.states]) {
            const definition = this.player.worldInstance.effects.get(effectId);
            if (!definition) {
                this.states.delete(effectId); // the pack that provided the effect is gone
                continue;
            }

            const { tick } = definition;
            if (tick) {
                const dueTicks = Math.floor((Math.min(now, state.expiresAt) - state.lastTickAt) / tick.intervalMs);
                for (let index = 0; index < dueTicks; index++) {
                    state.lastTickAt += tick.intervalMs;
                    const tickAt = state.lastTickAt;
                    if (tick.heal !== undefined) this.player.heal(tick.heal, `effect:${effectId}`);
                    const { run } = tick;
                    if (run) pending.push(() => this.runHook(definition, run, tickAt, state.expiresAt));
                }
            }

            if (now >= state.expiresAt) {
                this.states.delete(effectId);
                pending.push(async () => {
                    await this.runHook(definition, definition.onExpire, now, state.expiresAt);
                    await this.player.worldInstance.events.emitAsync("effectExpire", { playerId: this.player.id, player: this.player, effectId, effect: definition });
                });
            }
        }
        return pending;
    }

    private detach(effectId: string): EffectDefinition | undefined {
        const state = this.states.get(effectId);
        if (!state) return undefined;
        this.states.delete(effectId);
        const definition = this.player.worldInstance.effects.get(effectId);
        return state.expiresAt > Date.now() ? definition : undefined;
    }

    private async emitRemoval(effectId: string, definition: EffectDefinition): Promise<void> {
        await this.player.worldInstance.events.emitAsync("effectRemove", { playerId: this.player.id, player: this.player, effectId, effect: definition });
    }

    private async flush(pending: ReadonlyArray<() => Promise<void>>): Promise<void> {
        for (const work of pending) await work();
    }

    private async runHook(
        definition: EffectDefinition,
        hook: ((context: EffectContext) => void | Promise<void>) | undefined,
        at: number,
        expiresAt: number
    ): Promise<void> {
        if (!hook) return;
        const context: EffectContext = { world: this.player.worldInstance, player: this.player, effect: definition, remainingMs: Math.max(0, expiresAt - at) };
        try {
            await hook(context);
        } catch (error) {
            consola.error(`A hook of the effect "${definition.id}" failed for player ${this.player.id}.`, error);
        }
    }

    /**
     * Arms the timer on the next tick or expiration (nothing is armed while no effect is active).
     */
    private schedule(): void {
        this.clearTimer();
        let next = Number.POSITIVE_INFINITY;
        for (const [effectId, state] of this.states) {
            const tick = this.player.worldInstance.effects.get(effectId)?.tick;
            const nextTick = tick ? state.lastTickAt + tick.intervalMs : Number.POSITIVE_INFINITY;
            next = Math.min(next, nextTick <= state.expiresAt ? nextTick : state.expiresAt);
        }
        if (!Number.isFinite(next)) return;

        const delay = Math.min(Math.max(1, next - Date.now()), MAX_TIMER_DELAY_MS);
        this.timer = setTimeout(() => {
            this.timer = undefined;
            void this.sync().catch((error: unknown) => consola.error(`Failed to process the effects of ${this.player.id}.`, error));
        }, delay);
        // Rationale: a pending effect must never keep the Node.js process alive.
        this.timer.unref();
    }

    private clearTimer(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
    }
}
