import { LocationFlags, hasFlag } from "./location.flags.js";
import { LocationCreateParametres, LocationCreateResult } from "./location.interface.js";
import { Logger } from "../utils/logger.js";

export default class LocationManager {
    private readonly logger = new Logger({ context: "LocationManager" });
    private readonly locations = new Map<string, LocationCreateResult>();

    public create(params: LocationCreateParametres): LocationCreateResult {
        if (this.locations.has(params.id)) throw new Error(`Location "${params.id}" already exists`);
        
        const rawFlags = params.flags ?? LocationFlags.None;
        const flags = Array.isArray(rawFlags) ? rawFlags.reduce((a, b) => a | b, 0) : rawFlags;
        const location: LocationCreateResult = {
            id: params.id, 
            type: params.type, 
            flags,
            connections: { land: params.connections?.land ?? [], boat: params.connections?.boat ?? [] }
        };

        this.locations.set(location.id, location);
        // Changé en trace/supprimé de la console visible par défaut pour éviter le spam
        // this.logger.trace(`Location created: ${location.id} (${location.type})`);
        return location;
    }

    public link(fromId: string, toId: string, transport: "land" | "boat"): void {
        const from = this.locations.get(fromId), to = this.locations.get(toId);
        if (!from || !to) throw new Error(`Cannot link inexistent locations: "${fromId}" <-> "${toId}"`);
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
        if (starters.length === 0) throw new Error("No StartingCity defined");
        if (starters.length > 1) throw new Error(`Multiple StartingCity found: ${starters.map(l => l.id).join(", ")}`);
        return starters[0];
    }

    private validateConnections(): void {
        for (const loc of this.locations.values()) {
            for (const mode of ["land", "boat"] as const) {
                for (const destId of loc.connections[mode]) {
                    if (destId === loc.id) throw new Error(`Location "${loc.id}" cannot connect to itself by ${mode}`);
                    const dest = this.locations.get(destId);
                    if (!dest) throw new Error(`Location "${loc.id}" has invalid ${mode} connection to "${destId}"`);
                    if (!dest.connections[mode].includes(loc.id)) throw new Error(`${mode} connection "${loc.id}" -> "${dest.id}" is not reciprocal`);
                    if (mode === "boat" && (!hasFlag(loc.flags, LocationFlags.OnWater) || !hasFlag(dest.flags, LocationFlags.OnWater))) {
                        throw new Error(`Boat connection "${loc.id}" -> "${dest.id}" requires OnWater flag on both`);
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
        if (unreached.length > 0) throw new Error(`Unreachable locations: ${unreached.map(l => l.id).join(", ")}`);
    }

    public getStartingCity(): LocationCreateResult { return this.validateStartingCity(); }
    public getStartingCityId(): string { return this.validateStartingCity().id; }
}