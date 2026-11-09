/**
 * DragonsOfLegends.js — point d'entrée principal.
 * (table des sous-chemins en TSDoc, voir le fichier du zip)
 * @packageDocumentation
 */

// ── Core ────────────────────────────────────────────────────────────────────
export { default } from "./world.js";
export {
  default as World,
  type WorldInitializationOptions as WorldOptions,
} from "./world.js";

// ── Joueur ──────────────────────────────────────────────────────────────────
export { default as PlayerManager } from "./player/player.manager.js";
export { default as PlayerEntity } from "./player/player.entity.js";
export { PlayerClass } from "./player/player.class.js";
export { default as PlayerLife } from "./player/player.life.js";
export { default as PlayerMarriage } from "./player/player.marriage.js";
export { default as PlayerTitles } from "./player/player.titles.js";
export { default as PlayerJobs } from "./player/player.jobs.js";
export { default as PlayerBestiary } from "./player/player.bestiary.js";
export type {
  DeathResult,
  DeathItemLossOptions,
} from "./player/Player.death.js";
export type { DeathRespawnOptions } from "./player/player.life.js";

// ── Combat et ennemis ───────────────────────────────────────────────────────
export { default as CombatManager } from "./combat/combat.manager.js";
export { default as Combat } from "./combat/combat.js";
export { default as EnemyManager } from "./enemy/enemy.manager.js";
export { default as EnemyEntity } from "./enemy/enemy.js";
export { EnemyType } from "./enemy/enemy.type.js";

// ── Inventaire et économie ──────────────────────────────────────────────────
export { InventoryEntity } from "./inventory/inventory.js";
export {
  ItemCategory,
  ItemRarity,
  type EquipmentSlot,
} from "./inventory/item.enum.js";
export type { Item, ItemNBT } from "./inventory/inventory.interface.js";
export { default as BankClass } from "./economy/bank.js";
export { default as ItemBank } from "./economy/item-bank.js";

// ── Monde et localisations ──────────────────────────────────────────────────
export { default as LocationManager } from "./location/location.js";
export { LocationBuilder } from "./location/location.builder.js";
export { LocationFlags } from "./location/location.flags.js";
export { LocationType } from "./location/location.type.js";

// ── Métiers, titres, bestiaire, succès ──────────────────────────────────────
export { default as JobManager } from "./jobs/job.manager.js";
export {
  createJobToolNbt,
  type JobDefinition,
  type JobActionDefinition,
  type JobLootEntry,
} from "./jobs/job.types.js";
export { default as TitleManager } from "./title/title.manager.js";
export { TitleRarity, type TitleDefinition } from "./title/title.types.js";
export { createTitleRewardHandler } from "./title/title.rewards.js";
export { default as BestiaryManager } from "./bestiary/bestiary.manager.js";
export type { BestiaryOptions } from "./bestiary/bestiary.types.js";
export {
  AchievementManager,
  type AchievementManagerOptions,
} from "./achievements/achievement.manager.js";
export type {
  AchievementDefinition,
  AchievementReward,
  AchievementCriterion,
} from "./achievements/achievement.types.js";

// ── Registres et modding ────────────────────────────────────────────────────
export { default as Registry } from "./registry/registry.js";
export { default as ItemRegistry } from "./inventory/item.registry.js";
export { default as EnemyRegistry } from "./enemy/enemy.registry.js";
export { default as PlayerClassRegistry } from "./player/player-class.registry.js";
export { default as ContentManager } from "./content/content-manager.js";
export {
  defineContentPack,
  type ContentPack,
  type LoadedContentPack,
  type UseContentPackOptions,
} from "./content/content-pack.js";
export type { EnemyDefinition } from "./enemy/enemy.definition.js";
export type { PlayerClassDefinition } from "./player/player-class.definition.js";

// ── Événements ──────────────────────────────────────────────────────────────
export { EventEngine } from "./events/event.engine.js";
export type {
  GameEvents,
  GameEventName,
  GameEventPayload,
  PlayerEventPayload,
  GameEventEngine,
} from "./events/game.events.js";

