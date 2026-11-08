export type TransportMode = "landRoutes" | "boatRoutes";

export type AttributeType = "strength" | "agility" | "intelligence" | "vitality";

export class PlayerNoCharacterError extends Error {
    /**
     * Creates an error indicating that a player has no registered character.
     * 
     * @returns void
     */
    public constructor() {
        super("One of the players does not have a registered character.");
        this.name = "PlayerNoCharacterError";
    }
}

export class SelfCombatError extends Error {
    /**
     * Creates an error indicating that a player cannot fight themselves.
     * 
     * @returns void
     */
    public constructor() {
        super("You cannot fight yourself!");
        this.name = "SelfCombatError";
    }
}

export class PlayerAlreadyInCombatError extends Error {
    /**
     * Creates an error indicating that a player is already in combat.
     *
     * @param playerId The player identifier.
     * @returns void
     */
    public constructor(playerId: string) {
        super(`Player ${playerId} is already in combat.`);
        this.name = "PlayerAlreadyInCombatError";
    }
}

export class PlayerNotInCombatError extends Error {
    /**
     * Creates an error indicating that a player is not in combat.
     *
     * @param playerId The player identifier.
     * @returns void
     */
    public constructor(playerId: string) {
        super(`Player ${playerId} is not in combat.`);
        this.name = "PlayerNotInCombatError";
    }
}

export class LocationIdEmptyError extends Error {
    /**
     * Creates an error indicating that a location identifier is empty.
     * 
     * @returns void
     */
    public constructor() {
        super("Location ID cannot be empty.");
        this.name = "LocationIdEmptyError";
    }
}

export class LocationAlreadyExistsError extends Error {
    /**
     * Creates an error indicating that a location already exists.
     *
     * @param locationId The location identifier.
     * @returns void
     */
    public constructor(locationId: string) {
        super(`Location "${locationId}" already exists.`);
        this.name = "LocationAlreadyExistsError";
    }
}

export class LocationInexistentLinkError extends Error {
    /**
     * Creates an error indicating that a location link references an unknown location.
     *
     * @param sourceLocationId The source location identifier.
     * @param targetLocationId The target location identifier.
     * @returns void
     */
    public constructor(sourceLocationId: string, targetLocationId: string) {
        super(`Cannot link nonexistent locations: "${sourceLocationId}" <-> "${targetLocationId}".`);
        this.name = "LocationInexistentLinkError";
    }
}

export class NoStartingCityError extends Error {
    /**
     * Creates an error indicating that no starting city is defined.
     * 
     * @returns void
     */
    public constructor() {
        super("No starting city defined.");
        this.name = "NoStartingCityError";
    }
}

export class MultipleStartingCitiesError extends Error {
    /**
     * Creates an error indicating that multiple starting cities are defined.
     *
     * @param starterCityIds The starting city identifiers.
     * @returns void
     */
    public constructor(starterCityIds: string[]) {
        super(`Multiple starting cities found: ${starterCityIds.join(", ")}.`);
        this.name = "MultipleStartingCitiesError";
    }
}

export class SelfConnectionError extends Error {
    /**
     * Creates an error indicating that a location cannot connect to itself.
     *
     * @param locationId The location identifier.
     * @param transportMode The transport mode.
     * @returns void
     */
    public constructor(locationId: string, transportMode: TransportMode) {
        super(`Location "${locationId}" cannot connect to itself by ${transportMode}.`);
        this.name = "SelfConnectionError";
    }
}

export class InvalidConnectionTargetError extends Error {
    /**
     * Creates an error indicating that a connection target is invalid.
     *
     * @param locationId The source location identifier.
     * @param transportMode The transport mode.
     * @param destinationId The target location identifier.
     * @returns void
     */
    public constructor(locationId: string, transportMode: TransportMode, destinationId: string) {
        super(`Location "${locationId}" has an invalid ${transportMode} connection to "${destinationId}".`);
        this.name = "InvalidConnectionTargetError";
    }
}

