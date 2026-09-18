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