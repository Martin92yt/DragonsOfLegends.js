import { LocationFlags, hasFlag } from "./location.flags.js";
import { LocationCreateParametres, LocationCreateResult } from "./location.interface.js";
import { consola } from "consola";
import { LocationBuilder } from "./location.builder.js";
import {
    BoatWaterFlagRequiredError,
    InvalidConnectionTargetError,
    LocationAlreadyExistsError,
    LocationInexistentLinkError,
    MultipleStartingCitiesError,
    NonReciprocalConnectionError,
    NoStartingCityError,
    SelfConnectionError,
    UnreachableLocationsError
} from "../types/error.js";

type TransportMode = "landRoutes" | "boatRoutes";
type LocationConnection = LocationCreateResult["travelConnections"][TransportMode];

export default class LocationManager {
    private readonly locationsMap = new Map<string, LocationCreateResult>();
    private static readonly TRANSPORT_MODES: readonly TransportMode[] = ["landRoutes", "boatRoutes"];

    /**
     * Creates multiple locations from parameters or builders.
     *
     * @param locationItems The location parameters or location builders.
     * @returns An array of created location results.
     */
    public bulkCreate(locationItems: readonly (LocationCreateParametres | LocationBuilder)[]): LocationCreateResult[] {
        return locationItems.map(item => this.create(item instanceof LocationBuilder ? item.build() : item));
    }

    /**
     * Creates a location builder.
     *
     * @param locationId The location identifier.
     * @returns A new location builder instance.
     */
    public add(locationId: string): LocationBuilder {
        return new LocationBuilder(locationId);
    }

    /**
     * Creates and registers a location.
     *
     * @param creationParameters The location creation parameters.
     * @returns The created location result.
     */
    public create(creationParameters: LocationCreateParametres): LocationCreateResult {
        if (this.locationsMap.has(creationParameters.locationId)) {
            consola.error(`Attempt to create already existing location: ${creationParameters.locationId}`);
            throw new LocationAlreadyExistsError(creationParameters.locationId);
        }

        const rawFlags = creationParameters.locationFlags ?? LocationFlags.None;
        const resolvedFlags = Array.isArray(rawFlags)
            ? rawFlags.reduce((accumulatedFlags, singleFlag) => accumulatedFlags | singleFlag, 0)
            : rawFlags;

        const createdLocationResult: LocationCreateResult = {
            locationId: creationParameters.locationId,
            locationType: creationParameters.locationType,
            locationFlags: resolvedFlags,
            travelConnections: {
                landRoutes: creationParameters.travelConnections?.landRoutes ?? [],
                boatRoutes: creationParameters.travelConnections?.boatRoutes ?? []
            }
        };

        this.locationsMap.set(createdLocationResult.locationId, createdLocationResult);
        return createdLocationResult;
    }

    /**
     * Creates a bidirectional connection between two locations.
     *
     * @param sourceLocationId The source location identifier.
     * @param targetLocationId The target location identifier.
     * @param transportMode The transport mode for the connection.
     * @param connectionDistance The connection distance.
     * @param connectionDanger The connection danger level.
     * @returns void
     */
    public link(
        sourceLocationId: string,
        targetLocationId: string,
        transportMode: TransportMode,
        connectionDistance = 1,
        connectionDanger = 0
    ): void {
        const sourceLocation = this.locationsMap.get(sourceLocationId);
        const targetLocation = this.locationsMap.get(targetLocationId);

        if (!sourceLocation || !targetLocation) {
            consola.error(`Failed to link non-existent locations: ${sourceLocationId} -> ${targetLocationId}`);
            throw new LocationInexistentLinkError(sourceLocationId, targetLocationId);
        }

        this.ensureConnection(sourceLocation.travelConnections[transportMode], targetLocationId, connectionDistance, connectionDanger);
        this.ensureConnection(targetLocation.travelConnections[transportMode], sourceLocationId, connectionDistance, connectionDanger);
    }

    /**
     * Ensures a connection exists within a connection array, appending it if absent.
     */
    private ensureConnection(
        connectionList: LocationConnection,
        targetLocationId: string,
        connectionDistance: number,
        connectionDanger: number
    ): void {
        if (!connectionList.some(existingConnection => existingConnection.destinationLocationId === targetLocationId)) {
            connectionList.push({ destinationLocationId: targetLocationId, travelDistance: connectionDistance, dangerLevel: connectionDanger });
        }
    }

    /**
     * Gets a location by identifier.
     *
     * @param locationId The location identifier.
     * @returns The location result if found, otherwise undefined.
     */
    public get(locationId: string): LocationCreateResult | undefined {
        return this.locationsMap.get(locationId);
    }

    /**
     * Checks whether a location exists.
     *
     * @param locationId The location identifier.
     * @returns True if the location exists, false otherwise.
     */
    public has(locationId: string): boolean {
        return this.locationsMap.has(locationId);
    }

    /**
     * Serializes all locations.
     *
     * @returns A JSON string containing serialized location data.
     */
    public serialize(): string {
        return JSON.stringify([...this.locationsMap.values()], null, 2);
    }

    /**
     * Replaces the current locations with serialized or structured data.
     *
     * @param serializedData The serialized location data string or location objects array.
     * @returns void
     */
    public deserialize(serializedData: string | readonly LocationCreateResult[]): void {
        const parsedLocations = typeof serializedData === "string"
            ? (JSON.parse(serializedData) as LocationCreateResult[])
            : [...serializedData];

        this.locationsMap.clear();

        for (const locationRecord of parsedLocations) {
            this.create(locationRecord);
        }

        this.validate();
        consola.success(`Deserialized ${parsedLocations.length} locations.`);
    }

