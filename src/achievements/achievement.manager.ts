import type { EventLogger, Unsubscribe } from "../events/event.engine.js";
import type {
  GameEventEngine,
  GameEvents,
  PlayerGameEventName,
} from "../events/game.events.js";
import { parseDump, parsePlayerSnapshot } from "./achievement.serialization.js";
import {
  ACHIEVEMENT_SNAPSHOT_VERSION,
  AchievementCriterion,
  AchievementDefinition,
  AchievementDump,
  AchievementProgressView,
  AchievementReward,
  AchievementSerializationError,
  CriterionSpec,
  DuplicateAchievementError,
  InvalidAchievementError,
  PlayerAchievementSnapshot,
  PlayerAchievementState,
  RewardHandler,
  UnknownAchievementError,
} from "./achievement.types.js";

/** Options du {@link AchievementManager}. */
export interface AchievementManagerOptions {
  /** Applique les récompenses. Sans handler, les récompenses restent « en attente ». */
  readonly rewardHandler?: RewardHandler;
  /** Horloge injectable (tests). @defaultValue `Date.now` */
  readonly now?: () => number;
  readonly logger?: EventLogger;
}

/** Critère « compilé » : ne dépend plus du type générique de son événement. */
interface CompiledCriterion {
  readonly achievementId: string;
  readonly criterionId: string;
  readonly target: number;
  readonly mode: "increment" | "max";
  /** Valeur apportée par le payload, ou `null` si le filtre le rejette. */
  readonly evaluate: (
    payload: GameEvents[PlayerGameEventName],
  ) => number | null;
}

/**
 * Gestionnaire de succès piloté par les événements du jeu.
 *
 * Chaque critère écoute un événement du {@link GameEventEngine} ; la progression est suivie par joueur
 * (via `payload.playerId`), le déblocage émet `achievementUnlocked`, puis les récompenses sont appliquées.
 */
export class AchievementManager {
  private readonly definitions = new Map<string, AchievementDefinition>();
  private readonly byEvent = new Map<
    PlayerGameEventName,
    CompiledCriterion[]
  >();
  private readonly subscriptions = new Map<PlayerGameEventName, Unsubscribe>();
  private readonly players = new Map<
    string,
    Map<string, PlayerAchievementState>
  >();
  private readonly rewardHandler: RewardHandler | undefined;
  private readonly now: () => number;
  private readonly logger: EventLogger | undefined;

  /**
   * @param events - Moteur d'événements du jeu.
   * @param options - Handler de récompenses, horloge, logger.
   */
  public constructor(
    private readonly events: GameEventEngine,
    options: AchievementManagerOptions = {},
  ) {
    this.rewardHandler = options.rewardHandler;
    this.now = options.now ?? Date.now;
    this.logger = options.logger;
  }

