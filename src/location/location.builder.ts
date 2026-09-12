import { LocationFlags } from "./location.flags.js";
import { LocationType } from "./location.type.js"; // Adapte le chemin selon ton projet
import { LocationCreateParametres } from "./location.interface.js";
import { LocationIdEmptyError } from "../types/error.js";

export interface ConnectionInput {
    transport: "land" | "boat";
    targetId: string;
    distance?: number;
    danger?: number;
}

export class LocationBuilder {
    private id: string = "";
    private type: LocationType = LocationType.City; // Valeur par défaut
    private flags: LocationFlags | LocationFlags[] = LocationFlags.None;
    private landConnections: Array<{ targetId: string; distance: number; danger: number }> = [];
    private boatConnections: Array<{ targetId: string; distance: number; danger: number }> = [];

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
            const distance = conn.distance ?? 1;
            const danger = conn.danger ?? 0;

            if (conn.transport === "land") {
                if (!this.landConnections.some(c => c.targetId === conn.targetId)) {
                    this.landConnections.push({ targetId: conn.targetId, distance, danger });
                }
            } else if (conn.transport === "boat") {
                if (!this.boatConnections.some(c => c.targetId === conn.targetId)) {
                    this.boatConnections.push({ targetId: conn.targetId, distance, danger });
                }
            }
        }
        return this;
    }

    // Raccourcis pratiques
    public linkLand(targetId: string, distance?: number, danger?: number): this {
        return this.addConnections({ transport: "land", targetId, distance, danger });
    }

    public linkBoat(targetId: string, distance?: number, danger?: number): this {
        return this.addConnections({ transport: "boat", targetId, distance, danger });
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