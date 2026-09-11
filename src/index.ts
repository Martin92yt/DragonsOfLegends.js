import LocationManager from "./location/location.manager.js";
import { LocationType } from "./location/location.type.js";
import PlayerManager from "./player/player.manager.js";
import CombatManager from "./combat/combat.manager.js";
import { PlayerClass } from "./player/player.class.js";
import OfficialMap from "./location/official-map.js";
import { EnemyType } from "./enemy/enemy.type.js";
import { Logger } from "./utils/logger.js";

const logger = new Logger({ context: "Packages" });
logger.info("🐉 Welcome to DragonsOfLegends.js!");
logger.info("Thank you for using the library!");

logger.blank();
logger.warn("This module is currently under development and may be unstable.");
logger.blank();

interface Settings { useWorld: boolean; }

export default class World {
    public readonly players = new PlayerManager(this);
    public readonly combat = new CombatManager();
    public readonly location = new LocationManager();

    constructor(options: Settings = { useWorld: false }) {
        if (options.useWorld) new OfficialMap(this);
    }
}

export { PlayerClass, EnemyType, LocationType };