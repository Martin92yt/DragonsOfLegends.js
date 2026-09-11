import { LocationFlags } from "../../enums/Location.Flags"
import {
    LocationCreateParametres,
    LocationCreateResult
} from "../../interfaces/Location.interface"

export default class LocationManager {
    private locations = new Map<string, LocationCreateResult>()

    public create(parameters: LocationCreateParametres): LocationCreateResult {
        if (this.locations.has(parameters.id)) {
            throw new Error(`Location "${parameters.id}" already exists`)
        }

        const location: LocationCreateResult = {
            id: parameters.id,
            type: parameters.type,
            flags: parameters.flags || [],
            connections: parameters.connections || {
                land: [],
                boat: []
            }
        }

        this.locations.set(location.id, location)
        return location
    }

    /**
     * Connecte deux lieux de manière bidirectionnelle automatiquement.
     */
    public link(fromId: string, toId: string, transport: "land" | "boat"): void {
        const from = this.locations.get(fromId)
        const to = this.locations.get(toId)

        if (!from || !to) {
            throw new Error(`Cannot link inexistent locations: "${fromId}" <-> "${toId}"`)
        }

        if (!from.connections[transport].includes(toId)) {
            from.connections[transport].push(toId)
        }
        if (!to.connections[transport].includes(fromId)) {
            to.connections[transport].push(fromId)
        }
    }

    public get(id: string): LocationCreateResult | undefined {
        return this.locations.get(id)
    }

    public has(id: string): boolean {
        return this.locations.has(id)
    }

    // --- SAUVEGARDE ET CHARGEMENT ---

    /**
     * Exporte l'état actuel de la carte sous forme de chaîne JSON.
     */
    public serialize(): string {
        return JSON.stringify(Array.from(this.locations.values()), null, 2)
    }

    /**
     * Importe une carte complète à partir d'un JSON ou d'un tableau d'objets.
     */
    public deserialize(data: string | LocationCreateResult[]): void {
        const list: LocationCreateResult[] = typeof data === "string" ? JSON.parse(data) : data
        this.locations.clear()

        for (const item of list) {
            this.create(item)
        }
        this.validate()
    }

    // --- VALIDATIONS ---

    public validate(): void {
        const starter = this.validateStartingCity()
        this.validateConnections()
        this.validateReachability(starter.id)
    }

    private validateStartingCity(): LocationCreateResult {
        const startingCities = [...this.locations.values()]
            .filter(location =>
                location.flags.includes(LocationFlags.StarterCity)
            )

        if (startingCities.length === 0) {
            throw new Error("No StartingCity defined")
        }

        if (startingCities.length > 1) {
            throw new Error(
                `Multiple StartingCity found: ${startingCities
                    .map(location => location.id)
                    .join(", ")}`
            )
        }

        return startingCities[0]
    }

    private validateConnections(): void {
        for (const location of this.locations.values()) {
            this.validateLandConnections(location)
            this.validateBoatConnections(location)
        }
    }

    private validateLandConnections(location: LocationCreateResult): void {
        for (const destinationId of location.connections.land) {
            this.validateConnectionExists(location, destinationId, "land")

            const destination = this.locations.get(destinationId)!

            if (!destination.connections.land.includes(location.id)) {
                throw new Error(
                    `Land connection "${location.id}" -> "${destination.id}" is not reciprocal`
                )
            }
        }
    }

    private validateBoatConnections(location: LocationCreateResult): void {
        for (const destinationId of location.connections.boat) {
            this.validateConnectionExists(location, destinationId, "boat")

            const destination = this.locations.get(destinationId)!

            if (!destination.connections.boat.includes(location.id)) {
                throw new Error(
                    `Boat connection "${location.id}" -> "${destination.id}" is not reciprocal`
                )
            }

            if (
                !location.flags.includes(LocationFlags.onWater) ||
                !destination.flags.includes(LocationFlags.onWater)
            ) {
                throw new Error(
                    `Boat connection "${location.id}" -> "${destination.id}" requires both locations to have the onWater flag`
                )
            }
        }
    }

    private validateConnectionExists(
        location: LocationCreateResult,
        destinationId: string,
        transport: "land" | "boat"
    ): void {
        if (destinationId === location.id) {
            throw new Error(
                `Location "${location.id}" cannot connect to itself by ${transport}`
            )
        }

        if (!this.locations.has(destinationId)) {
            throw new Error(
                `Location "${location.id}" has an invalid ${transport} connection to "${destinationId}"`
            )
        }
    }

    /**
     * Vérifie que TOUS les lieux enregistrés sont accessibles depuis la ville de départ.
     */
    private validateReachability(startId: string): void {
        const visited = new Set<string>();
        const queue: string[] = [startId];
        visited.add(startId);

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const current = this.locations.get(currentId)!;
            const neighbors = [...current.connections.land, ...current.connections.boat];

            for (const neighborId of neighbors) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push(neighborId);
                }
            }
        }

        // On filtre les zones ignorées (ex: isolées ou accessibles uniquement par téléportation)
        const unreached = [...this.locations.values()].filter(
            loc => !visited.has(loc.id) && !loc.flags.includes(LocationFlags.TeleportOnly)
        );

        if (unreached.length > 0) {
            throw new Error(
                `Locations unreachable from StarterCity: ${unreached.map(l => l.id).join(", ")}`
            );
        }
    }

    /**
     * Récupère l'objet de la ville de départ.
     */
    public getStartingCity(): LocationCreateResult {
        return this.validateStartingCity();
    }

    /**
     * Récupère directement l'ID texte de la ville de départ.
     */
    public getStartingCityId(): string {
        return this.validateStartingCity().id;
    }
}