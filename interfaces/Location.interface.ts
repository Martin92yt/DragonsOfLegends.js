import { LocationFlags } from "../enums/Location.Flags";
import { LocationType } from "../enums/Location.Type";

interface LocationConnection {
    land: string[];
    boat: string[];
}

export interface LocationCreateParametres {
    id: string;
    type: LocationType;
    flags?: LocationFlags[];
    connections?: LocationConnection;
}

export interface LocationCreateResult {
    id: string;
    type: LocationType;
    flags: LocationFlags[];
    connections: LocationConnection;
}

export interface ExplorationResult {
    arrived: boolean;
    attacked: boolean;
    travelTimeMs: number;
    locationId: string;
    enemy?: unknown;
}