import type { GameEvents, PlayerGameEventName } from "../events/game.events.js";

/** Récompense déclarative d'un succès ; son application est déléguée à un {@link RewardHandler}. */
export type AchievementReward =
  | { readonly kind: "gold"; readonly amount: number }
  | { readonly kind: "experience"; readonly amount: number }
  | {
      readonly kind: "item";
      readonly itemId: string;
      readonly quantity: number;
    }
  | { readonly kind: "title"; readonly titleId: string };

/**
 * Mode d'accumulation d'un critère.
 * - `increment` : additionne les valeurs (« tuer 50 monstres »).
 * - `max` : conserve la plus grande valeur vue (« atteindre le niveau 10 »).
 */
export type CriterionMode = "increment" | "max";

/** Critère de progression lié à un événement du jeu. */
export interface CriterionSpec<K extends PlayerGameEventName> {
  /** Identifiant unique au sein du succès. */
  readonly id: string;
  /** Événement déclencheur. */
  readonly event: K;
  /** Valeur à atteindre (> 0). */
  readonly target: number;
  /** @defaultValue "increment" */
  readonly mode?: CriterionMode;
  /** Ne compte l'événement que si le prédicat renvoie `true`. */
  readonly filter?: (payload: GameEvents[K]) => boolean;
  /** Valeur apportée par l'événement. @defaultValue 1 */
  readonly value?: (payload: GameEvents[K]) => number;
}

/** Union discriminée par `event` : chaque critère est typé avec le payload de son événement. */
export type AchievementCriterion = {
  [K in PlayerGameEventName]: CriterionSpec<K>;
}[PlayerGameEventName];

/** Définition statique d'un succès. */
export interface AchievementDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category?: string;
  /** Succès secret : à masquer côté interface tant qu'il n'est pas débloqué. */
  readonly hidden?: boolean;
  /** Tous les critères doivent être atteints pour débloquer le succès. */
  readonly criteria: readonly AchievementCriterion[];
  readonly rewards?: readonly AchievementReward[];
}

/** Applique une récompense au joueur (or, XP, objet…). Peut être asynchrone. */
export type RewardHandler = (
  playerId: string,
  reward: AchievementReward,
  achievement: AchievementDefinition,
) => void | Promise<void>;

/** État persistant d'un succès pour un joueur. */
export interface PlayerAchievementState {
  /** Progression par identifiant de critère. */
  progress: Record<string, number>;
  /** Timestamp (ms) du déblocage, `null` si verrouillé. */
  unlockedAt: number | null;
  /** `false` tant que les récompenses n'ont pas toutes été appliquées. */
  rewardsGranted: boolean;
}

/** Vue lecture seule de la progression, prête pour l'affichage. */
export interface AchievementProgressView {
  readonly id: string;
  readonly unlocked: boolean;
  readonly unlockedAt: number | null;
  /** Pourcentage global, 0 à 100. */
  readonly percent: number;
  readonly criteria: ReadonlyArray<{
    readonly id: string;
    readonly current: number;
    readonly target: number;
  }>;
}

/** Version du format de sérialisation. */
export const ACHIEVEMENT_SNAPSHOT_VERSION = 1 as const;

/** Sauvegarde JSON-compatible des succès d'un joueur. */
export interface PlayerAchievementSnapshot {
  readonly version: typeof ACHIEVEMENT_SNAPSHOT_VERSION;
  readonly playerId: string;
  readonly achievements: Readonly<Record<string, PlayerAchievementState>>;
}

/** Sauvegarde JSON-compatible de plusieurs joueurs. */
export interface AchievementDump {
  readonly version: typeof ACHIEVEMENT_SNAPSHOT_VERSION;
  readonly players: readonly PlayerAchievementSnapshot[];
}

/** Erreur de base du système de succès. */
export class AchievementError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Définition invalide (cible ≤ 0, critères dupliqués, etc.). */
export class InvalidAchievementError extends AchievementError {}

/** Un succès avec le même identifiant est déjà enregistré. */
export class DuplicateAchievementError extends AchievementError {
  public constructor(public readonly achievementId: string) {
    super(`Achievement "${achievementId}" is already registered.`);
  }
}

/** Succès inconnu. */
export class UnknownAchievementError extends AchievementError {
  public constructor(public readonly achievementId: string) {
    super(`Unknown achievement "${achievementId}".`);
  }
}

/** Sauvegarde illisible ou de version non supportée. */
export class AchievementSerializationError extends AchievementError {}