export class NonReciprocalConnectionError extends Error {
    /**
     * Creates an error indicating that a connection is not reciprocal.
     *
     * @param transportMode The transport mode.
     * @param sourceLocationId The source location identifier.
     * @param targetLocationId The target location identifier.
     * @returns void
     */
    public constructor(transportMode: TransportMode, sourceLocationId: string, targetLocationId: string) {
        super(`${transportMode} connection "${sourceLocationId}" -> "${targetLocationId}" is not reciprocal.`);
        this.name = "NonReciprocalConnectionError";
    }
}

export class BoatWaterFlagRequiredError extends Error {
    /**
     * Creates an error indicating that a boat connection requires water locations.
     *
     * @param sourceLocationId The source location identifier.
     * @param targetLocationId The target location identifier.
     * @returns void
     */
    public constructor(sourceLocationId: string, targetLocationId: string) {
        super(`Boat connection "${sourceLocationId}" -> "${targetLocationId}" requires the OnWater flag on both locations.`);
        this.name = "BoatWaterFlagRequiredError";
    }
}

export class UnreachableLocationsError extends Error {
    /**
     * Creates an error indicating that some locations cannot be reached.
     *
     * @param unreachedLocationIds The unreachable location identifiers.
     * @returns void
     */
    public constructor(unreachedLocationIds: string[]) {
        super(`Unreachable locations: ${unreachedLocationIds.join(", ")}.`);
        this.name = "UnreachableLocationsError";
    }
}

export class PlayerAlreadyTravellingError extends Error {
    /**
     * Creates an error indicating that a player is already travelling.
     * 
     * @returns void
     */
    public constructor() {
        super("Player is already travelling.");
        this.name = "PlayerAlreadyTravellingError";
    }
}

export class MoveInCombatError extends Error {
    /**
     * Creates an error indicating that movement is not allowed during combat.
     * 
     * @returns void
     */
    public constructor() {
        super("Cannot move while in combat!");
        this.name = "MoveInCombatError";
    }
}

export class NoAttributePointsError extends Error {
    /**
     * Creates an error indicating that no attribute points are available.
     * 
     * @returns void
     */
    public constructor() {
        super("No attribute points available.");
        this.name = "NoAttributePointsError";
    }
}

export class UnknownPlayerClassError extends Error {
    /**
     * Creates an error indicating that a player class is unknown.
     *
     * @param playerClassId The player class identifier.
     * @returns void
     */
    public constructor(playerClassId: string) {
        super(`Unknown player class: ${playerClassId}.`);
        this.name = "UnknownPlayerClassError";
    }
}

export class PlayerAlreadyExistsError extends Error {
    /**
     * Creates an error indicating that a player already exists.
     *
     * @param playerId The player identifier.
     * @returns void
     */
    public constructor(playerId: string) {
        super(`Player ${playerId} already exists.`);
        this.name = "PlayerAlreadyExistsError";
    }
}

export class BankError extends Error {
    /**
     * Creates a general bank-related error.
     * 
     * @param errorMessage The detailed error message.
     * @returns void
     */
    public constructor(errorMessage: string) {
        super(errorMessage);
        this.name = "BankError";
        Error.captureStackTrace(this, this.constructor);
    }
}

export class BankLockedError extends BankError {
    /**
     * Creates an error indicating that the bank account is locked.
     * 
     * @param errorMessage The detailed error message.
     * @returns void
     */
    public constructor(errorMessage = "Bank account is not unlocked.") {
        super(errorMessage);
        this.name = "BankLockedError";
    }
}

export class InsufficientFundsError extends BankError {
    /**
     * Creates an error indicating insufficient funds for a bank transaction.
     * 
     * @param errorMessage The detailed error message.
     * @returns void
     */
    public constructor(errorMessage = "Insufficient funds to complete this transaction.") {
        super(errorMessage);
        this.name = "InsufficientFundsError";
    }
}

