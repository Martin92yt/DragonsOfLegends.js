import { LocationFlags } from "./location.flags.js";
import { LocationType } from "./location.type.js";
import { LocationConnectionRecord, LocationCreateParametres } from "./location.interface.js";
import { LocationIdEmptyError } from "../types/error.js";

export type TransportMode = "land" | "boat";

export interface ConnectionInput {
    readonly transport: TransportMode;
    readonly targetId: string;
    readonly distance?: number;
    readonly danger?: number;
}

export class LocationBuilder {
    private readonly id: string;
    private type: LocationType = LocationType.City;
    private flags: LocationFlags | LocationFlags[] = LocationFlags.None;
    private landConnections: LocationConnectionRecord[] = [];
    private boatConnections: LocationConnectionRecord[] = [];

    /**
     * Creates a location builder.
     *
     * @param id Location identifier.
     */
    public constructor(id: string) {
        this.id = id;
    }

    /**
     * Sets the location type.
     *
     * @param type Location type.
     * @returns The current builder.
     */
    public setType(type: LocationType): this {
        this.type = type;
        return this;
    }

    /**
     * Sets the location flags.
     *
     * @param flags Location flags.
     * @returns The current builder.
     */
    public setFlags(flags: LocationFlags | LocationFlags[]): this {
        this.flags = flags;
        return this;
    }

    /**
     * Adds a location flag.
     *
     * @param flag Flag to add.
     * @returns The current builder.
     */
    public addFlag(flag: LocationFlags): this {
        if (Array.isArray(this.flags)) {
            if (!this.flags.includes(flag)) {
                this.flags.push(flag);
            }
        } else {
            this.flags = [this.flags, flag];
        }

        return this;
    }

    /**
     * Replaces all existing connections.
     *
     * @param connections Connections to set.
     * @returns The current builder.
     */
    public setConnections(...connections: ConnectionInput[]): this {
        this.landConnections = [];
        this.boatConnections = [];
        return this.addConnections(...connections);
    }

    /**
     * Adds one or more connections.
     *
     * @param connections Connections to add.
     * @returns The current builder.
     */
    public addConnections(...connections: ConnectionInput[]): this {
        for (const connection of connections) {
            const record: LocationConnectionRecord = {
                targetId: connection.targetId,
                distance: connection.distance ?? 1,
                danger: connection.danger ?? 0
            };

            const targetConnections = connection.transport === "land" ? this.landConnections : this.boatConnections;

            if (!targetConnections.some(({ targetId }) => targetId === connection.targetId)) {
                targetConnections.push(record);
            }
        }

        return this;
    }

    /**
     * Adds a land connection.
     *
     * @param targetId Target location identifier.
     * @param distance Connection distance.
     * @param danger Connection danger level.
     * @returns The current builder.
     */
    public linkLand(targetId: string, distance = 1, danger = 0): this {
        return this.addConnections({ transport: "land", targetId, distance, danger });
    }

    /**
     * Adds a boat connection.
     *
     * @param targetId Target location identifier.
     * @param distance Connection distance.
     * @param danger Connection danger level.
     * @returns The current builder.
     */
    public linkBoat(targetId: string, distance = 1, danger = 0): this {
        return this.addConnections({ transport: "boat", targetId, distance, danger });
    }

    /**
     * Builds the location creation parameters.
     *
     * @returns Location creation parameters.
     * @throws LocationIdEmptyError if the location identifier is empty.
     */
    public build(): LocationCreateParametres {
        if (!this.id.trim()) {
            throw new LocationIdEmptyError();
        }

        return {
            id: this.id,
            type: this.type,
            flags: this.flags,
            connections: {
                land: [...this.landConnections],
                boat: [...this.boatConnections]
            }
        };
    }
}