    /**
     * Validates the complete location graph.
     *
     * @returns void
     */
    public validate(): void {
        const startingCityLocation = this.validateStartingCity();

        this.validateConnections();
        this.validateReachability(startingCityLocation.locationId);
        consola.success(`Validated ${this.locationsMap.size} locations.`);
    }

    /**
     * Finds and validates the unique starting city.
     *
     * @returns The starting city location result.
     */
    private validateStartingCity(): LocationCreateResult {
        const starterCityList = [...this.locationsMap.values()].filter(locationRecord =>
            hasFlag(locationRecord.locationFlags, LocationFlags.StarterCity)
        );

        if (starterCityList.length === 0) {
            consola.error("No starting city defined in the location graph.");
            throw new NoStartingCityError();
        }

        if (starterCityList.length > 1) {
            const cityIds = starterCityList.map(locationRecord => locationRecord.locationId);
            consola.error(`Multiple starting cities found: ${cityIds.join(", ")}`);
            throw new MultipleStartingCitiesError(cityIds);
        }

        return starterCityList[0];
    }

    /**
     * Validates all location connections.
     *
     * @returns void
     */
    private validateConnections(): void {
        for (const locationRecord of this.locationsMap.values()) {
            for (const transportMode of LocationManager.TRANSPORT_MODES) {
                for (const connectionRecord of locationRecord.travelConnections[transportMode]) {
                    this.validateSingleConnection(locationRecord, connectionRecord, transportMode);
                }
            }
        }
    }

    /**
     * Validates an individual connection entry.
     */
    private validateSingleConnection(
        sourceLocation: LocationCreateResult,
        connectionRecord: LocationConnection[number],
        transportMode: TransportMode
    ): void {
        const targetLocationId = connectionRecord.destinationLocationId;

        if (targetLocationId === sourceLocation.locationId) {
            consola.error(`Location ${sourceLocation.locationId} has a self-connection on ${transportMode}.`);
            throw new SelfConnectionError(sourceLocation.locationId, transportMode);
        }

        const targetLocation = this.locationsMap.get(targetLocationId);

        if (!targetLocation) {
            consola.error(`Location ${sourceLocation.locationId} connects to non-existent target ${targetLocationId} on ${transportMode}.`);
            throw new InvalidConnectionTargetError(sourceLocation.locationId, transportMode, targetLocationId);
        }

        const isReciprocal = targetLocation.travelConnections[transportMode].some(
            reverseConnection => reverseConnection.destinationLocationId === sourceLocation.locationId
        );

        if (!isReciprocal) {
            consola.error(`Non-reciprocal connection between ${sourceLocation.locationId} and ${targetLocation.locationId} on ${transportMode}.`);
            throw new NonReciprocalConnectionError(transportMode, sourceLocation.locationId, targetLocation.locationId);
        }

        if (
            transportMode === "boatRoutes" &&
            (!hasFlag(sourceLocation.locationFlags, LocationFlags.OnWater) || !hasFlag(targetLocation.locationFlags, LocationFlags.OnWater))
        ) {
            consola.error(`Boat connection requires water flags between ${sourceLocation.locationId} and ${targetLocationId}.`);
            throw new BoatWaterFlagRequiredError(sourceLocation.locationId, targetLocationId);
        }
    }

    /**
     * Validates that every non-teleport-only location is reachable.
     *
     * @param startingLocationId The starting location identifier.
     * @returns void
     */
    private validateReachability(startingLocationId: string): void {
        const visitedLocationIds = new Set<string>([startingLocationId]);
        const traversalQueue: string[] = [startingLocationId];

        while (traversalQueue.length > 0) {
            const currentId = traversalQueue.shift();

            if (!currentId) {
                continue;
            }

            const currentLocation = this.locationsMap.get(currentId);

            if (!currentLocation) {
                continue;
            }

            const allConnections = [...currentLocation.travelConnections.landRoutes, ...currentLocation.travelConnections.boatRoutes];

            for (const connectionEntry of allConnections) {
                if (!visitedLocationIds.has(connectionEntry.destinationLocationId)) {
                    visitedLocationIds.add(connectionEntry.destinationLocationId);
                    traversalQueue.push(connectionEntry.destinationLocationId);
                }
            }
        }

        const unreachableLocations = [...this.locationsMap.values()].filter(
            locationRecord =>
                !visitedLocationIds.has(locationRecord.locationId) && !hasFlag(locationRecord.locationFlags, LocationFlags.TeleportOnly)
        );

        if (unreachableLocations.length > 0) {
            const unreachableIds = unreachableLocations.map(locationRecord => locationRecord.locationId);
            consola.error(`Unreachable locations detected: ${unreachableIds.join(", ")}`);
            throw new UnreachableLocationsError(unreachableIds);
        }
    }

    /**
     * Gets the unique starting city.
     *
     * @returns The starting city location result.
     */
    public getStartingCity(): LocationCreateResult {
        return this.validateStartingCity();
    }

    /**
     * Gets the starting city identifier.
     *
     * @returns The starting city identifier string.
     */
    public getStartingCityId(): string {
        return this.validateStartingCity().locationId;
    }
}