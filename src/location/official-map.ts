import { LocationFlags } from "../location/location.flags.js";
import { LocationType } from "../location/location.type.js";
import World from "../index.js";

export default class OfficialMap {
    private readonly rpg: World;

    constructor(rpg: World) {
        this.rpg = rpg;
        this.create();
    }

    private add(id: string, type: LocationType, options: { flags?: LocationFlags; land?: string[]; boat?: string[] } = {}): void {
        this.rpg.location.create({
            id,
            type,
            flags: options.flags ?? LocationFlags.None,
            connections: { land: options.land ?? [], boat: options.boat ?? [] }
        });
    }

    public create(): void {
        // --- ZONE NORD ---
        this.add("Embercross", LocationType.City, { flags: LocationFlags.StarterCity, land: ["Twilight Farm", "Emerald Ferry"] });
        this.add("Twilight Farm", LocationType.City, { flags: LocationFlags.OnWater, land: ["Embercross", "Emerald Ferry"], boat: ["Ironmill"] });
        this.add("Emerald Ferry", LocationType.Village, { land: ["Embercross", "Twilight Farm", "Ironmill"] });
        this.add("Ironmill", LocationType.City, { flags: LocationFlags.OnWater, land: ["Emerald Ferry", "Cang"], boat: ["Twilight Farm", "Wintermouth"] });

        // --- ILE DE L'EST ---
        this.add("Dawnwind", LocationType.Village, { flags: LocationFlags.TeleportOnly, land: ["Stonefield"] });
        this.add("Stonefield", LocationType.City, { flags: LocationFlags.TeleportOnly, land: ["Dawnwind"] });

        // --- ZONE CENTRE / CÔTE-EST ---
        this.add("Cang", LocationType.City, { flags: LocationFlags.OnWater, land: ["Ironmill", "Underburg", "Deep Coast"], boat: ["Redtalon", "Wintermouth"] });
        this.add("Underburg", LocationType.City, { land: ["Cang", "Bright Mill", "Deep Coast"] });
        this.add("Bright Mill", LocationType.City, { land: ["Underburg", "Dungeon Of The Blind Oracle", "Western Road"] });
        this.add("Deep Coast", LocationType.City, { flags: LocationFlags.OnWater, land: ["Cang", "Underburg", "Everfire"] });
        this.add("Everfire", LocationType.Village, { land: ["Deep Coast", "Western Road", "Timberhill", "Redtalon"] });

        // --- ZONE OUEST / MONTAGNES ---
        this.add("Dungeon Of The Blind Oracle", LocationType.Dungeon, { land: ["Bright Mill", "Timeless Den"] });
        this.add("Timeless Den", LocationType.Dungeon, { land: ["Dungeon Of The Blind Oracle", "Southern Watch"] });
        this.add("Southern Watch", LocationType.Village, { land: ["Timeless Den", "Western Road", "Summermyst"] });
        this.add("Western Road", LocationType.City, { land: ["Southern Watch", "Bright Mill", "Everfire", "Timberhill"] });
        this.add("Summermyst", LocationType.City, { land: ["Southern Watch", "Whiteheart"] });
        this.add("Whiteheart", LocationType.Village, { land: ["Summermyst", "Timberhill"] });
        this.add("Timberhill", LocationType.City, { land: ["Whiteheart", "Western Road", "Everfire", "Lightcourt"] });

        // --- ZONE SUD ---
        this.add("Redtalon", LocationType.Village, { flags: LocationFlags.OnWater, land: ["Everfire", "Wintermouth"], boat: ["Cang"] });
        this.add("Wintermouth", LocationType.City, { flags: LocationFlags.OnWater, land: ["Redtalon", "Lightcourt", "Skywood"], boat: ["Ironmill", "Cang"] });
        this.add("Lightcourt", LocationType.City, { land: ["Timberhill", "Wintermouth", "Skywood", "Palace Of Stars"] });
        this.add("Skywood", LocationType.City, { land: ["Wintermouth", "Lightcourt"] });
        this.add("Palace Of Stars", LocationType.Dungeon, { land: ["Lightcourt"] });

        this.rpg.location.validate();
    }
}