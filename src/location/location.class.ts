import { LocationFlags, hasFlag } from "./location.flags.js";
import { LocationCreateParametres, LocationCreateResult } from "./location.interface.js";
import { Logger } from "../utils/logger.js";
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

type TransportMode = "land" | "boat";
type LocationConnection = LocationCreateResult["connections"][TransportMode];

export default class LocationManager {
    readonly #logger = new Logger({ context: "LocationManager" });
    private readonly locations = new Map<string, LocationCreateResult>();

    /**
     * Creates multiple locations from parameters or builders.
     *
     * @param items Location parameters or builders.
     * @returns The created locations.
     */
    public bulkCreate(items: readonly (LocationCreateParametres | LocationBuilder)[]): LocationCreateResult[] {
        return items.map((item) => this.create(item instanceof LocationBuilder ? item.build() : item));
    }

    /**
     * Creates a location builder.
     *
     * @param id Location identifier.
     * @returns A location builder.
     */
    public add(id: string): LocationBuilder {
        return new LocationBuilder(id);
    }

    /**
     * Creates and registers a location.
     *
     * @param params Location creation parameters.
     * @returns The created location.
     */
    public create(params: LocationCreateParametres): LocationCreateResult {
        if (this.locations.has(params.id)) {
            throw new LocationAlreadyExistsError(params.id);
        }

        const rawFlags = params.flags ?? LocationFlags.None;
        const flags = Array.isArray(rawFlags) ? rawFlags.reduce((result, flag) => result | flag, 0) : rawFlags;
        const location: LocationCreateResult = {
            id: params.id,
            type: params.type,
            flags,
            connections: {
                land: params.connections?.land ?? [],
                boat: params.connections?.boat ?? []
            }
        };

        this.locations.set(location.id, location);
        return location;
    }

    /**
     * Creates a bidirectional connection between two locations.
     *
     * @param fromId Source location identifier.
     * @param toId Target location identifier.
     * @param transport Transport mode.
     * @param distance Connection distance.
     * @param danger Connection danger level.
     */
    public link(fromId: string, toId: string, transport: TransportMode, distance = 1, danger = 0): void {
        const from = this.locations.get(fromId);
        const to = this.locations.get(toId);

        if (!from || !to) {
            throw new LocationInexistentLinkError(fromId, toId);
        }

        const fromConnections: LocationConnection = from.connections[transport];
        const toConnections: LocationConnection = to.connections[transport];

        if (!fromConnections.some((connection) => connection.targetId === toId)) {
            fromConnections.push({ targetId: toId, distance, danger });
        }

        if (!toConnections.some((connection) => connection.targetId === fromId)) {
            toConnections.push({ targetId: fromId, distance, danger });
        }

        this.#logger.debug(`Linked locations via ${transport}: ${fromId} <-> ${toId} (distance: ${distance}, danger: ${danger}).`);
    }

    /**
     * Gets a location by identifier.
     *
     * @param id Location identifier.
     * @returns The location if found.
     */
    public get(id: string): LocationCreateResult | undefined {
        return this.locations.get(id);
    }

    /**
     * Checks whether a location exists.
     *
     * @param id Location identifier.
     * @returns True if the location exists.
     */
    public has(id: string): boolean {
        return this.locations.has(id);
    }

    /**
     * Serializes all locations.
     *
     * @returns Serialized location data.
     */
    public serialize(): string {
        return JSON.stringify([...this.locations.values()], null, 2);
    }

    /**
     * Replaces the current locations with serialized or structured data.
     *
     * @param data Serialized location data or location objects.
     */
    public deserialize(data: string | readonly LocationCreateResult[]): void {
        const locations: LocationCreateResult[] = typeof data === "string" ? JSON.parse(data) as LocationCreateResult[] : [...data];

        this.locations.clear();

        for (const location of locations) {
            this.create(location);
        }

        this.validate();
        this.#logger.info(`Successfully deserialized and validated ${locations.length} locations.`);
    }

    /**
     * Validates the complete location graph.
     */
    public validate(): void {
        const startingCity = this.validateStartingCity();

        this.validateConnections();
        this.validateReachability(startingCity.id);
        this.#logger.info(`All ${this.locations.size} locations validated successfully.`);
    }

    /**
     * Finds and validates the unique starting city.
     *
     * @returns The starting city.
     */
    private validateStartingCity(): LocationCreateResult {
        const startingCities = [...this.locations.values()].filter((location) => hasFlag(location.flags, LocationFlags.StarterCity));

        if (startingCities.length === 0) {
            throw new NoStartingCityError();
        }

        if (startingCities.length > 1) {
            throw new MultipleStartingCitiesError(startingCities.map((location) => location.id));
        }

        return startingCities[0];
    }

    /**
     * Validates all location connections.
     */
    private validateConnections(): void {
        const transportModes: readonly TransportMode[] = ["land", "boat"];

        for (const location of this.locations.values()) {
            for (const mode of transportModes) {
                for (const connection of location.connections[mode]) {
                    const destinationId = connection.targetId;

                    if (destinationId === location.id) {
                        throw new SelfConnectionError(location.id, mode);
                    }

                    const destination = this.locations.get(destinationId);

                    if (!destination) {
                        throw new InvalidConnectionTargetError(location.id, mode, destinationId);
                    }

                    const isReciprocal = destination.connections[mode].some((entry) => entry.targetId === location.id);

                    if (!isReciprocal) {
                        throw new NonReciprocalConnectionError(mode, location.id, destination.id);
                    }

                    if (mode === "boat" && (!hasFlag(location.flags, LocationFlags.OnWater) || !hasFlag(destination.flags, LocationFlags.OnWater))) {
                        throw new BoatWaterFlagRequiredError(location.id, destinationId);
                    }
                }
            }
        }
    }

    /**
     * Validates that every non-teleport-only location is reachable.
     *
     * @param startId Starting location identifier.
     */
    private validateReachability(startId: string): void {
        const visited = new Set<string>([startId]);
        const queue: string[] = [startId];

        while (queue.length > 0) {
            const currentId = queue.shift();

            if (!currentId) {
                continue;
            }

            const current = this.locations.get(currentId);

            if (!current) {
                continue;
            }

            const connections = [...current.connections.land, ...current.connections.boat];

            for (const connection of connections) {
                if (visited.has(connection.targetId)) {
                    continue;
                }

                visited.add(connection.targetId);
                queue.push(connection.targetId);
            }
        }

        const unreachable = [...this.locations.values()].filter(
            (location) => !visited.has(location.id) && !hasFlag(location.flags, LocationFlags.TeleportOnly)
        );

        if (unreachable.length > 0) {
            throw new UnreachableLocationsError(unreachable.map((location) => location.id));
        }
    }

    /**
     * Gets the unique starting city.
     *
     * @returns The starting city.
     */
    public getStartingCity(): LocationCreateResult {
        return this.validateStartingCity();
    }

    /**
     * Gets the starting city identifier.
     *
     * @returns The starting city identifier.
     */
    public getStartingCityId(): string {
        return this.validateStartingCity().id;
    }
}