export class InvalidAmountError extends BankError {
    /**
     * Creates an error indicating an invalid amount was provided for a bank transaction.
     * 
     * @param errorMessage The detailed error message.
     * @returns void
     */
    public constructor(errorMessage = "The specified amount is invalid.") {
        super(errorMessage);
        this.name = "InvalidAmountError";
    }
}

export class InvalidDeathLossRateError extends Error {
    /**
     * Creates an error indicating that a death item-loss rate is invalid.
     *
     * @param rarity The rarity whose rate is invalid.
     * @param rate The invalid rate received.
     * @returns void
     */
    public constructor(public readonly rarity: string, public readonly rate: number) {
        super(`Invalid death loss rate for rarity "${rarity}": ${rate}. Expected a number between 0 and 100.`);
        this.name = "InvalidDeathLossRateError";
    }
}


export class InvalidTitleError extends Error {
    /**
     * Creates an error indicating that a title definition is invalid.
     *
     * @param errorMessage The detailed error message.
     * @returns void
     */
    public constructor(errorMessage: string) {
        super(errorMessage);
        this.name = "InvalidTitleError";
    }
}

export class TitleAlreadyExistsError extends Error {
    /**
     * Creates an error indicating that a title is already registered.
     *
     * @param titleId The title identifier.
     * @returns void
     */
    public constructor(titleId: string) {
        super(`Title "${titleId}" is already registered.`);
        this.name = "TitleAlreadyExistsError";
    }
}

export class UnknownTitleError extends Error {
    /**
     * Creates an error indicating that a title is not registered in the world.
     *
     * @param titleId The title identifier.
     * @returns void
     */
    public constructor(titleId: string) {
        super(`Unknown title "${titleId}".`);
        this.name = "UnknownTitleError";
    }
}

export class TitleNotOwnedError extends Error {
    /**
     * Creates an error indicating that a player does not own a title.
     *
     * @param playerId The player identifier.
     * @param titleId The title identifier.
     * @returns void
     */
    public constructor(playerId: string, titleId: string) {
        super(`Player ${playerId} does not own the title "${titleId}".`);
        this.name = "TitleNotOwnedError";
    }
}


export class BankCapacityError extends BankError {
    /**
     * Creates an error indicating that the item bank has not enough free slots.
     *
     * @param capacity The total number of slots of the item bank.
     * @param requiredSlots The number of slots the operation would require.
     * @returns void
     */
    public constructor(public readonly capacity: number, public readonly requiredSlots: number) {
        super(`Item bank capacity exceeded: ${requiredSlots} slots required, ${capacity} available.`);
        this.name = "BankCapacityError";
    }
}

export class BankItemNotFoundError extends BankError {
    /**
     * Creates an error indicating that there are not enough items to transfer.
     *
     * @param itemId The item identifier.
     * @param requested The requested quantity.
     * @param available The available quantity.
     * @returns void
     */
    public constructor(public readonly itemId: string, public readonly requested: number, public readonly available: number) {
        super(`Not enough "${itemId}": ${requested} requested, ${available} available.`);
        this.name = "BankItemNotFoundError";
    }
}

export class InvalidBankCapacityError extends BankError {
    /**
     * Creates an error indicating that the configured item bank capacity is invalid.
     *
     * @param capacity The invalid capacity received.
     * @returns void
     */
    public constructor(public readonly capacity: number) {
        super(`Invalid item bank capacity: ${capacity}. Expected a positive integer.`);
        this.name = "InvalidBankCapacityError";
    }
}

export class InvalidBestiaryRewardError extends Error {
    /**
     * Creates an error indicating that a bestiary discovery reward is invalid.
     *
     * @param enemyType The species whose reward is invalid.
     * @param reward The invalid reward received.
     * @returns void
     */
    public constructor(public readonly enemyType: string, public readonly reward: number) {
        super(`Invalid bestiary discovery gold for "${enemyType}": ${reward}. Expected a non-negative number.`);
        this.name = "InvalidBestiaryRewardError";
    }
}