// ── Effets temporaires, amulettes, boutiques et poches mystères ────────────
export { default as EffectRegistry } from "./effects/effect.registry.js";
export { default as PlayerEffects } from "./player/player.effects.js";
export type {
  EffectDefinition,
  EffectModifiers,
  EffectContext,
  EffectTick,
  EffectStacking,
  ActiveEffectView,
  ApplyEffectOptions,
} from "./effects/effect.types.js";
export type { ItemUse } from "./inventory/inventory.interface.js";
export {
  createAmuletNbt,
  readAmuletModifiers,
  AMULET_NBT_KEYS,
  type AmuletModifiers,
} from "./inventory/amulet.js";
export {
  resolvePlayerModifiers,
  scaleExperience,
  type PlayerModifiers,
} from "./player/player.modifiers.js";
export { default as LootboxManager } from "./lootbox/lootbox.manager.js";
export { computeDropChances, computeDropWeights, pickDrop } from "./lootbox/lootbox.rules.js";
export type {
  LootboxDefinition,
  LootboxDrop,
  LootboxGoldDrop,
  LootboxItemDrop,
  LootboxOpenResult,
  LootboxDropChance,
} from "./lootbox/lootbox.types.js";
export { default as ShopManager } from "./shop/shop.manager.js";
export type {
  ShopDefinition,
  ShopListing,
  ShopPurchaseResult,
  ShopSaleResult,
} from "./shop/shop.types.js";
export {
  OFFICIAL_EFFECTS,
  OFFICIAL_ITEMS,
  OFFICIAL_LOOTBOXES,
  OFFICIAL_SHOPS,
} from "./content/official-items.js";

// ── API complète documentée : erreurs, règles, contenu officiel ─────────────
export * from "./types/error.js";
export {
  EventEngineError,
  EventListenerError,
  EventTimeoutError,
  EventAbortedError,
} from "./events/event.engine.js";
export { LEGACY_EVENT_NAMES } from "./events/game.events.js";
export {
  AchievementError,
  InvalidAchievementError,
  DuplicateAchievementError,
  UnknownAchievementError,
  AchievementSerializationError,
  ACHIEVEMENT_SNAPSHOT_VERSION,
} from "./achievements/achievement.types.js";
export { parsePlayerSnapshot, parseDump } from "./achievements/achievement.serialization.js";
export { TITLE_RARITY_WEIGHTS } from "./title/title.types.js";
export { OFFICIAL_TITLES, registerOfficialTitles } from "./title/official-titles.js";
export {
  handlePlayerDeath,
  resolveDeathItemLossConfig,
  DEFAULT_DEATH_LOSS_RATES,
} from "./player/Player.death.js";
export { DEFAULT_ITEM_BANK_CAPACITY_SLOTS, resolveItemBankCapacity } from "./economy/item-bank.js";
export { resolveDeathRespawnConfig } from "./player/player.life.js";
export { parseDuration } from "./utils/duration.js";
export {
  BESTIARY_SPECIES,
  DEFAULT_DISCOVERY_GOLD,
} from "./bestiary/bestiary.species.js";
export { BESTIARY_UNKNOWN_LABEL, parseBestiaryState } from "./bestiary/bestiary.types.js";
export { FISHING_JOB } from "./jobs/official/fishing.job.js";
export { MINING_JOB } from "./jobs/official/mining.job.js";
export { WOODCUTTING_JOB } from "./jobs/official/woodcutting.job.js";
export { OFFICIAL_JOBS, registerOfficialJobs } from "./jobs/official-jobs.js";
export {
  applyYield,
  RARITY_LUCK_FACTORS,
  xpRequiredForLevel,
  effectiveCooldownMs,
  readToolModifiers,
  pickLootEntry,
} from "./jobs/job.rules.js";
export {
  DEFAULT_JOB_MAX_LEVEL,
  DEFAULT_JOB_XP_CURVE,
  JOB_TOOL_NBT_KEYS,
  MAX_COOLDOWN_REDUCTION_PERCENT,
} from "./jobs/job.types.js";
export { parsePlayerJobsState } from "./jobs/job.serialization.js";
export { createOfficialPacks, OFFICIAL_PACK_IDS } from "./content/official-packs.js";
export { DEFAULT_ENEMY_SPAWN_RULES } from "./enemy/enemy.definition.js";
export { OFFICIAL_ENEMIES, registerOfficialEnemies } from "./enemy/official-enemies.js";
export { OFFICIAL_CLASSES, registerOfficialClasses } from "./player/official-classes.js";
export { createOfficialLocations } from "./location/official-map.js";
export { OFFICIAL_ACHIEVEMENTS } from "./achievements/official-achievements.js";
export { createPlayerRewardHandler } from "./achievements/achievement.rewards.js";
