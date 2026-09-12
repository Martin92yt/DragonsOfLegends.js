import { LocationFlags } from "./location.flags.js";
import { LocationType } from "./location.type.js"; // Adapte le chemin selon ton projet
import { LocationCreateParametres } from "./location.interface.js";
import { LocationIdEmptyError } from "../types/error.js";

export interface ConnectionInput {
    transport: "land" | "boat";
    targetId: string;
}

export class LocationBuilder {
    private id: string = "";
    private type: LocationType = LocationType.City; // Valeur par défaut
    private flags: LocationFlags | LocationFlags[] = LocationFlags.None;
    private landConnections: string[] = [];
    private boatConnections: string[] = [];

    constructor(id: string) {
        this.id = id;
    }

    public setType(type: LocationType): this {
        this.type = type;
        return this;
    }

    public setFlags(flags: LocationFlags | LocationFlags[]): this {
        this.flags = flags;
        return this;
    }

    // Permet d'ajouter des flags un par un ou par lots
    public addFlag(flag: LocationFlags): this {
        if (Array.isArray(this.flags)) {
            if (!this.flags.includes(flag)) this.flags.push(flag);
        } else {
            this.flags = [this.flags, flag];
        }
        return this;
    }

    // Accepte une ou plusieurs connexions d'un coup
    public setConnections(...connections: ConnectionInput[]): this {
        this.landConnections = [];
        this.boatConnections = [];
        return this.addConnections(...connections);
    }

    public addConnections(...connections: ConnectionInput[]): this {
        for (const conn of connections) {
            if (conn.transport === "land") {
                if (!this.landConnections.includes(conn.targetId)) {
                    this.landConnections.push(conn.targetId);
                }
            } else if (conn.transport === "boat") {
                if (!this.boatConnections.includes(conn.targetId)) {
                    this.boatConnections.push(conn.targetId);
                }
            }
        }
        return this;
    }

    // Raccourcis pratiques
    public linkLand(targetId: string): this {
        return this.addConnections({ transport: "land", targetId });
    }

    public linkBoat(targetId: string): this {
        return this.addConnections({ transport: "boat", targetId });
    }

    // Transforme l'objet en paramètres bruts acceptés par le manager
    public build(): LocationCreateParametres {
        if (!this.id) throw new LocationIdEmptyError();
        return {
            id: this.id,
            type: this.type,
            flags: this.flags,
            connections: {
                land: this.landConnections,
                boat: this.boatConnections
            }
        };
    }
}