export class InvalidJobError extends Error {
    /**
     * Creates an error indicating that a job definition is invalid.
     *
     * @param errorMessage The detailed error message.
     * @returns void
     */
    public constructor(errorMessage: string) {
        super(errorMessage);
        this.name = "InvalidJobError";
    }
}

export class JobAlreadyExistsError extends Error {
    /**
     * Creates an error indicating that a job is already registered.
     *
     * @param jobId The job identifier.
     * @returns void
     */
    public constructor(jobId: string) {
        super(`Job "${jobId}" is already registered.`);
        this.name = "JobAlreadyExistsError";
    }
}

export class UnknownJobError extends Error {
    /**
     * Creates an error indicating that a job is not registered.
     *
     * @param jobId The job identifier.
     * @returns void
     */
    public constructor(jobId: string) {
        super(`Unknown job "${jobId}".`);
        this.name = "UnknownJobError";
    }
}

export class UnknownJobActionError extends Error {
    /**
     * Creates an error indicating that a job has no such action.
     *
     * @param jobId The job identifier.
     * @param actionId The action identifier.
     * @returns void
     */
    public constructor(jobId: string, actionId: string) {
        super(`Job "${jobId}" has no action "${actionId}".`);
        this.name = "UnknownJobActionError";
    }
}

export class JobCooldownError extends Error {
    /**
     * Creates an error indicating that a job action is still on cooldown.
     *
     * @param jobId The job identifier.
     * @param actionId The action identifier.
     * @param remainingMs The remaining cooldown in milliseconds.
     * @returns void
     */
    public constructor(public readonly jobId: string, public readonly actionId: string, public readonly remainingMs: number) {
        super(`Action "${actionId}" of job "${jobId}" is on cooldown for ${Math.ceil(remainingMs / 1000)}s.`);
        this.name = "JobCooldownError";
    }
}

export class JobLevelTooLowError extends Error {
    /**
     * Creates an error indicating that the job level is too low for an action.
     *
     * @param jobId The job identifier.
     * @param actionId The action identifier.
     * @param requiredLevel The required job level.
     * @param currentLevel The current job level.
     * @returns void
     */
    public constructor(jobId: string, actionId: string, public readonly requiredLevel: number, public readonly currentLevel: number) {
        super(`Action "${actionId}" of job "${jobId}" requires level ${requiredLevel} (current: ${currentLevel}).`);
        this.name = "JobLevelTooLowError";
    }
}

export class JobToolRequiredError extends Error {
    /**
     * Creates an error indicating that an action requires an equipped tool.
     *
     * @param jobId The job identifier.
     * @param actionId The action identifier.
     * @returns void
     */
    public constructor(jobId: string, actionId: string) {
        super(`Action "${actionId}" of job "${jobId}" requires an equipped tool.`);
        this.name = "JobToolRequiredError";
    }
}

export class InvalidJobToolError extends Error {
    /**
     * Creates an error indicating that an item cannot be used as a tool for a job.
     *
     * @param jobId The job identifier.
     * @param itemId The item identifier.
     * @returns void
     */
    public constructor(jobId: string, itemId: string) {
        super(`Item "${itemId}" is not an owned tool for job "${jobId}".`);
        this.name = "InvalidJobToolError";
    }
}

/**
 * Base class of the errors raised by the content registries.
 */
