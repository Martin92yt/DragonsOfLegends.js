import {
  CreatePlayerOptions,
  PlayerCount,
  PlayerData,
} from "./player.interface.js";
import PlayerDatabase from "./player.database.js";
import Player from "./player.entity.js";
import { consola } from "consola";
import World from "../world.js";
import { PlayerAlreadyExistsError } from "../types/error.js";
import { InventoryEntity } from "../inventory/inventory.js";
import type { ItemQuantity } from "../events/game.events.js";

export default class PlayerManager {
  private static readonly INACTIVITY_TIME_MS = 15 * 60 * 1000;
  public readonly world: World;
  private readonly activePlayersMap = new Map<string, Player>();
  private readonly unloadTimersMap = new Map<string, NodeJS.Timeout>();
  private readonly playerDatabase;

  constructor(worldInstance: World) {
    this.world = worldInstance;
    this.playerDatabase = new PlayerDatabase(this);
  }

  /**
   * Ensures that a player exists in memory.
   */
  public async ensure(
    playerIdOrCreationOptions: string | CreatePlayerOptions,
  ): Promise<Player | undefined> {
    if (typeof playerIdOrCreationOptions === "string") {
      return await this.get(playerIdOrCreationOptions);
    }

    const existingPlayer = await this.get(playerIdOrCreationOptions.id);
    if (existingPlayer) {
      return existingPlayer;
    }

    return await this.create(playerIdOrCreationOptions);
  }

  /**
   * Gets a player by identifier.
   */
  public async get(playerId: string): Promise<Player | undefined> {
    const activePlayer = this.activePlayersMap.get(playerId);

    if (activePlayer) {
      this.refreshUnloadTimer(playerId);
      return activePlayer;
    }

    const dbResult = this.playerDatabase.get(playerId);
    const playerData = dbResult instanceof Promise ? await dbResult : dbResult;

    if (!playerData) {
      return undefined;
    }

    return await this.loadPlayerIntoCache(playerData);
  }

  private async loadPlayerIntoCache(playerData: PlayerData): Promise<Player> {
    const playerInstance = new Player(
      this.world,
      playerData.id,
      playerData.name,
      playerData.classId,
      playerData.locationId,
      playerData.level,
      playerData.experience,
      playerData.health,
      playerData.maxHealth,
      playerData.partnerId,
      playerData.gold,
      playerData.bankGold,
      playerData.bankUnlocked,
      playerData.strength,
      playerData.agility,
      playerData.intelligence,
      playerData.defense,
      playerData.attributePoints,
      playerData.titles ?? [],
      playerData.equippedTitleId ?? "",
      playerData.bestiary,
      playerData.jobs,
      playerData.deadUntil ?? null,
      playerData.effects,
    );

    await playerInstance.inventory.load();
    this.activePlayersMap.set(playerData.id, playerInstance);
    // Credits the ticks and expirations that elapsed while the player was unloaded.
    await playerInstance.effects.sync();
    this.refreshUnloadTimer(playerData.id);
    consola.debug(`Player ${playerData.id} loaded into cache.`);
    await this.world.events.emitAsync("playerLoad", {
      playerId: playerData.id,
      player: playerInstance,
    });

    return playerInstance;
  }

  /**
   * Creates and persists a new player.
   */
  public async create(creationOptions: CreatePlayerOptions): Promise<Player> {
    const { id: playerId, name: playerName, playerClass } = creationOptions;

    if (await this.exist(playerId)) {
      consola.warn(`Attempt to create already existing player ${playerId}.`);
      throw new PlayerAlreadyExistsError(playerId);
    }

    const newPlayerInstance = new Player(
      this.world,
      playerId,
      playerName,
      playerClass,
      this.world.location.getStartingCityId(),
      1,
      0,
      100,
      100,
      "",
      this.world.initializationOptions.starterGold ?? 0,
    );

    this.activePlayersMap.set(playerId, newPlayerInstance);
    await this.save(newPlayerInstance);
    const starterItems = await this.grantStarterItems(newPlayerInstance);
    this.refreshUnloadTimer(playerId);
    consola.success(`Player ${playerId} created.`);
    await this.world.events.emitAsync("playerCreate", {
      playerId,
      player: newPlayerInstance,
      classId: playerClass,
      starterGold: newPlayerInstance.gold,
      starterItems,
    });

    return newPlayerInstance;
  }

  /**
   * Gets a loaded player without touching the database or the unload timer.
   *
   * @param playerId The player identifier.
   * @returns The cached player, or undefined if not loaded.
   */
  public peek(playerId: string): Player | undefined {
    return this.activePlayersMap.get(playerId);
  }

  /**
   * Revives a dead player right now (resurrection item, admin command...).
   *
   * @param playerId The player identifier.
   * @returns True if the player was dead and has been revived, false if they were alive.
   * @throws {Error} If the player does not exist.
   */
  public async revive(playerId: string): Promise<boolean> {
    const player = await this.get(playerId);
    if (!player) throw new Error(`Cannot revive unknown player ${playerId}.`);
    return player.life.revive();
  }

  /**
   * Gives the `starterItems` of the world that exist in the item catalogue.
   * Identifiers that are not registered are skipped: the catalogue is provided by content packs.
   *
   * @param player The new player.
   * @returns The items actually granted.
   */
  private async grantStarterItems(player: Player): Promise<ItemQuantity[]> {
    const granted: ItemQuantity[] = [];
    for (const [itemId, quantity] of Object.entries(
      this.world.initializationOptions.starterItems ?? {},
    )) {
      const item = this.world.items.get(itemId);
      if (!item) {
        consola.debug(
          `Starter item "${itemId}" is not registered in the item catalogue; skipped.`,
        );
        continue;
      }
      await player.inventory.add(item, quantity);
      granted.push({ itemId, quantity });
    }
    return granted;
  }

