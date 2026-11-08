import { consola } from "consola";
import type { Unsubscribe } from "../events/event.engine.js";
import type { GameEvents } from "../events/game.events.js";
import { InvalidBestiaryRewardError } from "../types/error.js";
import type World from "../world.js";
import type {
  BestiaryDiscoveryGold,
  BestiaryOptions,
} from "./bestiary.types.js";

/**
 * Priority of the bestiary listener: it runs before the other `monsterDefeated` listeners
 * (e.g. achievements), so discoveries are registered first.
 */
// Rationale: a high priority guarantees the bestiary is up to date when achievements evaluate a kill.
const BESTIARY_LISTENER_PRIORITY = 100;

/**
 * Registers defeated monsters in the bestiary of the player and pays the discovery gold.
 */
export default class BestiaryManager {
  private readonly discoveryGold: BestiaryDiscoveryGold | undefined;
  private subscription: Unsubscribe | undefined;

  /**
   * Creates the bestiary manager and listens to `monsterDefeated` events.
   *
   * @param world The world holding the players and the event engine.
   * @param options The bestiary options.
   * @throws {InvalidBestiaryRewardError} If a configured fixed or per-species reward is invalid.
   */
  public constructor(
    private readonly world: World,
    options: BestiaryOptions = {},
  ) {
    this.discoveryGold = options.discoveryGold;
    this.validateStaticRewards();

    if (options.enabled ?? true) {
      this.subscription = world.events.on(
        "enemyDefeat",
        (payload) => this.onMonsterDefeated(payload),
        {
          priority: BESTIARY_LISTENER_PRIORITY,
        },
      );
    }
  }

  /**
   * Resolves the gold granted on the first discovery of a species.
   *
   * Resolution order: a fixed number, a dynamic function, the per-species record, then the
   * `discoveryGold` of the enemy definition (0 when absent).
   *
   * @param enemyType The species identifier.
   * @returns The reward (non-negative integer).
   * @throws {InvalidBestiaryRewardError} If a dynamic reward returns an invalid value.
   */
  public getDiscoveryGold(enemyType: string): number {
    const configured = this.discoveryGold;
    const definitionGold =
      this.world.enemies.get(enemyType)?.discoveryGold ?? 0;
    const reward =
      typeof configured === "number"
        ? configured
        : typeof configured === "function"
          ? configured(enemyType)
          : (configured?.[enemyType] ?? definitionGold);

    if (!Number.isFinite(reward) || reward < 0)
      throw new InvalidBestiaryRewardError(enemyType, reward);
    return Math.floor(reward);
  }

  /**
   * Stops listening to events.
   *
   * @returns void
   */
  public dispose(): void {
    this.subscription?.();
    this.subscription = undefined;
  }

  private validateStaticRewards(): void {
    const configured = this.discoveryGold;
    if (configured === undefined || typeof configured === "function") return;

    const rewards =
      typeof configured === "number"
        ? [["*", configured] as const]
        : Object.entries(configured);
    for (const [enemyType, reward] of rewards) {
      if (!Number.isFinite(reward) || reward < 0)
        throw new InvalidBestiaryRewardError(enemyType, reward);
    }
  }

  private async onMonsterDefeated(
    payload: GameEvents["enemyDefeat"],
  ): Promise<void> {
    if (!this.world.enemies.has(payload.enemyType)) return;

    const player = await this.world.players.get(payload.playerId);
    if (!player) {
      consola.warn(`Bestiary: unknown player ${payload.playerId}.`);
      return;
    }

    // Rationale: only a discovery is saved right away; the kill counter is persisted with the next regular save.
    if (player.bestiary.isDiscovered(payload.enemyType)) {
      player.bestiary.record(payload.enemyType);
      return;
    }

    // Resolved before recording: an invalid dynamic reward leaves the species undiscovered, so it is retried next time.
    const goldReward = this.getDiscoveryGold(payload.enemyType);
    player.bestiary.record(payload.enemyType);
    player.gold += goldReward;
    await this.world.players.save(player);
    await this.world.events.emitAsync("bestiaryDiscover", {
      playerId: player.id,
      player,
      enemyType: payload.enemyType,
      goldReward,
    });
  }
}