export class RegistryError extends Error {
    /**
     * Creates a registry error.
     *
     * @param message The error message.
     * @returns void
     */
    public constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

/**
 * A definition submitted to a registry is invalid.
 */
export class InvalidRegistryEntryError extends RegistryError {
    /**
     * Creates the error.
     *
     * @param kind The kind of content (e.g. `enemy`, `item`).
     * @param reason Why the definition is invalid.
     * @returns void
     */
    public constructor(public readonly kind: string, reason: string) {
        super(`Invalid ${kind} definition: ${reason}`);
    }
}

/**
 * An entry with the same identifier is already registered.
 */
export class DuplicateRegistryEntryError extends RegistryError {
    /**
     * Creates the error.
     *
     * @param kind The kind of content.
     * @param entryId The duplicated identifier.
     * @returns void
     */
    public constructor(public readonly kind: string, public readonly entryId: string) {
        super(`The ${kind} "${entryId}" is already registered. Use { override: true } to replace it.`);
    }
}

/**
 * No entry is registered under the requested identifier.
 */
export class UnknownRegistryEntryError extends RegistryError {
    /**
     * Creates the error.
     *
     * @param kind The kind of content.
     * @param entryId The unknown identifier.
     * @returns void
     */
    public constructor(public readonly kind: string, public readonly entryId: string) {
        super(`Unknown ${kind} "${entryId}".`);
    }
}

/**
 * A locked registry refuses any modification.
 */
export class RegistryLockedError extends RegistryError {
    /**
     * Creates the error.
     *
     * @param kind The kind of content.
     * @returns void
     */
    public constructor(public readonly kind: string) {
        super(`The ${kind} registry is locked; no content can be added or removed.`);
    }
}

/**
 * No enemy can be spawned because none is registered.
 */
export class NoEnemyAvailableError extends RegistryError {
    /**
     * Creates the error.
     *
     * @returns void
     */
    public constructor() {
        super("No enemy is registered; register at least one enemy before starting a combat.");
    }
}

/**
 * Base class of the content pack errors.
 */
export class ContentPackError extends RegistryError {}

/**
 * A content pack definition is invalid.
 */
export class InvalidContentPackError extends ContentPackError {
    /**
     * Creates the error.
     *
     * @param packId The pack identifier.
     * @param reason Why the pack is invalid.
     * @returns void
     */
    public constructor(public readonly packId: string, reason: string) {
        super(`Invalid content pack "${packId}": ${reason}`);
    }
}

/**
 * A content pack with the same identifier is already loaded.
 */
export class DuplicateContentPackError extends ContentPackError {
    /**
     * Creates the error.
     *
     * @param packId The pack identifier.
     * @returns void
     */
    public constructor(public readonly packId: string) {
        super(`The content pack "${packId}" is already loaded.`);
    }
}

/**
 * A content pack depends on a pack that is not loaded.
 */
export class MissingPackDependencyError extends ContentPackError {
    /**
     * Creates the error.
     *
     * @param packId The pack identifier.
     * @param dependencyId The missing dependency.
     * @returns void
     */
    public constructor(public readonly packId: string, public readonly dependencyId: string) {
        super(`The content pack "${packId}" requires "${dependencyId}", which is not loaded.`);
    }
}

/**
 * A dead player attempted an action. Raised at the entry of every player action while the player
 * is dead (respawn cooldown) or permanently dead (hardcore).
 */
export class PlayerDeadError extends Error {
    /** Milliseconds before the player can act again; `Infinity` when the death is permanent. */
    public readonly remainingMs: number;
    /** Timestamp (ms) at which the player respawns, or `null` when the death is permanent. */
    public readonly respawnAt: number | null;
    /** Whether the player will never come back (hardcore death). */
    public readonly permanent: boolean;

