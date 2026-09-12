import { LocationFlags } from "./location.flags.js";
import { LocationType } from "./location.type.js";

export interface LocationConnection { 
    land: string[]; 
    boat: string[]; 
}

export interface LocationCreateParametres {
    id: string;
    type: LocationType;
    flags?: LocationFlags | LocationFlags[];
    connections?: Partial<LocationConnection>;
}

export interface LocationCreateResult {
    id: string;
    type: LocationType;
    flags: LocationFlags;
    connections: LocationConnection;
}