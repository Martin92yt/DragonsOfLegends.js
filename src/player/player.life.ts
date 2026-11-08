import { consola } from "consola";
import { InvalidDeathRespawnError, PlayerDeadError } from "../types/error.js";
import type PlayerEntity from "./player.entity.js";

/**
 * Why a player came back to life.
 * - `timer`: the respawn cooldown elapsed;
 * - `manual`: revived explicitly (`player.life.revive()`, `world.players.revive(id)`), e.g. by a resurrection item or an admin.
 */
export type RevivalReason = "timer" | "manual";

/**
 * Respawn options (`deathRespawn` world option).
 */
export interface DeathRespawnOptions {
    /**
     * Fraction (0 < ratio <= 1) of the maximum health restored on revival.
     * @defaultValue 1
     */
    readonly healthRatio?: number;
    /**
     * Sends the player back to the starting city when they respawn.
     * @defaultValue false
     */
    readonly relocateToStartingCity?: boolean;
}

/**
 * Fully resolved respawn configuration.
 */
export interface ResolvedDeathRespawnConfig {
    readonly healthRatio: number;
    readonly relocateToStartingCity: boolean;
}

/**
 * Merges the respawn options with their defaults and validates them.
 *
 * @param options The user-provided options, if any.
 * @returns The resolved configuration.
 * @throws {InvalidDeathRespawnError} If `healthRatio` is not a number in ]0, 1].
 */
export function resolveDeathRespawnConfig(options?: DeathRespawnOptions): ResolvedDeathRespawnConfig {
    const healthRatio = options?.healthRatio ?? 1;
    if (!Number.isFinite(healthRatio) || healthRatio <= 0 || healthRatio > 1) {
        throw new InvalidDeathRespawnError(`healthRatio must be in ]0, 1], received ${healthRatio}.`);
    }
    return { healthRatio, relocateToStartingCity: options?.relocateToStartingCity ?? false };
}

/**
 * Largest delay accepted by `setTimeout` (about 24.8 days); longer cooldowns are re-armed when they fire.
 */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/**
 * Life state of a player: the single source of truth for "can this player act?".
 *
 * A player is either alive, dead until a given timestamp (respawn cooldown) or permanently dead (hardcore).
 * The resurrection is *lazy and exact*: the state is evaluated against the clock on every check, so it is correct
 * even if no timer fired (process restart, eviction from the cache). A timer additionally revives the player on
 * time to emit the `playerRevived` event.
 */
export default class PlayerLife {
    /** Epoch ms of the respawn; `Infinity` when the death is permanent; `null` when alive. */
    private deadUntil: number | null;
    private timer: NodeJS.Timeout | undefined;

    /**
     * Creates the life state of a player.
     *
     * @param player The player.
     * @param deadUntil The persisted respawn timestamp (ms), or null if the player is alive.
     */
    public constructor(private readonly player: PlayerEntity, deadUntil: number | null = null) {
        this.deadUntil = deadUntil !== null && Number.isFinite(deadUntil) ? deadUntil : null;
        if (this.deadUntil !== null) this.armTimer();
    }

    /**
     * Whether the player is dead right now (an elapsed cooldown revives the player on the spot).
     */
    public get isDead(): boolean {
        this.refresh();
        return this.deadUntil !== null;
    }

    /**
     * Whether the player may perform actions right now.
     */
    public get canAct(): boolean {
        return !this.isDead;
    }

    /**
     * Whether the death is permanent (hardcore).
     */
    public get isPermanentlyDead(): boolean {
        return this.deadUntil === Number.POSITIVE_INFINITY;
    }

    /**
     * Time left before the respawn.
     *
     * @returns 0 when alive, the remaining milliseconds when dead, `Infinity` when permanently dead.
     */
    public getRemainingMs(): number {
        this.refresh();
        return this.deadUntil === null ? 0 : Math.max(0, this.deadUntil - Date.now());
    }

    /**
     * Gets the respawn timestamp to persist.
     *
     * @returns The epoch ms of the respawn, or null when alive or permanently dead (a hardcore player is deleted).
     */
    public getPersistedDeadUntil(): number | null {
        this.refresh();
        return this.deadUntil !== null && Number.isFinite(this.deadUntil) ? this.deadUntil : null;
    }

