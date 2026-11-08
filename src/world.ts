import { EventEmitter } from "node:events";
import LocationClass from "./location/location.js";
import PlayerManager from "./player/player.manager.js";
import CombatManager from "./combat/combat.manager.js";
import { consola } from "consola";
import BankClass from "./economy/bank.js";
import {
  DeathItemLossOptions,
  resolveDeathItemLossConfig,
} from "./player/Player.death.js";
import {
  type DeathRespawnOptions,
  resolveDeathRespawnConfig,
} from "./player/player.life.js";
import { parseDuration } from "./utils/duration.js";
import { EventEngine } from "./events/event.engine.js";
import type { GameEventEngine, GameEvents } from "./events/game.events.js";
import JobManager from "./jobs/job.manager.js";
import type { JobDefinition } from "./jobs/job.types.js";
import BestiaryManager from "./bestiary/bestiary.manager.js";
import type { BestiaryOptions } from "./bestiary/bestiary.types.js";
import { resolveItemBankCapacity } from "./economy/item-bank.js";
import TitleManager from "./title/title.manager.js";
import EnemyRegistry from "./enemy/enemy.registry.js";
import type {
  EnemyDefinition,
  EnemySpawnRule,
} from "./enemy/enemy.definition.js";
import EffectRegistry from "./effects/effect.registry.js";
import type { EffectDefinition } from "./effects/effect.types.js";
import LootboxManager from "./lootbox/lootbox.manager.js";
import type { LootboxDefinition } from "./lootbox/lootbox.types.js";
import ShopManager from "./shop/shop.manager.js";
import type { ShopDefinition } from "./shop/shop.types.js";
import ItemRegistry from "./inventory/item.registry.js";
import type { Item } from "./inventory/inventory.interface.js";
import PlayerClassRegistry from "./player/player-class.registry.js";
import type { PlayerClassDefinition } from "./player/player-class.definition.js";
import ContentManager from "./content/content-manager.js";
import type { ContentPack } from "./content/content-pack.js";
import {
  createOfficialPacks,
  OFFICIAL_PACK_IDS,
} from "./content/official-packs.js";
import type { LocationBuilder } from "./location/location.builder.js";
import type { LocationCreateParametres } from "./location/location.interface.js";
import type { TitleDefinition } from "./title/title.types.js";
import packageInfo from "../package.json" with { type: "json" };

consola.success("🐉 DragonsOfLegends.js loaded successfully!");
consola.warn(
  "DragonsOfLegends.js is currently in development; APIs may change.",
);

export interface WorldInitializationOptions {
  /**
   * Master switch of the official content (enabled by default). Set it to `false` to start from an empty world and
   * provide everything yourself; the individual `premade*` options still take precedence when set.
   */
  premadeContent?: boolean;
  /** Loads the official map (enabled by default). */
  premadeMap?: boolean;
  /** Loads the official enemies (enabled by default). */
  premadeEnemies?: boolean;
  /** Loads the official player classes (enabled by default). */
  premadeClasses?: boolean;
  /**
   * Loads the official items (starter equipment, potions, amulets, pouches), effects, lootboxes and shops.
   * Disabled by default, even with `premadeContent`: it makes the `starterItems` exist in the catalogue, so new players start receiving them.
   */
  premadeItems?: boolean;
  /** Additional or custom temporary effects registered at startup. */
  customEffects?: readonly EffectDefinition[];
  /** Additional or custom lootboxes registered at startup. */
  customLootboxes?: readonly LootboxDefinition[];
  /** Additional or custom shops registered at startup. */
  customShops?: readonly ShopDefinition[];
  /** Additional or custom enemy species registered at startup. */
  customEnemies?: readonly EnemyDefinition[];
  /** Additional or custom items registered at startup. */
  customItems?: readonly Item[];
  /** Additional or custom player classes registered at startup. */
  customClasses?: readonly PlayerClassDefinition[];
  /** Additional or custom locations registered at startup (the resulting map must be valid). */
  customLocations?: readonly (LocationCreateParametres | LocationBuilder)[];
  /** Content packs loaded at startup, after the official and custom content. */
  packs?: readonly ContentPack[];
  /** Rules choosing the enemy tier from the player level (see `DEFAULT_ENEMY_SPAWN_RULES`). */
  enemySpawnRules?: readonly EnemySpawnRule[];
  /** Loads the official titles (enabled by default). */
  premadeTitles?: boolean;
  /** Loads the official jobs (enabled by default). */
  premadeJobs?: boolean;
  /** Additional or custom jobs registered at startup. */
  customJobs?: readonly JobDefinition[];
  /** Bestiary options (automatic registration, discovery gold). */
  bestiary?: BestiaryOptions;
  /** Additional or custom titles registered at startup. */
  customTitles?: readonly TitleDefinition[];
  checkUpdates?: boolean;