  public tickRegen(amount: number = 5): void {
    for (const [playerId, playerInstance] of this.activePlayersMap) {
      // A dead player does not regenerate: only the respawn brings them back (an elapsed cooldown revives them here).
      if (playerInstance.isDead) continue;
      if (playerInstance.health.current < playerInstance.health.max) {
        const oldHealth = playerInstance.health.current;
        playerInstance.health.current = Math.min(
          playerInstance.health.max,
          playerInstance.health.current + amount,
        );

        consola.debug(
          `Player ${playerId} regenerated health: ${oldHealth} -> ${playerInstance.health.current}/${playerInstance.health.max}`,
        );
      }
    }
  }

  /**
   * Checks whether a player exists.
   */
  public async exist(playerId: string): Promise<boolean> {
    if (this.activePlayersMap.has(playerId)) {
      return true;
    }
    const dbResult = this.playerDatabase.get(playerId);
    const playerData = dbResult instanceof Promise ? await dbResult : dbResult;
    return playerData !== undefined;
  }

  public async delete(playerId: string): Promise<boolean> {
    this.clearUnloadTimer(playerId);
    // The cached instance is the one listeners and stale references know: keep it for the cleanup and the event.
    const cachedPlayer = this.activePlayersMap.get(playerId);
    cachedPlayer?.life.dispose();
    cachedPlayer?.effects.dispose();
    this.activePlayersMap.delete(playerId);
    const player = cachedPlayer ?? (await this.get(playerId));
    if (!player) {
      consola.warn(
        `Failed to delete non-existent player ${playerId} from database.`,
      );
      return false;
    }
    await new InventoryEntity(playerId, player).clear();
    await player.itemBank.clear();

    const dbDeleteResult = this.playerDatabase.delete(playerId);
    const isDeleted =
      dbDeleteResult instanceof Promise ? await dbDeleteResult : dbDeleteResult;

    // `get` may have re-cached a player loaded from the database: a deleted player must not stay in memory.
    this.clearUnloadTimer(playerId);
    this.activePlayersMap.delete(playerId);

    if (isDeleted) {
      consola.info(`Player ${playerId} deleted.`);
      await this.world.events.emitAsync("playerDelete", { playerId, player });
    } else {
      consola.warn(
        `Failed to delete non-existent player ${playerId} from database.`,
      );
    }

    return isDeleted as boolean;
  }

  public count(): PlayerCount {
    // Gardé synchrone si getPlayerCount() est synchrone, ou à adapter si `count()` est aussi une Promise dans ta base.
    return {
      active: this.activePlayersMap.size,
      total: (this.playerDatabase.count() as number) ?? 0,
    };
  }

  public async remove(playerId: string): Promise<void> {
    const playerInstance = this.activePlayersMap.get(playerId);

    if (!playerInstance) {
      consola.warn(`Attempt to remove non-cached player ${playerId}.`);
      this.clearUnloadTimer(playerId);
      return;
    }

    await this.save(playerInstance);
    this.clearUnloadTimer(playerId);
    playerInstance.life.dispose();
    playerInstance.effects.dispose();
    this.activePlayersMap.delete(playerId);
    await this.world.events.emitAsync("playerUnload", {
      playerId,
      player: playerInstance,
    });
  }

  private refreshUnloadTimer(playerId: string): void {
    this.clearUnloadTimer(playerId);

    const inactivityTimer = setTimeout(async () => {
      await this.remove(playerId);
    }, PlayerManager.INACTIVITY_TIME_MS);

    inactivityTimer.unref();
    this.unloadTimersMap.set(playerId, inactivityTimer);
  }

  private clearUnloadTimer(playerId: string): void {
    const inactivityTimer = this.unloadTimersMap.get(playerId);

    if (!inactivityTimer) {
      return;
    }

    clearTimeout(inactivityTimer);
    this.unloadTimersMap.delete(playerId);
  }

  public async save(playerInstance: Player): Promise<void> {
    const playerData: PlayerData = {
      id: playerInstance.id,
      name: playerInstance.name,
      classId: playerInstance.classId,
      locationId: playerInstance.location,
      level: playerInstance.level,
      experience: playerInstance.experience.current,
      health: playerInstance.health.current,
      maxHealth: playerInstance.health.max,
      partnerId: playerInstance.marriage?.getPartnerId() ?? "",
      strength: playerInstance.attributes.strength,
      agility: playerInstance.attributes.agility,
      intelligence: playerInstance.attributes.intelligence,
      defense: playerInstance.attributes.defense,
      attributePoints: playerInstance.attributes.points,
      gold: playerInstance.gold,
      bankGold: playerInstance.bankGold,
      bankUnlocked: playerInstance.bankUnlocked,
      titles: playerInstance.titles.getOwnedIds(),
      equippedTitleId: playerInstance.titles.getEquippedId(),
      bestiary: playerInstance.bestiary.toState(),
      jobs: playerInstance.jobs.toState(),
      deadUntil: playerInstance.life.getPersistedDeadUntil(),
      effects: playerInstance.effects.toState(),
    };

    const saveResult = this.playerDatabase.save(playerData);
    if (saveResult instanceof Promise) await saveResult;
  }

  public async has(playerId: string): Promise<boolean> {
    return await this.exist(playerId);
  }

  public get size(): number {
    return this.activePlayersMap.size;
  }

  public async saveAll(): Promise<void> {
    for (const [playerId, playerInstance] of this.activePlayersMap) {
      await this.save(playerInstance);
      await playerInstance.inventory.save();
      this.clearUnloadTimer(playerId);
    }

    consola.success("All players saved.");
  }
}
