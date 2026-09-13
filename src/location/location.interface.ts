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
    readonly id: string;
    readonly type: LocationType;
    readonly flags: LocationFlags | LocationFlags[];
    readonly connections: LocationConnection;
}

export interface LocationCreateResult {
    readonly id: string;
    readonly type: LocationType;
    flags: LocationFlags;
    connections: LocationConnection;
}