  database?: {
    adapter?: "file" | "mongodb";
    path?: string;
    uri?: string;
    name?: string;
  };

  deathMode?: "hardcore" | "cooldown" | "loose";
  /**
   * Respawn cooldown of the `cooldown` death mode: milliseconds, or a string such as `"30s"`, `"5m"`, `"2h"`.
   * While it runs, the dead player cannot perform any action. Validated at world creation.
   */
  deathCooldown?: string | number;
  /** What happens when a dead player respawns (health restored, relocation). */
  deathRespawn?: DeathRespawnOptions;
  deathPenaltyRate?: number;
  /** Item loss on death (applied by the "loose" death mode). Disabled by default. */
  deathItemLoss?: DeathItemLossOptions;

  starterGold?: number;
  starterItems?: Record<string, number>;

  bankUnlockCost?: number;
  /** Number of slots of the item bank (40 by default). */
  bankCapacitySlots?: number;
  bankMaxGoldLimit?: number;

  regen?: {
    enabled: boolean;
    rate: number; // 5 PV récupérés par tour ou par action
    cooldown: number; // ou toutes les X secondes
  };
}

export default class World extends EventEmitter {
  public readonly combat: CombatManager;
  public readonly location: LocationClass;
  public readonly bank: BankClass;
  public readonly players: PlayerManager;
  public readonly titles: TitleManager;
  /** Item catalogue. */
  public readonly items: ItemRegistry;
  /** Enemy species. */
  public readonly enemies: EnemyRegistry;
  /** Temporary effects (potions, buffs). */
  public readonly effects: EffectRegistry;
  /** Lootboxes (mystery pouches). */
  public readonly lootboxes: LootboxManager;
  /** Shops (buy and sell with gold). */
  public readonly shops: ShopManager;
  /** Player classes. */
  public readonly classes: PlayerClassRegistry;
  /** Loads content packs (official and third-party) into the registries above. */
  public readonly content: ContentManager;
  public readonly events: GameEventEngine;
  public readonly jobs: JobManager;
  public readonly bestiary: BestiaryManager;
  public initializationOptions: WorldInitializationOptions;
  /**
   * Creates an instance of the World class and initializes game systems.
   *
   * @param initializationOptions Configuration settings for the world initialization.
   * @returns void
   */
  public constructor(initializationOptions: WorldInitializationOptions = {}) {
    super();

    // Fusion propre des options par défaut et personnalisées
    const premade = initializationOptions.premadeContent ?? true;
    this.initializationOptions = {
      premadeMap: premade,
      premadeTitles: premade,
      premadeJobs: premade,
      premadeEnemies: premade,
      // Opt-in: registering the official items starts granting the starter items to every new player.
      premadeItems: false,
      premadeClasses: premade,
      checkUpdates: true,
      deathMode: "cooldown",
      deathCooldown: "1m",
      deathPenaltyRate: 5,
      starterGold: 150,
      starterItems: { health_potion: 3, rusty_sword: 1 },
      bankUnlockCost: 1000,
      bankMaxGoldLimit: 500000,
      ...initializationOptions,
      database: {
        adapter: "file",
        path: "./data.db",
        ...initializationOptions.database,
      },
      regen: {
        enabled: true,
        rate: 5,
        cooldown: 10,
        ...initializationOptions.regen,
      },
    };

    // Fail-fast : valide les taux de perte d'objets dès la création du monde
    resolveDeathItemLossConfig(this.initializationOptions.deathItemLoss);
    resolveItemBankCapacity(this.initializationOptions.bankCapacitySlots);
    parseDuration(this.initializationOptions.deathCooldown ?? "1m");
    resolveDeathRespawnConfig(this.initializationOptions.deathRespawn);

    // Initialisation des managers et des systèmes du monde
    this.location = new LocationClass();
    this.bank = new BankClass(this);
    this.titles = new TitleManager();
    this.items = new ItemRegistry();
    this.enemies = new EnemyRegistry();
    this.effects = new EffectRegistry();
    this.lootboxes = new LootboxManager(this.items);
    this.shops = new ShopManager(this.items);
    this.classes = new PlayerClassRegistry();
    this.events = new EventEngine<GameEvents>({ logger: consola });
    this.jobs = new JobManager();
    this.combat = new CombatManager(
      this.enemies,
      this.initializationOptions.enemySpawnRules,
      (playerId) => this.players.peek(playerId),
    );
    this.players = new PlayerManager(this);
    this.bestiary = new BestiaryManager(
      this,
      this.initializationOptions.bestiary,
    );
    this.content = new ContentManager(this, {
      items: this.items,
      enemies: this.enemies,
      effects: this.effects,
      lootboxes: this.lootboxes,
      shops: this.shops,
      classes: this.classes,
      jobs: this.jobs,
      titles: this.titles,
      location: this.location,
    });

    this.initializeWorld(this.initializationOptions);
    this.setupRegeneration();
    setTimeout(() => {
      this.events.emit("worldLaunch", { world: this });
      // Deprecated untyped Node emitter, kept so existing `world.once("gameLaunched")` code keeps working.
      this.emit("gameLaunched");
    }, 0);
  }

