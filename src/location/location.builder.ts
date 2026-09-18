import { LocationFlags } from "./location.flags.js";
import { LocationType } from "./location.type.js";
import { LocationConnectionRecord, LocationCreateParametres } from "./location.interface.js";
import { LocationIdEmptyError } from "../types/error.js";

export type TransportMode = "land" | "boat";

export interface ConnectionInput {
    readonly transportMode: TransportMode;
    readonly targetLocationId: string;
    readonly connectionDistance?: number;
    readonly connectionDanger?: number;
}

export class LocationBuilder {
    private readonly locationId: string;
    private locationType: LocationType = LocationType.City;
    private locationFlags: LocationFlags | LocationFlags[] = LocationFlags.None;
    private landConnectionRecords: LocationConnectionRecord[] = [];
    private boatConnectionRecords: LocationConnectionRecord[] = [];

    /**
     * Creates a location builder.
     *
     * @param locationId The location identifier.
     * @returns void
     */
    public constructor(locationId: string) {
        this.locationId = locationId;
    }

    /**
     * Sets the location type.
     *
     * @param locationType The location type.
     * @returns The current builder instance.
     */
    public setType(locationType: LocationType): this {
        this.locationType = locationType;
        return this;
    }

    /**
     * Sets the location flags.
     *
     * @param locationFlags The location flags.
     * @returns The current builder instance.
     */
    public setFlags(locationFlags: LocationFlags | LocationFlags[]): this {
        this.locationFlags = locationFlags;
        return this;
    }

    /**
     * Adds a location flag.
     *
     * @param flagToAdd The flag to add.
     * @returns The current builder instance.
     */
    public addFlag(flagToAdd: LocationFlags): this {
        if (Array.isArray(this.locationFlags)) {
            if (!this.locationFlags.includes(flagToAdd)) {
                this.locationFlags.push(flagToAdd);
            }
        } else if (this.locationFlags !== flagToAdd) {
            this.locationFlags = [this.locationFlags, flagToAdd];
        }

        return this;
    }

    /**
     * Replaces all existing connections.
     *
     * @param connectionInputs The connections to set.
     * @returns The current builder instance.
     */
    public setConnections(...connectionInputs: ConnectionInput[]): this {
        this.landConnectionRecords = [];
        this.boatConnectionRecords = [];
        return this.addConnections(...connectionInputs);
    }

    /**
     * Adds one or more connections.
     *
     * @param connectionInputs The connections to add.
     * @returns The current builder instance.
     */
    public addConnections(...connectionInputs: ConnectionInput[]): this {
        for (const connectionInput of connectionInputs) {
            const targetConnectionArray = this.getTargetConnections(connectionInput.transportMode);
            this.appendConnectionIfNotExists(targetConnectionArray, connectionInput);
        }

        return this;
    }

    /**
     * Retrieves the specific connection array corresponding to the transport mode.
     */
    private getTargetConnections(transportMode: TransportMode): LocationConnectionRecord[] {
        return transportMode === "land" ? this.landConnectionRecords : this.boatConnectionRecords;
    }

    /**
     * Appends a connection record if a record for the target does not already exist.
     */
    private appendConnectionIfNotExists(
        targetConnectionArray: LocationConnectionRecord[],
        connectionInput: ConnectionInput
    ): void {
        const { targetLocationId, connectionDistance = 1, connectionDanger = 0 } = connectionInput;
        
        if (!targetConnectionArray.some(existingRecord => existingRecord.destinationLocationId === targetLocationId)) {
            targetConnectionArray.push({
                destinationLocationId: targetLocationId,
                travelDistance: connectionDistance,
                dangerLevel: connectionDanger
            });
        }
    }

    /**
     * Adds a land connection.
     *
     * @param targetLocationId The target location identifier.
     * @param connectionDistance The connection distance.
     * @param connectionDanger The connection danger level.
     * @returns The current builder instance.
     */
    public linkLand(targetLocationId: string, connectionDistance = 1, connectionDanger = 0): this {
        return this.addConnections({
            transportMode: "land",
            targetLocationId,
            connectionDistance,
            connectionDanger
        });
    }

    /**
     * Adds a boat connection.
     *
     * @param targetLocationId The target location identifier.
     * @param connectionDistance The connection distance.
     * @param connectionDanger The connection danger level.
     * @returns The current builder instance.
     */
    public linkBoat(targetLocationId: string, connectionDistance = 1, connectionDanger = 0): this {
        return this.addConnections({
            transportMode: "boat",
            targetLocationId,
            connectionDistance,
            connectionDanger
        });
    }

    /**
     * Builds the location creation parameters.
     *
     * @returns The location creation parameters.
     * @throws LocationIdEmptyError if the location identifier is empty.
     */
    public build(): LocationCreateParametres {
        if (!this.locationId.trim()) {
            throw new LocationIdEmptyError();
        }

        return {
            locationId: this.locationId,
            locationType: this.locationType,
            locationFlags: this.locationFlags,
            travelConnections: {
                landRoutes: [...this.landConnectionRecords],
                boatRoutes: [...this.boatConnectionRecords]
            }
        };
    }
}