  /**
   * Enregistre un ou plusieurs succès.
   *
   * @throws {@link InvalidAchievementError} si la définition est invalide.
   * @throws {@link DuplicateAchievementError} si l'identifiant existe déjà.
   */
  public register(...definitions: AchievementDefinition[]): void {
    for (const definition of definitions) {
      this.validate(definition);
      if (this.definitions.has(definition.id))
        throw new DuplicateAchievementError(definition.id);
    }
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition);
      for (const criterion of definition.criteria)
        this.attach(definition.id, criterion);
    }
  }

  /** Définition d'un succès. @throws {@link UnknownAchievementError} */
  public get(achievementId: string): AchievementDefinition {
    return this.requireDefinition(achievementId);
  }

  /** `true` si un succès avec cet identifiant est enregistré. */
  public has(achievementId: string): boolean {
    return this.definitions.has(achievementId);
  }

  /**
   * Retire un succès (et la progression qui lui est liée). Sert à annuler le chargement d'un pack.
   *
   * @returns `false` si le succès n'était pas enregistré.
   */
  public unregister(achievementId: string): boolean {
    if (!this.definitions.delete(achievementId)) return false;
    for (const [event, list] of this.byEvent) {
      const remaining = list.filter((criterion) => criterion.achievementId !== achievementId);
      if (remaining.length > 0) {
        this.byEvent.set(event, remaining);
        continue;
      }
      this.byEvent.delete(event);
      this.subscriptions.get(event)?.();
      this.subscriptions.delete(event);
    }
    for (const perPlayer of this.players.values()) perPlayer.delete(achievementId);
    return true;
  }

  /** Toutes les définitions enregistrées. */
  public list(): AchievementDefinition[] {
    return [...this.definitions.values()];
  }

  /** `true` si le joueur a débloqué le succès. */
  public isUnlocked(playerId: string, achievementId: string): boolean {
    this.requireDefinition(achievementId);
    return this.players.get(playerId)?.get(achievementId)?.unlockedAt != null;
  }

  /** Succès débloqués par un joueur. */
  public getUnlocked(playerId: string): AchievementDefinition[] {
    return this.list().filter((definition) =>
      this.isUnlocked(playerId, definition.id),
    );
  }

  /** Progression détaillée d'un succès pour un joueur. @throws {@link UnknownAchievementError} */
  public getProgress(
    playerId: string,
    achievementId: string,
  ): AchievementProgressView {
    const definition = this.requireDefinition(achievementId);
    const state = this.players.get(playerId)?.get(achievementId);
    const criteria = definition.criteria.map((criterion) => ({
      id: criterion.id,
      current: state?.progress[criterion.id] ?? 0,
      target: criterion.target,
    }));
    const ratio =
      criteria.reduce(
        (sum, { current, target }) => sum + Math.min(current / target, 1),
        0,
      ) / criteria.length;
    const unlocked = state?.unlockedAt != null;
    return {
      id: achievementId,
      unlocked,
      unlockedAt: state?.unlockedAt ?? null,
      percent: unlocked ? 100 : Math.floor(ratio * 100),
      criteria,
    };
  }

  /**
   * Débloque un succès manuellement (commande admin, migration).
   *
   * @returns `false` s'il était déjà débloqué.
   * @throws {@link UnknownAchievementError}
   */
  public async unlock(
    playerId: string,
    achievementId: string,
  ): Promise<boolean> {
    const definition = this.requireDefinition(achievementId);
    const state = this.stateOf(playerId, achievementId);
    if (state.unlockedAt !== null) return false;
    for (const criterion of definition.criteria)
      state.progress[criterion.id] = criterion.target;
    await this.completeUnlock(playerId, definition, state);
    return true;
  }

  /**
   * Applique les récompenses des succès débloqués dont l'application a échoué ou était absente.
   *
   * @returns Nombre de succès dont les récompenses ont été finalisées.
   */
  public async claimPendingRewards(playerId: string): Promise<number> {
    let claimed = 0;
    for (const [achievementId, state] of this.players.get(playerId) ?? []) {
      const definition = this.definitions.get(achievementId);
      if (
        definition &&
        state.unlockedAt !== null &&
        !state.rewardsGranted &&
        (await this.grantRewards(playerId, definition, state))
      )
        claimed++;
    }
    return claimed;
  }

  /** Efface toute la progression d'un joueur (sans toucher aux récompenses déjà versées). */
  public reset(playerId: string): void {
    this.players.delete(playerId);
  }

  /** Exporte la progression d'un joueur au format JSON-compatible. */
  public exportPlayer(playerId: string): PlayerAchievementSnapshot {
    const achievements: Record<string, PlayerAchievementState> = {};
    for (const [id, state] of this.players.get(playerId) ?? []) {
      achievements[id] = {
        progress: { ...state.progress },
        unlockedAt: state.unlockedAt,
        rewardsGranted: state.rewardsGranted,
        ...(state.rewardsApplied ? { rewardsApplied: state.rewardsApplied } : {}),
      };
    }
    return { version: ACHIEVEMENT_SNAPSHOT_VERSION, playerId, achievements };
  }

  /**
   * Importe la progression d'un joueur (remplace l'état existant).
   * Les succès/critères inconnus sont ignorés et les valeurs bornées à la cible ; aucune récompense n'est rejouée.
   *
   * @param snapshot - Objet issu de `JSON.parse`, validé ici.
   * @throws {@link AchievementSerializationError} si la sauvegarde est invalide.
   */
  public importPlayer(snapshot: unknown): void {
    const parsed = parsePlayerSnapshot(snapshot);
    const restored = new Map<string, PlayerAchievementState>();
    for (const [id, saved] of Object.entries(parsed.achievements)) {
      const definition = this.definitions.get(id);
      if (!definition) {
        this.logger?.debug(
          `[achievements] ignoring unknown achievement "${id}" while importing ${parsed.playerId}`,
        );
        continue;
      }
      const unlocked = saved.unlockedAt !== null;
      const progress: Record<string, number> = {};
      for (const criterion of definition.criteria) {
        progress[criterion.id] = unlocked
          ? criterion.target
          : Math.min(saved.progress[criterion.id] ?? 0, criterion.target);
      }
      restored.set(id, {
        progress,
        unlockedAt: saved.unlockedAt,
        rewardsGranted: saved.rewardsGranted,
        ...(saved.rewardsApplied ? { rewardsApplied: saved.rewardsApplied } : {}),
      });
    }
    this.players.set(parsed.playerId, restored);
  }

  /** Sérialise tous les joueurs en JSON. */
  public toJSON(): AchievementDump {
    return {
      version: ACHIEVEMENT_SNAPSHOT_VERSION,
      players: [...this.players.keys()].map((id) => this.exportPlayer(id)),
    };
  }

  /**
   * Restaure tous les joueurs depuis une chaîne JSON produite par `JSON.stringify(manager)`.
   *
   * @throws {@link AchievementSerializationError} si le JSON est invalide.
   */
  public loadJSON(json: string): void {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch (error) {
      throw new AchievementSerializationError("Invalid JSON.", {
        cause: error,
      });
    }
    for (const snapshot of parseDump(raw).players) this.importPlayer(snapshot);
  }

  /** Se désabonne du moteur d'événements. */
  public dispose(): void {
    for (const unsubscribe of this.subscriptions.values()) unsubscribe();
    this.subscriptions.clear();
  }

  private validate(definition: AchievementDefinition): void {
    if (!definition.id.trim())
      throw new InvalidAchievementError("Achievement id must not be empty.");
    if (definition.criteria.length === 0)
      throw new InvalidAchievementError(
        `"${definition.id}": at least one criterion is required.`,
      );
    const seen = new Set<string>();
    for (const criterion of definition.criteria) {
      if (seen.has(criterion.id))
        throw new InvalidAchievementError(
          `"${definition.id}": duplicate criterion "${criterion.id}".`,
        );
      seen.add(criterion.id);
      if (!Number.isFinite(criterion.target) || criterion.target <= 0) {
        throw new InvalidAchievementError(
          `"${definition.id}.${criterion.id}": target must be > 0.`,
        );
      }
    }
  }

  private attach(achievementId: string, criterion: AchievementCriterion): void {
    // Rationale: l'union discriminée garantit que `criterion` correspond à `criterion.event` ;
    // TS ne sait pas corréler les deux, d'où ce cast unique et localisé.
    this.bindCriterion(
      criterion.event,
      achievementId,
      criterion as unknown as CriterionSpec<typeof criterion.event>,
    );
  }

  /**
   * Compile un critère pour son événement et s'abonne une seule fois par type d'événement.
   * Rationale: le moteur garantit que le payload reçu correspond à `K` ; le cast est donc localisé ici.
   */
  private bindCriterion<K extends PlayerGameEventName>(
    event: K,
    achievementId: string,
    criterion: CriterionSpec<K>,
  ): void {
    const compiled: CompiledCriterion = {
      achievementId,
      criterionId: criterion.id,
      target: criterion.target,
      mode: criterion.mode ?? "increment",
      evaluate: (payload) => {
        const typed = payload as GameEvents[K];
        if (criterion.filter && !criterion.filter(typed)) return null;
        const value = criterion.value ? criterion.value(typed) : 1;
        return Number.isFinite(value) && value > 0 ? value : null;
      },
    };
    const list = this.byEvent.get(event) ?? [];
    list.push(compiled);
    this.byEvent.set(event, list);
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(
        event,
        this.events.on(event, (payload) => this.handle(event, payload)),
      );
    }
  }

  private async handle<K extends PlayerGameEventName>(
    event: K,
    payload: GameEvents[K],
  ): Promise<void> {
    const { playerId } = payload;
    const completed: AchievementDefinition[] = [];

    for (const criterion of this.byEvent.get(event) ?? []) {
      const state = this.stateOf(playerId, criterion.achievementId);
      if (state.unlockedAt !== null) continue;
      const value = criterion.evaluate(payload);
      if (value === null) continue;

      const current = state.progress[criterion.criterionId] ?? 0;
      const next = Math.min(
        criterion.mode === "max" ? Math.max(current, value) : current + value,
        criterion.target,
      );
      if (next === current) continue;
      state.progress[criterion.criterionId] = next;
      this.events.emit("achievementProgress", {
        playerId,
        achievement: this.requireDefinition(criterion.achievementId),
        achievementId: criterion.achievementId,
        criterionId: criterion.criterionId,
        current: next,
        target: criterion.target,
      });

      const definition = this.requireDefinition(criterion.achievementId);
      const done = definition.criteria.every(
        (c) => (state.progress[c.id] ?? 0) >= c.target,
      );
      if (done && !completed.includes(definition)) completed.push(definition);
    }

    for (const definition of completed) {
      await this.completeUnlock(
        playerId,
        definition,
        this.stateOf(playerId, definition.id),
      );
    }
  }

  private async completeUnlock(
    playerId: string,
    definition: AchievementDefinition,
    state: PlayerAchievementState,
  ): Promise<void> {
    state.unlockedAt = this.now();
    this.logger?.debug(
      `[achievements] ${playerId} unlocked "${definition.id}"`,
    );
    this.events.emit("achievementUnlock", {
      playerId,
      achievement: definition,
      achievementId: definition.id,
      at: state.unlockedAt,
    });
    await this.grantRewards(playerId, definition, state);
  }

  /** @returns `true` si toutes les récompenses ont été appliquées. */
  private async grantRewards(
    playerId: string,
    definition: AchievementDefinition,
    state: PlayerAchievementState,
  ): Promise<boolean> {
    const rewards = definition.rewards ?? [];
    if (rewards.length === 0) {
      state.rewardsGranted = true;
      return true;
    }
    if (!this.rewardHandler) return false;
    try {
      // Rationale: resume after the last applied reward, so a retry never pays the same reward twice.
      for (let index = state.rewardsApplied ?? 0; index < rewards.length; index++) {
        await this.rewardHandler(playerId, rewards[index] as AchievementReward, definition);
        state.rewardsApplied = index + 1;
      }
      state.rewardsGranted = true;
      return true;
    } catch (error) {
      // Le déblocage est conservé ; claimPendingRewards() permet de réessayer.
      this.logger?.error(
        `[achievements] rewards failed for "${definition.id}" (${playerId})`,
        error,
      );
      return false;
    }
  }

  private stateOf(
    playerId: string,
    achievementId: string,
  ): PlayerAchievementState {
    let perPlayer = this.players.get(playerId);
    if (!perPlayer) {
      perPlayer = new Map();
      this.players.set(playerId, perPlayer);
    }
    let state = perPlayer.get(achievementId);
    if (!state) {
      state = { progress: {}, unlockedAt: null, rewardsGranted: false };
      perPlayer.set(achievementId, state);
    }
    return state;
  }

  private requireDefinition(achievementId: string): AchievementDefinition {
    const definition = this.definitions.get(achievementId);
    if (!definition) throw new UnknownAchievementError(achievementId);
    return definition;
  }
}
