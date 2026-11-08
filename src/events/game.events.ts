import type { EventEngine } from "./event.engine.js";
import type World from "../world.js";
import type PlayerEntity from "../player/player.entity.js";
import type { Attribute } from "../player/player.entity.js";
import type EnemyEntity from "../enemy/enemy.js";
import type Combat from "../combat/combat.js";
import type { CombatResult } from "../types/result.js";
import type { EquipmentSlot } from "../inventory/item.enum.js";
import type { TitleDefinition } from "../title/title.types.js";
import type { AchievementDefinition } from "../achievements/achievement.types.js";
import type { LoadedContentPack } from "../content/content-pack.js";

/**
 * Convention de nommage des événements : `<sujet><Verbe>` en camelCase (style discord.js).
 *
 * - le **sujet** est l'objet du jeu concerné (`player`, `combat`, `item`, `bank`, `job`, `title`...) ;
 * - le **verbe** est à l'infinitif (`Create`, `Delete`, `Start`, `Add`, `Equip`, `LevelUp`...) ;
 * - un événement est émis **après** que l'action a réussi : l'état du jeu est déjà à jour dans le payload.
 *
 * Exemples : `playerCreate`, `combatStart`, `itemEquip`, `bankDeposit`, `titleGrant`.
 */

/**
 * Base des payloads rattachés à un joueur.
 *
 * `playerId` est toujours présent (filtrage peu coûteux, système de succès) ; `player` donne l'entité vivante.
 */
export interface PlayerEventPayload {
  /** Identifiant du joueur concerné. */
  readonly playerId: string;
  /** Entité du joueur concerné, à jour au moment de l'émission. */
  readonly player: PlayerEntity;
}

/** Lot d'objets (loot, récompenses). */
export interface ItemQuantity {
  readonly itemId: string;
  readonly quantity: number;
}

/** Issue d'un combat. */
export type CombatOutcome = "victory" | "defeat" | "aborted";

/**
 * Table officielle des événements du jeu (nom -> payload).
 *
 * Extensible côté consommateur par fusion de déclarations :
 * ```ts
 * declare module "dragons-of-legends.js" {
 *   interface GameEvents { fishCaught: { playerId: string; species: string } }
 * }
 * ```
 */
export interface GameEvents {
  // ── Monde ────────────────────────────────────────────────────────────────
  /** Le monde est prêt (émis une fois, au tick suivant sa création). */
  worldLaunch: { readonly world: World };
  /** Un pack de contenu a été chargé avec succès. */
  contentPackLoad: { readonly world: World; readonly pack: LoadedContentPack };

  // ── Joueur : cycle de vie ───────────────────────────────────────────────
  /** Un nouveau joueur a été créé et persisté (objets de départ inclus). */
  playerCreate: PlayerEventPayload & {
    readonly classId: string;
    readonly starterGold: number;
    readonly starterItems: ReadonlyArray<ItemQuantity>;
  };
  /** Un joueur existant a été chargé de la base vers le cache mémoire. */
  playerLoad: PlayerEventPayload;
  /** Un joueur a été déchargé du cache (inactivité ou arrêt) ; il reste en base. */
  playerUnload: PlayerEventPayload;
  /** Un joueur a été supprimé définitivement (mode hardcore, administration). */
  playerDelete: PlayerEventPayload;

  // ── Joueur : progression ────────────────────────────────────────────────
  playerExperienceGain: PlayerEventPayload & {
    readonly amount: number;
    readonly experience: number;
    readonly required: number;
    readonly levelsGained: number;
  };
  playerLevelUp: PlayerEventPayload & {
    readonly previousLevel: number;
    readonly level: number;
    readonly attributePoints: number;
  };
  playerAttributeUpgrade: PlayerEventPayload & {
    readonly attribute: Attribute;
    readonly value: number;
    readonly remainingPoints: number;
  };
  /** Variation du portefeuille (toute cause : butin, vente, banque...). */
  playerGoldChange: PlayerEventPayload & {
    readonly previous: number;
    readonly current: number;
    readonly delta: number;
  };

  // ── Joueur : santé et mort ──────────────────────────────────────────────
  playerDamage: PlayerEventPayload & {
    readonly rawDamage: number;
    readonly damage: number;
    readonly health: number;
    readonly maxHealth: number;
  };
  /** `respawnAt` (epoch ms) est défini en mode `cooldown` ; `lostGold`/`lostItems` en mode `loose`. */
  playerDeath: PlayerEventPayload & {
    readonly mode: "hardcore" | "cooldown" | "loose";
    readonly locationId: string;
    readonly respawnAt?: number;
    readonly lostGold?: number;
    readonly lostItems?: ReadonlyArray<ItemQuantity>;
  };
  /** Un joueur mort revient à la vie (fin du cooldown ou résurrection manuelle). */
  playerRevive: PlayerEventPayload & {
    readonly reason: "timer" | "manual";
    readonly health: number;
    readonly locationId: string;
  };

  // ── Voyage ──────────────────────────────────────────────────────────────
  travelStart: PlayerEventPayload & {
    readonly fromId: string;
    readonly toId: string;
    readonly distance: number;
    readonly danger: number;
    readonly durationMs: number;
  };
  travelComplete: PlayerEventPayload & {
    readonly fromId: string;
    readonly toId: string;
    readonly distance: number;
    readonly durationMs: number;
  };
  /** Le voyage est interrompu par une embuscade : le joueur reste à `fromId` et entre en combat. */
  travelAmbush: PlayerEventPayload & {
    readonly fromId: string;
    readonly toId: string;
    readonly enemy: EnemyEntity;
    readonly combat: Combat;
  };

