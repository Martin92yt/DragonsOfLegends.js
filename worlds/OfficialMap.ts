import { LocationFlags } from "../enums/Location.Flags.ts";
import World, { LocationType } from "../src/index.ts";

export default class OfficialMap {
    private rpg: World;

    constructor(RPG: World) {
        this.rpg = RPG;
        this.create();
    }

    private city(
        id: string,
        options: {
            flags?: LocationFlags[];
            land?: string[];
            boat?: string[];
        } = {},
    ): void {
        this.rpg.location.create({
            id,
            type: LocationType.City,
            flags: options.flags,
            connections: {
                land: options.land ?? [],
                boat: options.boat ?? [],
            },
        });
    }

    private village(
        id: string,
        options: {
            flags?: LocationFlags[];
            land?: string[];
            boat?: string[];
        } = {},
    ): void {
        this.rpg.location.create({
            id,
            type: LocationType.Village,
            flags: options.flags,
            connections: {
                land: options.land ?? [],
                boat: options.boat ?? [],
            },
        });
    }

    private dungeon(
        id: string,
        options: {
            flags?: LocationFlags[];
            land?: string[];
            boat?: string[];
        } = {},
    ): void {
        this.rpg.location.create({
            id,
            type: LocationType.Dungeon,
            flags: options.flags,
            connections: {
                land: options.land ?? [],
                boat: options.boat ?? [],
            },
        });
    }

    public create(): void {
        // --- ZONE NORD ---
        this.city("Embercross", {
            flags: [LocationFlags.StarterCity],
            land: ["Twilight Farm", "Emerald Ferry"],
        });

        this.city("Twilight Farm", {
            flags: [LocationFlags.onWater],
            land: ["Embercross", "Emerald Ferry"],
            boat: ["Ironmill"],
        });

        this.village("Emerald Ferry", {
            land: ["Embercross", "Twilight Farm", "Ironmill"],
        });

        this.city("Ironmill", {
            flags: [LocationFlags.onWater],
            land: ["Emerald Ferry", "Cang"],
            boat: ["Twilight Farm", "Wintermouth"],
        });

        // --- ILE DE L'EST ---
        this.village("Dawnwind", {
			flags: [LocationFlags.TeleportOnly],
            land: ["Stonefield"],
        });

        this.city("Stonefield", {
			flags: [LocationFlags.TeleportOnly],
            land: ["Dawnwind"],
        });

        // --- ZONE CENTRE / COUTE-EST ---
        this.city("Cang", {
            flags: [LocationFlags.onWater],
            land: ["Ironmill", "Underburg", "Deep Coast"],
            boat: ["Redtalon", "Wintermouth"],
        });

        this.city("Underburg", {
            land: ["Cang", "Bright Mill", "Deep Coast"],
        });

        this.city("Bright Mill", {
            land: ["Underburg", "Dungeon Of The Blind Oracle", "Western Road"],
        });

        this.city("Deep Coast", {
            flags: [LocationFlags.onWater],
            land: ["Cang", "Underburg", "Everfire"],
        });

        this.village("Everfire", {
            land: ["Deep Coast", "Western Road", "Timberhill", "Redtalon"],
        });

        // --- ZONE OUEST / MONTAGNES ---
        this.dungeon("Dungeon Of The Blind Oracle", {
            land: ["Bright Mill", "Timeless Den"],
        });

        this.dungeon("Timeless Den", {
            land: ["Dungeon Of The Blind Oracle", "Southern Watch"],
        });

        this.village("Southern Watch", {
            land: ["Timeless Den", "Western Road", "Summermyst"],
        });

        this.city("Western Road", {
            land: ["Southern Watch", "Bright Mill", "Everfire", "Timberhill"],
        });

        this.city("Summermyst", {
            land: ["Southern Watch", "Whiteheart"],
        });

        this.village("Whiteheart", {
            land: ["Summermyst", "Timberhill"],
        });

        this.city("Timberhill", {
            land: ["Whiteheart", "Western Road", "Everfire", "Lightcourt"],
        });

        // --- ZONE SUD ---
        this.village("Redtalon", {
            flags: [LocationFlags.onWater],
            land: ["Everfire", "Wintermouth"],
            boat: ["Cang"],
        });

        this.city("Wintermouth", {
            flags: [LocationFlags.onWater],
            land: ["Redtalon", "Lightcourt", "Skywood"],
            boat: ["Ironmill", "Cang"],
        });

        this.city("Lightcourt", {
            land: ["Timberhill", "Wintermouth", "Skywood", "Palace Of Stars"],
        });

        this.city("Skywood", {
            land: ["Wintermouth", "Lightcourt"],
        });

        this.dungeon("Palace Of Stars", {
            land: ["Lightcourt"],
        });

        this.rpg.location.validate();
    }
}