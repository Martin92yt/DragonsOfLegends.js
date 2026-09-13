import { LocationFlags } from "../location/location.flags.js";
import { LocationType } from "../location/location.type.js";
import World from "../world.js";

export default class OfficialMap {
    private readonly rpg: World;

    /**
     * Creates the official world map.
     *
     * @param rpg World instance.
     */
    public constructor(rpg: World) {
        this.rpg = rpg;
        this.create();
    }

    /**
     * Creates and validates all official locations and their connections.
     */
    public create(): void {
        this.rpg.location.bulkCreate([
            this.rpg.location
                .add("Embercross")
                .setType(LocationType.City)
                .setFlags(LocationFlags.StarterCity)
                .linkLand("Twilight Farm", 6, 2)
                .linkLand("Emerald Ferry", 8, 3),
            this.rpg.location
                .add("Twilight Farm")
                .setType(LocationType.City)
                .setFlags(LocationFlags.OnWater)
                .linkLand("Embercross", 6, 2)
                .linkLand("Emerald Ferry", 7, 2)
                .linkBoat("Ironmill", 10, 1),
            this.rpg.location
                .add("Emerald Ferry")
                .setType(LocationType.Village)
                .linkLand("Embercross", 8, 3)
                .linkLand("Twilight Farm", 7, 2)
                .linkLand("Ironmill", 6, 2),
            this.rpg.location
                .add("Ironmill")
                .setType(LocationType.City)
                .setFlags(LocationFlags.OnWater)
                .linkLand("Emerald Ferry", 6, 2)
                .linkLand("Cang", 10, 4)
                .linkBoat("Twilight Farm", 10, 1)
                .linkBoat("Wintermouth", 16, 2),
            this.rpg.location
                .add("Dawnwind")
                .setType(LocationType.Village)
                .setFlags(LocationFlags.TeleportOnly)
                .linkLand("Stonefield", 10, 2),
            this.rpg.location
                .add("Stonefield")
                .setType(LocationType.City)
                .setFlags(LocationFlags.TeleportOnly)
                .linkLand("Dawnwind", 10, 2),
            this.rpg.location
                .add("Cang")
                .setType(LocationType.City)
                .setFlags(LocationFlags.OnWater)
                .linkLand("Ironmill", 10, 4)
                .linkLand("Underburg", 8, 3)
                .linkLand("Deep Coast", 7, 3)
                .linkBoat("Redtalon", 14, 2)
                .linkBoat("Wintermouth", 22, 3),
            this.rpg.location
                .add("Underburg")
                .setType(LocationType.City)
                .linkLand("Cang", 8, 3)
                .linkLand("Bright Mill", 7, 3)
                .linkLand("Deep Coast", 6, 2),
            this.rpg.location
                .add("Bright Mill")
                .setType(LocationType.City)
                .linkLand("Underburg", 7, 3)
                .linkLand("Dungeon Of The Blind Oracle", 12, 6)
                .linkLand("Western Road", 8, 3),
            this.rpg.location
                .add("Deep Coast")
                .setType(LocationType.City)
                .setFlags(LocationFlags.OnWater)
                .linkLand("Cang", 7, 3)
                .linkLand("Underburg", 6, 2)
                .linkLand("Everfire", 8, 3),
            this.rpg.location
                .add("Everfire")
                .setType(LocationType.Village)
                .linkLand("Deep Coast", 8, 3)
                .linkLand("Western Road", 11, 4)
                .linkLand("Timberhill", 9, 3)
                .linkLand("Redtalon", 8, 3),
            this.rpg.location
                .add("Dungeon Of The Blind Oracle")
                .setType(LocationType.Dungeon)
                .linkLand("Bright Mill", 12, 6)
                .linkLand("Timeless Den", 5, 7),
            this.rpg.location
                .add("Timeless Den")
                .setType(LocationType.Dungeon)
                .linkLand("Dungeon Of The Blind Oracle", 5, 7)
                .linkLand("Southern Watch", 10, 5),
            this.rpg.location
                .add("Southern Watch")
                .setType(LocationType.Village)
                .linkLand("Timeless Den", 10, 5)
                .linkLand("Western Road", 6, 2)
                .linkLand("Summermyst", 9, 4),
            this.rpg.location
                .add("Western Road")
                .setType(LocationType.City)
                .linkLand("Southern Watch", 6, 2)
                .linkLand("Bright Mill", 8, 3)
                .linkLand("Everfire", 11, 4)
                .linkLand("Timberhill", 10, 4),
            this.rpg.location
                .add("Summermyst")
                .setType(LocationType.City)
                .linkLand("Southern Watch", 9, 4)
                .linkLand("Whiteheart", 8, 3),
            this.rpg.location
                .add("Whiteheart")
                .setType(LocationType.Village)
                .linkLand("Summermyst", 8, 3)
                .linkLand("Timberhill", 9, 3),
            this.rpg.location
                .add("Timberhill")
                .setType(LocationType.City)
                .linkLand("Whiteheart", 9, 3)
                .linkLand("Western Road", 10, 4)
                .linkLand("Everfire", 9, 3)
                .linkLand("Lightcourt", 12, 4),
            this.rpg.location
                .add("Redtalon")
                .setType(LocationType.Village)
                .setFlags(LocationFlags.OnWater)
                .linkLand("Everfire", 8, 3)
                .linkLand("Wintermouth", 9, 3)
                .linkBoat("Cang", 14, 2),
            this.rpg.location
                .add("Wintermouth")
                .setType(LocationType.City)
                .setFlags(LocationFlags.OnWater)
                .linkLand("Redtalon", 9, 3)
                .linkLand("Lightcourt", 10, 4)
                .linkLand("Skywood", 14, 5)
                .linkBoat("Ironmill", 16, 2)
                .linkBoat("Cang", 22, 3),
            this.rpg.location
                .add("Lightcourt")
                .setType(LocationType.City)
                .linkLand("Timberhill", 12, 4)
                .linkLand("Wintermouth", 10, 4)
                .linkLand("Skywood", 11, 4)
                .linkLand("Palace Of Stars", 15, 6),
            this.rpg.location
                .add("Skywood")
                .setType(LocationType.City)
                .linkLand("Wintermouth", 14, 5)
                .linkLand("Lightcourt", 11, 4),
            this.rpg.location
                .add("Palace Of Stars")
                .setType(LocationType.Dungeon)
                .linkLand("Lightcourt", 15, 6)
        ]);

        this.rpg.location.validate();
    }
}
