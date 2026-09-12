import { LocationFlags, hasFlag } from "./location.flags.js";
import { LocationCreateParametres, LocationCreateResult } from "./location.interface.js";
import { Logger } from "../utils/logger.js";
import { LocationBuilder } from "./location.builder.js";
import { BoatWaterFlagRequiredError, InvalidConnectionTargetError, LocationAlreadyExistsError, LocationInexistentLinkError, MultipleStartingCitiesError, NonReciprocalConnectionError, NoStartingCityError, SelfConnectionError, UnreachableLocationsError } from "../types/error.js";

export default class LocationManager {
    private readonly logger = new Logger({ context: "LocationManager" });
    private readonly locations = new Map<string, LocationCreateResult>();

    // 1. Création en masse (accepte soit des objets bruts, soit directement des builders)
    public bulkCreate(items: (LocationCreateParametres | LocationBuilder)[]): LocationCreateResult[] {
        const results: LocationCreateResult[] = [];
        for (const item of items) {
            // Si c'est une instance du Builder, on appelle .build() automatiquement
            const params = item instanceof LocationBuilder ? item.build() : item;
            results.push(this.create(params));
        }
        return results;
    }

    // 2. Syntaxe fluide pour initialiser un builder directement depuis le manager
    public add(id: string): LocationBuilder {
        return new LocationBuilder(id);
    }

    public create(params: LocationCreateParametres): LocationCreateResult {
        if (this.locations.has(params.id)) throw new LocationAlreadyExistsError(params.id);
        
        const rawFlags = params.flags ?? LocationFlags.None;
        const flags = Array.isArray(rawFlags) ? rawFlags.reduce((a, b) => a | b, 0) : rawFlags;
        const location: LocationCreateResult = {
            id: params.id, 
            type: params.type, 
            flags,
            connections: { land: params.connections?.land ?? [], boat: params.connections?.boat ?? [] }
        };

        this.locations.set(location.id, location);
        return location;
    }

    public link(fromId: string, toId: string, transport: "land" | "boat"): void {
        const from = this.locations.get(fromId), to = this.locations.get(toId);
        if (!from || !to) throw new LocationInexistentLinkError(fromId, toId);
        if (!from.connections[transport].includes(toId)) from.connections[transport].push(toId);
        if (!to.connections[transport].includes(fromId)) to.connections[transport].push(fromId);
        this.logger.debug(`Linked locations via ${transport}: ${fromId} <-> ${toId}`);
    }

    public get(id: string): LocationCreateResult | undefined { return this.locations.get(id); }
    public has(id: string): boolean { return this.locations.has(id); }
    public serialize(): string { return JSON.stringify(Array.from(this.locations.values()), null, 2); }

    public deserialize(data: string | LocationCreateResult[]): void {
        const list: LocationCreateResult[] = typeof data === "string" ? JSON.parse(data) : data;
        this.locations.clear();
        for (const item of list) this.create(item);
        this.validate();
        this.logger.info(`Successfully deserialized and validated ${list.length} locations.`);
    }

    public validate(): void {
        const starter = this.validateStartingCity();
        this.validateConnections();
        this.validateReachability(starter.id);
        this.logger.info(`All ${this.locations.size} locations validated successfully.`);
    }

    private validateStartingCity(): LocationCreateResult {
        const starters = [...this.locations.values()].filter(l => hasFlag(l.flags, LocationFlags.StarterCity));
        if (starters.length === 0) throw new NoStartingCityError();
        if (starters.length > 1) throw new MultipleStartingCitiesError(starters.map(l => l.id));
        return starters[0];
    }

    private validateConnections(): void {
        for (const loc of this.locations.values()) {
            for (const mode of ["land", "boat"] as const) {
                for (const destId of loc.connections[mode]) {
                    if (destId === loc.id) throw new SelfConnectionError(loc.id, mode);
                    const dest = this.locations.get(destId);
                    if (!dest) throw new InvalidConnectionTargetError(loc.id, mode, destId);
                    if (!dest.connections[mode].includes(loc.id)) throw new NonReciprocalConnectionError(mode, loc.id, dest.id);
                    if (mode === "boat" && (!hasFlag(loc.flags, LocationFlags.OnWater) || !hasFlag(dest.flags, LocationFlags.OnWater))) {
                        throw new BoatWaterFlagRequiredError(loc.id, destId);
                    }
                }
            }
        }
    }

    private validateReachability(startId: string): void {
        const visited = new Set<string>([startId]), queue: string[] = [startId];
        while (queue.length > 0) {
            const curr = this.locations.get(queue.shift()!)!;
            for (const neighbor of [...curr.connections.land, ...curr.connections.boat]) {
                if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
            }
        }
        const unreached = [...this.locations.values()].filter(l => !visited.has(l.id) && !hasFlag(l.flags, LocationFlags.TeleportOnly));
        if (unreached.length > 0) throw new UnreachableLocationsError(unreached.map(l => l.id));
    }

    public getStartingCity(): LocationCreateResult { return this.validateStartingCity(); }
    public getStartingCityId(): string { return this.validateStartingCity().id; }
}