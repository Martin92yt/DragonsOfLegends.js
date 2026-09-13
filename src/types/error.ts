export type TransportMode = "land" | "boat";

export type AttributeType = "strength" | "agility" | "intelligence" | "vitality";

export class PlayerNoCharacterError extends Error {
    /**
     * Creates an error indicating that a player has no registered character.
     */
    public constructor() {
        super("One of the players does not have a registered character.");
        this.name = "PlayerNoCharacterError";
    }
}

export class SelfCombatError extends Error {
    /**
     * Creates an error indicating that a player cannot fight themselves.
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
     * @param playerId Player identifier.
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
     * @param playerId Player identifier.
     */
    public constructor(playerId: string) {
        super(`Player ${playerId} is not in combat.`);
        this.name = "PlayerNotInCombatError";
    }
}

export class LocationIdEmptyError extends Error {
    /**
     * Creates an error indicating that a location identifier is empty.
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
     * @param locationId Location identifier.
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
     * @param fromId Source location identifier.
     * @param toId Target location identifier.
     */
    public constructor(fromId: string, toId: string) {
        super(`Cannot link nonexistent locations: "${fromId}" <-> "${toId}".`);
        this.name = "LocationInexistentLinkError";
    }
}

export class NoStartingCityError extends Error {
    /**
     * Creates an error indicating that no starting city is defined.
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
     * @param starterIds Starting city identifiers.
     */
    public constructor(starterIds: string[]) {
        super(`Multiple starting cities found: ${starterIds.join(", ")}.`);
        this.name = "MultipleStartingCitiesError";
    }
}

export class SelfConnectionError extends Error {
    /**
     * Creates an error indicating that a location cannot connect to itself.
     *
     * @param locationId Location identifier.
     * @param mode Transport mode.
     */
    public constructor(locationId: string, mode: TransportMode) {
        super(`Location "${locationId}" cannot connect to itself by ${mode}.`);
        this.name = "SelfConnectionError";
    }
}

export class InvalidConnectionTargetError extends Error {
    /**
     * Creates an error indicating that a connection target is invalid.
     *
     * @param locationId Source location identifier.
     * @param mode Transport mode.
     * @param destId Target location identifier.
     */
    public constructor(locationId: string, mode: TransportMode, destId: string) {
        super(`Location "${locationId}" has an invalid ${mode} connection to "${destId}".`);
        this.name = "InvalidConnectionTargetError";
    }
}

export class NonReciprocalConnectionError extends Error {
    /**
     * Creates an error indicating that a connection is not reciprocal.
     *
     * @param mode Transport mode.
     * @param fromId Source location identifier.
     * @param toId Target location identifier.
     */
    public constructor(mode: TransportMode, fromId: string, toId: string) {
        super(`${mode} connection "${fromId}" -> "${toId}" is not reciprocal.`);
        this.name = "NonReciprocalConnectionError";
    }
}

export class BoatWaterFlagRequiredError extends Error {
    /**
     * Creates an error indicating that a boat connection requires water locations.
     *
     * @param fromId Source location identifier.
     * @param toId Target location identifier.
     */
    public constructor(fromId: string, toId: string) {
        super(`Boat connection "${fromId}" -> "${toId}" requires the OnWater flag on both locations.`);
        this.name = "BoatWaterFlagRequiredError";
    }
}

export class UnreachableLocationsError extends Error {
    /**
     * Creates an error indicating that some locations cannot be reached.
     *
     * @param unreachedIds Unreachable location identifiers.
     */
    public constructor(unreachedIds: string[]) {
        super(`Unreachable locations: ${unreachedIds.join(", ")}.`);
        this.name = "UnreachableLocationsError";
    }
}

export class PlayerAlreadyTravellingError extends Error {
    /**
     * Creates an error indicating that a player is already travelling.
     */
    public constructor() {
        super("Player is already travelling.");
        this.name = "PlayerAlreadyTravellingError";
    }
}

export class MoveInCombatError extends Error {
    /**
     * Creates an error indicating that movement is not allowed during combat.
     */
    public constructor() {
        super("Cannot move while in combat!");
        this.name = "MoveInCombatError";
    }
}

export class NoAttributePointsError extends Error {
    /**
     * Creates an error indicating that no attribute points are available.
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
     * @param classId Player class identifier.
     */
    public constructor(classId: string) {
        super(`Unknown player class: ${classId}.`);
        this.name = "UnknownPlayerClassError";
    }
}

export class PlayerAlreadyExistsError extends Error {
    /**
     * Creates an error indicating that a player already exists.
     *
     * @param id Player identifier.
     */
    public constructor(id: string) {
        super(`Player ${id} already exists.`);
        this.name = "PlayerAlreadyExistsError";
    }
}
