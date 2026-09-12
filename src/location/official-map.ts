import { LocationFlags } from "../location/location.flags.js";
import { LocationType } from "../location/location.type.js";
import World from "../world.js";

export default class OfficialMap {
    private readonly rpg: World;

    constructor(rpg: World) {
        this.rpg = rpg;
        this.create();
    }

    public create(): void {
        this.rpg.location.bulkCreate([
            // --- ZONE NORD ---
            this.rpg.location.add("Embercross").setType(LocationType.City).setFlags(LocationFlags.StarterCity)
                .linkLand("Twilight Farm")
                .linkLand("Emerald Ferry"),

            this.rpg.location.add("Twilight Farm").setType(LocationType.City).setFlags(LocationFlags.OnWater)
                .linkLand("Embercross")
                .linkLand("Emerald Ferry")
                .linkBoat("Ironmill"),

            this.rpg.location.add("Emerald Ferry").setType(LocationType.Village)
                .linkLand("Embercross")
                .linkLand("Twilight Farm")
                .linkLand("Ironmill"),

            this.rpg.location.add("Ironmill").setType(LocationType.City).setFlags(LocationFlags.OnWater)
                .linkLand("Emerald Ferry")
                .linkLand("Cang")
                .linkBoat("Twilight Farm")
                .linkBoat("Wintermouth"),

            // --- ILE DE L'EST ---
            this.rpg.location.add("Dawnwind").setType(LocationType.Village).setFlags(LocationFlags.TeleportOnly)
                .linkLand("Stonefield"),

            this.rpg.location.add("Stonefield").setType(LocationType.City).setFlags(LocationFlags.TeleportOnly)
                .linkLand("Dawnwind"),

            // --- ZONE CENTRE / CÔTE-EST ---
            this.rpg.location.add("Cang").setType(LocationType.City).setFlags(LocationFlags.OnWater)
                .linkLand("Ironmill")
                .linkLand("Underburg")
                .linkLand("Deep Coast")
                .linkBoat("Redtalon")
                .linkBoat("Wintermouth"),

            this.rpg.location.add("Underburg").setType(LocationType.City)
                .linkLand("Cang")
                .linkLand("Bright Mill")
                .linkLand("Deep Coast"),

            this.rpg.location.add("Bright Mill").setType(LocationType.City)
                .linkLand("Underburg")
                .linkLand("Dungeon Of The Blind Oracle")
                .linkLand("Western Road"),

            this.rpg.location.add("Deep Coast").setType(LocationType.City).setFlags(LocationFlags.OnWater)
                .linkLand("Cang")
                .linkLand("Underburg")
                .linkLand("Everfire"),

            this.rpg.location.add("Everfire").setType(LocationType.Village)
                .linkLand("Deep Coast")
                .linkLand("Western Road")
                .linkLand("Timberhill")
                .linkLand("Redtalon"),

            // --- ZONE OUEST / MONTAGNES ---
            this.rpg.location.add("Dungeon Of The Blind Oracle").setType(LocationType.Dungeon)
                .linkLand("Bright Mill")
                .linkLand("Timeless Den"),

            this.rpg.location.add("Timeless Den").setType(LocationType.Dungeon)
                .linkLand("Dungeon Of The Blind Oracle")
                .linkLand("Southern Watch"),

            this.rpg.location.add("Southern Watch").setType(LocationType.Village)
                .linkLand("Timeless Den")
                .linkLand("Western Road")
                .linkLand("Summermyst"),

            this.rpg.location.add("Western Road").setType(LocationType.City)
                .linkLand("Southern Watch")
                .linkLand("Bright Mill")
                .linkLand("Everfire")
                .linkLand("Timberhill"),

            this.rpg.location.add("Summermyst").setType(LocationType.City)
                .linkLand("Southern Watch")
                .linkLand("Whiteheart"),

            this.rpg.location.add("Whiteheart").setType(LocationType.Village)
                .linkLand("Summermyst")
                .linkLand("Timberhill"),

            this.rpg.location.add("Timberhill").setType(LocationType.City)
                .linkLand("Whiteheart")
                .linkLand("Western Road")
                .linkLand("Everfire")
                .linkLand("Lightcourt"),

            // --- ZONE SUD ---
            this.rpg.location.add("Redtalon").setType(LocationType.Village).setFlags(LocationFlags.OnWater)
                .linkLand("Everfire")
                .linkLand("Wintermouth")
                .linkBoat("Cang"),

            this.rpg.location.add("Wintermouth").setType(LocationType.City).setFlags(LocationFlags.OnWater)
                .linkLand("Redtalon")
                .linkLand("Lightcourt")
                .linkLand("Skywood")
                .linkBoat("Ironmill")
                .linkBoat("Cang"),

            this.rpg.location.add("Lightcourt").setType(LocationType.City)
                .linkLand("Timberhill")
                .linkLand("Wintermouth")
                .linkLand("Skywood")
                .linkLand("Palace Of Stars"),

            this.rpg.location.add("Skywood").setType(LocationType.City)
                .linkLand("Wintermouth")
                .linkLand("Lightcourt"),

            this.rpg.location.add("Palace Of Stars").setType(LocationType.Dungeon)
                .linkLand("Lightcourt")
        ]);

        this.rpg.location.validate();
    }
}