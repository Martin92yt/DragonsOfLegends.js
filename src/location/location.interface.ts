import { LocationFlags } from "./location.flags.js";
import { LocationType } from "./location.type.js";

export interface LocationConnectionRecord {
    targetId: string;
    distance: number;
    danger: number;
}

export interface LocationConnection { 
    land: LocationConnectionRecord[]; 
    boat: LocationConnectionRecord[]; 
}

export interface LocationCreateParametres {
    id: string;
    type: LocationType;
    flags: LocationFlags | LocationFlags[];
    connections: LocationConnection;
}

export interface LocationCreateResult {
    id: string;
    type: LocationType;
    flags: LocationFlags;
    connections: LocationConnection;
}