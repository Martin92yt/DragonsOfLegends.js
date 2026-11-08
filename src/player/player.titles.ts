import { TitleNotOwnedError } from "../types/error.js";
import TitleManager from "../title/title.manager.js";
import type { TitleDefinition } from "../title/title.types.js";
import type PlayerEntity from "./player.entity.js";

/**
 * Titles owned by a player, and the single title currently equipped.
 *
 * Mutating methods persist the player right away.
 */
export default class PlayerTitles {
    private readonly ownedTitleIds: Set<string>;
    private equippedTitleId: string;

    /**
     * Creates the title collection of a player.
     *
     * @param player The owning player.
     * @param ownedTitleIds The identifiers of the owned titles.
     * @param equippedTitleId The identifier of the equipped title, or an empty string.
     * @returns void
     */
    public constructor(private readonly player: PlayerEntity, ownedTitleIds: readonly string[] = [], equippedTitleId = "") {
        this.ownedTitleIds = new Set(ownedTitleIds);
        // Rationale: an equipped title must always be owned; inconsistent saved data is repaired silently.
        this.equippedTitleId = this.ownedTitleIds.has(equippedTitleId) ? equippedTitleId : "";
    }

    private get registry(): TitleManager {
        return this.player.worldInstance.titles;
    }

    /**
     * Grants a title to the player.
     *
     * @param titleId The title identifier.
     * @returns True if the title was newly granted, false if already owned.
     * @throws {UnknownTitleError} If the title is not registered in the world.
     */
    public async grant(titleId: string): Promise<boolean> {
        const definition = this.registry.require(titleId);
        if (this.ownedTitleIds.has(titleId)) return false;

        this.ownedTitleIds.add(titleId);
        await this.player.worldInstance.players.save(this.player);
        await this.player.worldInstance.events.emitAsync("titleGrant", { playerId: this.player.id, player: this.player, title: definition });
        return true;
    }

    /**
     * Revokes a title; it is unequipped first if it was equipped.
     *
     * @param titleId The title identifier.
     * @returns True if the player owned the title.
     */
    public async revoke(titleId: string): Promise<boolean> {
        if (!this.ownedTitleIds.delete(titleId)) return false;
        const wasEquipped = this.equippedTitleId === titleId;
        if (wasEquipped) this.equippedTitleId = "";

        await this.player.worldInstance.players.save(this.player);
        const definition = this.registry.get(titleId);
        if (definition) {
            if (wasEquipped) {
                await this.player.worldInstance.events.emitAsync("titleUnequip", { playerId: this.player.id, player: this.player, title: definition });
            }
            await this.player.worldInstance.events.emitAsync("titleRevoke", { playerId: this.player.id, player: this.player, title: definition });
        }
        return true;
    }

    /**
     * Equips a title. Only one title can be equipped: it replaces the previous one.
     *
     * @param titleId The title identifier.
     * @returns The equipped title definition.
     * @throws {UnknownTitleError} If the title is not registered in the world.
     * @throws {TitleNotOwnedError} If the player does not own the title.
     */
    public async equip(titleId: string): Promise<TitleDefinition> {
        this.player.assertCanAct("titles.equip");
        const definition = this.registry.require(titleId);
        if (!this.ownedTitleIds.has(titleId)) throw new TitleNotOwnedError(this.player.id, titleId);

        this.equippedTitleId = titleId;
        await this.player.worldInstance.players.save(this.player);
        await this.player.worldInstance.events.emitAsync("titleEquip", { playerId: this.player.id, player: this.player, title: definition });
        return definition;
    }

    /**
     * Unequips the current title.
     *
     * @returns True if a title was equipped.
     */
    public async unequip(): Promise<boolean> {
        this.player.assertCanAct("titles.unequip");
        if (this.equippedTitleId === "") return false;

        const definition = this.registry.get(this.equippedTitleId);
        this.equippedTitleId = "";
        await this.player.worldInstance.players.save(this.player);
        if (definition) {
            await this.player.worldInstance.events.emitAsync("titleUnequip", { playerId: this.player.id, player: this.player, title: definition });
        }
        return true;
    }

    /**
     * Checks whether the player owns a title.
     *
     * @param titleId The title identifier.
     * @returns True if owned.
     */
    public has(titleId: string): boolean {
        return this.ownedTitleIds.has(titleId);
    }

    /**
     * Gets the equipped title.
     *
     * @returns The equipped title definition, or undefined if none (or no longer registered).
     */
    public getEquipped(): TitleDefinition | undefined {
        return this.equippedTitleId === "" ? undefined : this.registry.get(this.equippedTitleId);
    }

    /**
     * Lists the owned titles that are still registered, most prestigious first.
     *
     * @returns The owned title definitions.
     */
    public list(): TitleDefinition[] {
        return [...this.ownedTitleIds]
            .map((titleId) => this.registry.get(titleId))
            .filter((definition): definition is TitleDefinition => definition !== undefined)
            .sort(TitleManager.compare);
    }

    /**
     * Gets the raw owned identifiers (used for persistence).
     *
     * @returns The owned title identifiers.
     */
    public getOwnedIds(): string[] {
        return [...this.ownedTitleIds];
    }

    /**
     * Gets the raw equipped identifier (used for persistence).
     *
     * @returns The equipped title identifier, or an empty string.
     */
    public getEquippedId(): string {
        return this.equippedTitleId;
    }

    /**
     * Builds the profile display name, e.g. `Aria, Slime Slayer`.
     *
     * @returns The player name followed by the equipped title, if any.
     */
    public getDisplayName(): string {
        const equipped = this.getEquipped();
        return equipped ? `${this.player.name}, ${equipped.name}` : this.player.name;
    }
}
