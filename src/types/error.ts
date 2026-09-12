// src/errors/error.ts

// --- Types partagés pour la précision ---
export type TransportMode = "land" | "boat";
export type AttributeType = "strength" | "agility" | "intelligence" | "vitality"; // Adapte selon tes attributs réels

export class PlayerNoCharacterError extends Error {
    constructor() {
        super("One of the players does not have a registered character.");
        this.name = "PlayerNoCharacterError";
    }
}

export class SelfCombatError extends Error {
    constructor() {
        super("You cannot fight yourself!");
        this.name = "SelfCombatError";
    }
}

export class PlayerAlreadyInCombatError extends Error {
    constructor(playerId: string) {
        super(`Player ${playerId} is already in combat.`);
        this.name = "PlayerAlreadyInCombatError";
    }
}

export class PlayerNotInCombatError extends Error {
    constructor(playerId: string) {
        super(`Player ${playerId} is not in combat.`);
        this.name = "PlayerNotInCombatError";
    }
}

export class LocationIdEmptyError extends Error {
    constructor() {
        super("Location ID cannot be empty.");
        this.name = "LocationIdEmptyError";
    }
}

export class LocationAlreadyExistsError extends Error {
    constructor(locationId: string) {
        super(`Location "${locationId}" already exists`);
        this.name = "LocationAlreadyExistsError";
    }
}

export class LocationInexistentLinkError extends Error {
    constructor(fromId: string, toId: string) {
        super(`Cannot link inexistent locations: "${fromId}" <-> "${toId}"`);
        this.name = "LocationInexistentLinkError";
    }
}

export class NoStartingCityError extends Error {
    constructor() {
        super("No StartingCity defined");
        this.name = "NoStartingCityError";
    }
}

export class MultipleStartingCitiesError extends Error {
    constructor(startersIds: string[]) {
        super(`Multiple StartingCity found: ${startersIds.join(", ")}`);
        this.name = "MultipleStartingCitiesError";
    }
}

export class SelfConnectionError extends Error {
    constructor(locationId: string, mode: TransportMode) {
        super(`Location "${locationId}" cannot connect to itself by ${mode}`);
        this.name = "SelfConnectionError";
    }
}

export class InvalidConnectionTargetError extends Error {
    constructor(locationId: string, mode: TransportMode, destId: string) {
        super(`Location "${locationId}" has invalid ${mode} connection to "${destId}"`);
        this.name = "InvalidConnectionTargetError";
    }
}

export class NonReciprocalConnectionError extends Error {
    constructor(mode: TransportMode, fromId: string, toId: string) {
        super(`${mode} connection "${fromId}" -> "${toId}" is not reciprocal`);
        this.name = "NonReciprocalConnectionError";
    }
}

export class BoatWaterFlagRequiredError extends Error {
    constructor(fromId: string, toId: string) {
        super(`Boat connection "${fromId}" -> "${toId}" requires OnWater flag on both`);
        this.name = "BoatWaterFlagRequiredError";
    }
}

export class UnreachableLocationsError extends Error {
    constructor(unreachedIds: string[]) {
        super(`Unreachable locations: ${unreachedIds.join(", ")}`);
        this.name = "UnreachableLocationsError";
    }
}

export class PlayerAlreadyTravellingError extends Error {
    constructor() {
        super("Player is already travelling.");
        this.name = "PlayerAlreadyTravellingError";
    }
}

export class MoveInCombatError extends Error {
    constructor() {
        super("Cannot move while in combat!");
        this.name = "MoveInCombatError";
    }
}

export class NoAttributePointsError extends Error {
    constructor() {
        super("No attribute points available.");
        this.name = "NoAttributePointsError";
    }
}

export class UnknownPlayerClassError extends Error {
    constructor(classId: string) {
        super(`Unknown player class: ${classId}`);
        this.name = "UnknownPlayerClassError";
    }
}

export class PlayerAlreadyExistsError extends Error {
    constructor(id: string) {
        super(`Player ${id} already exists.`);
        this.name = "PlayerAlreadyExistsError";
    }
}