    /**
     * Creates the error.
     *
     * @param playerId The identifier of the dead player.
     * @param remainingMs The remaining time before the respawn, in milliseconds (`Infinity` if permanent).
     * @param action The name of the refused action (e.g. `combat.attack`).
     * @returns void
     */
    public constructor(public readonly playerId: string, remainingMs: number, public readonly action: string) {
        const permanent = !Number.isFinite(remainingMs);
        super(
            permanent
                ? `Player "${playerId}" is permanently dead and cannot perform "${action}".`
                : `Player "${playerId}" is dead and cannot perform "${action}" (respawn in ${Math.ceil(remainingMs / 1000)}s).`
        );
        this.name = "PlayerDeadError";
        this.remainingMs = remainingMs;
        this.permanent = permanent;
        this.respawnAt = permanent ? null : Date.now() + remainingMs;
    }
}

/**
 * A duration string or number could not be parsed.
 */
export class InvalidDurationError extends Error {
    /**
     * Creates the error.
     *
     * @param value The rejected value.
     * @returns void
     */
    public constructor(public readonly value: unknown) {
        super(`Invalid duration: ${String(value)}. Expected a number of milliseconds or a string like "500ms", "30s", "5m", "2h" or "1d".`);
        this.name = "InvalidDurationError";
    }
}

/**
 * The `deathRespawn` world option is invalid.
 */
export class InvalidDeathRespawnError extends Error {
    /**
     * Creates the error.
     *
     * @param reason Why the configuration is invalid.
     * @returns void
     */
    public constructor(reason: string) {
        super(`Invalid deathRespawn option: ${reason}`);
        this.name = "InvalidDeathRespawnError";
    }
}

/**
 * Base class of the errors raised by the shops.
 */
export class ShopError extends Error {
    /**
     * Creates a shop error.
     *
     * @param message The error message.
     * @returns void
     */
    public constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

/**
 * The shop does not sell (or does not buy) the requested item.
 */
export class ShopItemUnavailableError extends ShopError {
    /**
     * Creates the error.
     *
     * @param shopId The shop identifier.
     * @param itemId The item identifier.
     * @param operation `buy` when the player wants to buy the item, `sell` when the player wants to sell it.
     * @returns void
     */
    public constructor(public readonly shopId: string, public readonly itemId: string, public readonly operation: "buy" | "sell") {
        super(
            operation === "buy"
                ? `Shop "${shopId}" does not sell "${itemId}".`
                : `Shop "${shopId}" does not buy "${itemId}".`
        );
    }
}

/**
 * The player level is too low to buy an item.
 */
export class ShopLevelTooLowError extends ShopError {
    /**
     * Creates the error.
     *
     * @param shopId The shop identifier.
     * @param itemId The item identifier.
     * @param requiredLevel The level required by the listing.
     * @param currentLevel The level of the player.
     * @returns void
     */
    public constructor(public readonly shopId: string, public readonly itemId: string, public readonly requiredLevel: number, public readonly currentLevel: number) {
        super(`"${itemId}" requires level ${requiredLevel} in shop "${shopId}" (current: ${currentLevel}).`);
    }
}

/**
 * The player does not carry enough gold for a purchase.
 */
export class ShopInsufficientGoldError extends ShopError {
    /**
     * Creates the error.
     *
     * @param required The gold required.
     * @param available The gold carried by the player.
     * @returns void
     */
    public constructor(public readonly required: number, public readonly available: number) {
        super(`Not enough gold: ${required} required, ${available} available.`);
    }
}

/**
 * The player does not own enough items to sell.
 */
export class ShopInsufficientItemsError extends ShopError {
    /**
     * Creates the error.
     *
     * @param itemId The item identifier.
     * @param requested The requested quantity.
     * @param available The quantity the player owns (unequipped).
     * @returns void
     */
    public constructor(public readonly itemId: string, public readonly requested: number, public readonly available: number) {
        super(`Not enough "${itemId}" to sell: ${requested} requested, ${available} available.`);
    }
}

/**
 * A shop quantity is not a positive integer.
 */
export class InvalidShopQuantityError extends ShopError {
    /**
     * Creates the error.
     *
     * @param quantity The rejected quantity.
     * @returns void
     */
    public constructor(public readonly quantity: number) {
        super(`Invalid quantity: ${String(quantity)}. Expected a positive integer.`);
    }
}