    /**
     * The strict gate: refuses any action of a dead player.
     * Call it first in every player action.
     *
     * @param action The name of the action (e.g. `combat.attack`), reported in the error.
     * @returns void
     * @throws {PlayerDeadError} If the player is dead, with the remaining time.
     */
    public assertCanAct(action: string): void {
        this.refresh();
        if (this.deadUntil !== null) {
            throw new PlayerDeadError(this.player.id, Math.max(0, this.deadUntil - Date.now()), action);
        }
    }

    /**
     * Puts the player in the dead state for a cooldown.
     *
     * @param cooldownMs The respawn cooldown in milliseconds.
     * @returns The respawn timestamp (epoch ms).
     */
    public die(cooldownMs: number): number {
        const respawnAt = Date.now() + Math.max(0, cooldownMs);
        this.deadUntil = respawnAt;
        this.player.health.current = 0;
        this.armTimer();
        return respawnAt;
    }

    /**
     * Marks the player as permanently dead (hardcore): no respawn, every action is refused forever.
     *
     * @returns void
     */
    public killPermanently(): void {
        this.deadUntil = Number.POSITIVE_INFINITY;
        this.player.health.current = 0;
        this.clearTimer();
    }

    /**
     * Revives the player right now (resurrection item, admin command...), then persists and announces it.
     *
     * @returns True if the player was dead and has been revived, false if already alive.
     * @throws {PlayerDeadError} Never: a permanent death is also revived, as a deliberate manual override.
     */
    public async revive(): Promise<boolean> {
        this.refresh();
        if (this.deadUntil === null) return false;
        await this.completeRevival("manual");
        return true;
    }

    /**
     * Stops the pending respawn timer (the player is unloaded from memory or deleted).
     *
     * @returns void
     */
    public dispose(): void {
        this.clearTimer();
    }

    /**
     * Applies the revival synchronously if the cooldown has elapsed.
     */
    private refresh(): void {
        if (this.deadUntil === null || this.deadUntil === Number.POSITIVE_INFINITY || Date.now() < this.deadUntil) return;

        this.applyRevival();
        // Fire-and-forget by design: the state is already consistent in memory; persistence and the
        // `playerRevived` event must not turn a synchronous check into an async one. Failures are logged.
        void this.announce("timer").catch((error: unknown) => consola.error(`Failed to announce the revival of ${this.player.id}.`, error));
    }

    private applyRevival(): void {
        const { healthRatio, relocateToStartingCity } = resolveDeathRespawnConfig(this.player.worldInstance.initializationOptions.deathRespawn);
        this.deadUntil = null;
        this.clearTimer();
        this.player.health.current = Math.max(1, Math.ceil(this.player.health.max * healthRatio));
        if (relocateToStartingCity) this.player.location = this.player.worldInstance.location.getStartingCityId();
        consola.info(`✨ ${this.player.name} is back to life.`);
    }

    private async completeRevival(reason: RevivalReason): Promise<void> {
        this.applyRevival();
        await this.announce(reason);
    }

    private async announce(reason: RevivalReason): Promise<void> {
        const { worldInstance } = this.player;
        await worldInstance.players.save(this.player);
        await worldInstance.events.emitAsync("playerRevive", {
            playerId: this.player.id,
            player: this.player,
            reason,
            health: this.player.health.current,
            locationId: this.player.location
        });
    }

    private armTimer(): void {
        this.clearTimer();
        if (this.deadUntil === null || this.deadUntil === Number.POSITIVE_INFINITY) return;

        const delay = Math.min(Math.max(0, this.deadUntil - Date.now()), MAX_TIMER_DELAY_MS);
        this.timer = setTimeout(() => {
            this.timer = undefined;
            if (this.deadUntil !== null && Date.now() < this.deadUntil) {
                this.armTimer(); // Long cooldown: re-armed until the real deadline.
                return;
            }
            this.refresh();
        }, delay);
        // Rationale: a pending respawn must never keep the Node.js process alive.
        this.timer.unref();
    }

    private clearTimer(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
    }
}