  /**
   * Configure le timer automatique de régénération des joueurs si activé.
   */
  private setupRegeneration(): void {
    const regenConfig = this.initializationOptions.regen;
    if (!regenConfig?.enabled) return;

    const regenRate = regenConfig.rate;
    const regenCooldownMs = (regenConfig.cooldown || 10) * 1000;

    const regenInterval = setInterval(() => {
      this.players.tickRegen(regenRate);
    }, regenCooldownMs);

    // Empêche l'intervalle de bloquer la fermeture du processus Node.js si besoin
    regenInterval.unref?.();
  }

  /**
   * Initializes the world systems based on provided configuration options.
   *
   * @param options Configuration settings for world initialization.
   * @returns void
   */
  private initializeWorld(options: WorldInitializationOptions): void {
    if (options.checkUpdates) {
      this.checkForUpdates();
    }

    // The official content is delivered as ordinary content packs, through the same API as third-party packs.
    const officialPacks = createOfficialPacks();
    const enabled: Readonly<Record<string, boolean | undefined>> = {
      [OFFICIAL_PACK_IDS.enemies]: options.premadeEnemies,
      [OFFICIAL_PACK_IDS.items]: options.premadeItems,
      [OFFICIAL_PACK_IDS.classes]: options.premadeClasses,
      [OFFICIAL_PACK_IDS.jobs]: options.premadeJobs,
      [OFFICIAL_PACK_IDS.titles]: options.premadeTitles,
      [OFFICIAL_PACK_IDS.map]: options.premadeMap,
    };
    for (const pack of officialPacks) {
      if (enabled[pack.id]) this.content.use(pack);
    }

    const customPack: ContentPack = {
      id: "world:custom",
      name: "World options content",
      ...(options.customItems ? { items: options.customItems } : {}),
      ...(options.customEffects ? { effects: options.customEffects } : {}),
      ...(options.customLootboxes ? { lootboxes: options.customLootboxes } : {}),
      ...(options.customShops ? { shops: options.customShops } : {}),
      ...(options.customEnemies ? { enemies: options.customEnemies } : {}),
      ...(options.customClasses ? { classes: options.customClasses } : {}),
      ...(options.customJobs ? { jobs: options.customJobs } : {}),
      ...(options.customTitles ? { titles: options.customTitles } : {}),
      ...(options.customLocations
        ? { locations: options.customLocations }
        : {}),
    };
    this.content.use(customPack);

    for (const pack of options.packs ?? []) {
      this.content.use(pack);
    }
  }

  /**
   * Checks the npm registry for package updates against the current local version.
   *
   * @returns A promise that resolves when the update check is complete.
   */
  public async checkForUpdates(): Promise<void> {
    try {
      const { name: packageName, version: installedVersion } = packageInfo;
      const registryVersion = await this.fetchLatestVersion(packageName);

      if (!registryVersion) {
        return;
      }

      this.compareVersions(packageName, installedVersion, registryVersion);
    } catch (error) {
      consola.error("An error occurred while checking for updates.");
    }
  }

  /**
   * Fetches the latest version of the package from the npm registry.
   *
   * @param targetPackageName The name of the package being checked.
   * @returns A promise resolving to the latest version string, or undefined if the request failed.
   */
  private async fetchLatestVersion(
    targetPackageName: string,
  ): Promise<string | undefined> {
    const registryResponse = await fetch(
      `https://registry.npmjs.org/${targetPackageName}/latest`,
    );
    if (!registryResponse.ok) {
      consola.warn("Failed to check for updates from npm registry.");
      return undefined;
    }

    const registryData = (await registryResponse.json()) as { version: string };
    return registryData.version;
  }

  /**
   * Compares the current local version with the latest registry version and logs the outcome.
   *
   * @param targetPackageName The name of the package.
   * @param installedVersion The local version currently installed.
   * @param registryVersion The latest version retrieved from the npm registry.
   * @returns void
   */
  private compareVersions(
    targetPackageName: string,
    installedVersion: string,
    registryVersion: string,
  ): void {
    if (registryVersion !== installedVersion) {
      consola.warn(
        `A new version of ${targetPackageName} is available: ${registryVersion} (currently installed: ${installedVersion})`,
      );
    } else {
      consola.info("Package is up to date.");
    }
  }

  /**
   * Quickly saves the world state, stops active systems, and closes down the environment.
   *
   * @returns A promise that resolves when the world shutdown sequence is complete.
   */
  public async quick(): Promise<void> {
    this.combat.stopAllCombats();
    this.bank.close();
    await this.players.saveAll();
    consola.info("World state successfully saved and closed.");
  }
}