  // ── Combat ──────────────────────────────────────────────────────────────
  combatStart: PlayerEventPayload & {
    readonly combat: Combat;
    readonly enemy: EnemyEntity;
  };
  /** Un tour (attaque du joueur + riposte éventuelle) a été joué. */
  combatTurn: PlayerEventPayload & {
    readonly combat: Combat;
    readonly enemy: EnemyEntity;
    readonly result: CombatResult;
  };
  combatEnd: PlayerEventPayload & {
    readonly combat: Combat;
    readonly enemy: EnemyEntity;
    readonly outcome: CombatOutcome;
  };
  /** Un ennemi est vaincu (récompenses déjà accordées). */
  enemyDefeat: PlayerEventPayload & {
    readonly combat: Combat;
    readonly enemy: EnemyEntity;
    readonly enemyId: string;
    readonly enemyType: string;
    readonly tier?: string;
    readonly locationId: string;
    readonly experience: number;
    readonly gold: number;
  };

  // ── Inventaire ──────────────────────────────────────────────────────────
  itemAdd: PlayerEventPayload & {
    readonly itemId: string;
    readonly name: string;
    readonly quantity: number;
  };
  itemRemove: PlayerEventPayload & {
    readonly itemId: string;
    readonly quantity: number;
  };
  itemEquip: PlayerEventPayload & {
    readonly itemId: string;
    readonly slot: EquipmentSlot;
  };
  itemUnequip: PlayerEventPayload & {
    readonly itemId: string;
    readonly slot: EquipmentSlot;
  };
  itemSell: PlayerEventPayload & {
    readonly itemId: string;
    readonly quantity: number;
    readonly gold: number;
  };

  // ── Banques ─────────────────────────────────────────────────────────────
  bankUnlock: PlayerEventPayload & { readonly cost: number };
  bankDeposit: PlayerEventPayload & {
    readonly amount: number;
    readonly wallet: number;
    readonly bankGold: number;
  };
  bankWithdraw: PlayerEventPayload & {
    readonly amount: number;
    readonly wallet: number;
    readonly bankGold: number;
  };
  itemBankDeposit: PlayerEventPayload & {
    readonly itemId: string;
    readonly quantity: number;
  };
  itemBankWithdraw: PlayerEventPayload & {
    readonly itemId: string;
    readonly quantity: number;
  };

  // ── Métiers ─────────────────────────────────────────────────────────────
  jobAction: PlayerEventPayload & {
    readonly jobId: string;
    readonly actionId: string;
    readonly xpGained: number;
    readonly previousLevel: number;
    readonly level: number;
    readonly loot: ReadonlyArray<ItemQuantity>;
  };
  jobLevelUp: PlayerEventPayload & {
    readonly jobId: string;
    readonly previousLevel: number;
    readonly level: number;
  };
  jobToolEquip: PlayerEventPayload & {
    readonly jobId: string;
    readonly itemId: string;
  };
  jobToolUnequip: PlayerEventPayload & {
    readonly jobId: string;
    readonly itemId: string;
  };

  // ── Titres, mariage, bestiaire ──────────────────────────────────────────
  titleGrant: PlayerEventPayload & { readonly title: TitleDefinition };
  titleRevoke: PlayerEventPayload & { readonly title: TitleDefinition };
  titleEquip: PlayerEventPayload & { readonly title: TitleDefinition };
  titleUnequip: PlayerEventPayload & { readonly title: TitleDefinition };
  marriageStart: PlayerEventPayload & { readonly partnerId: string };
  marriageDivorce: PlayerEventPayload & { readonly formerPartnerId: string };
  bestiaryDiscover: PlayerEventPayload & {
    readonly enemyType: string;
    readonly goldReward: number;
  };

  // ── Succès (portent le `playerId` seul : le moteur ne détient pas les entités) ─
  achievementProgress: {
    readonly playerId: string;
    readonly achievement: AchievementDefinition;
    readonly achievementId: string;
    readonly criterionId: string;
    readonly current: number;
    readonly target: number;
  };
  achievementUnlock: {
    readonly playerId: string;
    readonly achievement: AchievementDefinition;
    readonly achievementId: string;
    readonly at: number;
  };
}

/** Nom d'un événement du jeu. */
export type GameEventName = keyof GameEvents;

/** Payload d'un événement du jeu. */
export type GameEventPayload<K extends GameEventName> = GameEvents[K];

/** Noms des événements dont le payload porte un `playerId` (ceux que les succès peuvent écouter). */
export type PlayerGameEventName = {
  [K in GameEventName]: GameEvents[K] extends { readonly playerId: string }
    ? K
    : never;
}[GameEventName];

/** Moteur d'événements spécialisé pour le jeu. */
export type GameEventEngine = EventEngine<GameEvents>;

/**
 * Table de migration : anciens noms d'événements -> noms actuels.
 *
 * Les anciens noms ne sont plus émis ; cette table aide à migrer les `on("...")` et les critères de succès.
 */
// Rationale: `satisfies` vérifie à la compilation que chaque cible existe dans GameEvents.
export const LEGACY_EVENT_NAMES = {
  gameLaunched: "worldLaunch",
  monsterDefeated: "enemyDefeat",
  playerDied: "playerDeath",
  playerRevived: "playerRevive",
  itemAcquired: "itemAdd",
  goldChanged: "playerGoldChange",
  travelCompleted: "travelComplete",
  bestiaryDiscovered: "bestiaryDiscover",
  jobActionPerformed: "jobAction",
  achievementUnlocked: "achievementUnlock",
} as const satisfies Record<string, GameEventName>;
