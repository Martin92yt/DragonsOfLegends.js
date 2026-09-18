import { LocationFlags } from "./location.flags.js";
import { LocationType } from "./location.type.js";

/**
 * Represents an individual route or connection record between locations.
 */
export interface LocationConnectionRecord {
    readonly destinationLocationId: string;
    readonly travelDistance: number;
    readonly dangerLevel: number;
}

/**
 * Represents the categorized collection of travel connections for a location.
 */
export interface LocationTravelConnections {
    readonly landRoutes: LocationConnectionRecord[];
    readonly boatRoutes: LocationConnectionRecord[];
}

/**
 * Parameters required to instantiate or configure a new location.
 */
export interface LocationCreateParameters {
    readonly locationId: string;
    readonly locationType: LocationType;
    readonly locationFlags: LocationFlags | readonly LocationFlags[];
    readonly travelConnections: LocationTravelConnections;
}

/**
 * @deprecated Use LocationCreateParameters instead. Retained for backward compatibility.
 */
export type LocationCreateParametres = LocationCreateParameters;

/**
 * Represents the finalized state and structure of a successfully created location.
 */
export interface LocationCreateResult {
    readonly locationId: string;
    readonly locationType: LocationType;
    readonly locationFlags: LocationFlags;
    readonly travelConnections: LocationTravelConnections;
}