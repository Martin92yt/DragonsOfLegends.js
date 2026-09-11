import ExplorationManager from "./world/Exploration.manager.ts";
import locationManager from "./world/Location.manger.ts";
import { LocationType } from "../enums/Location.Type.ts";
import { PlayerClass } from "../enums/Player.Class.ts";
import PlayerManager from "./world/Player.manager.ts";
import CombatManager from "./world/Combat.manager.ts";
import { EnemyType } from "../enums/Enemy.Type.ts";
import { Logger } from "./utils/Logger.ts";
import OfficialMap from "../worlds/OfficialMap.ts"

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
    public readonly exploration = new ExplorationManager();
    public readonly location = new locationManager();
    constructor(options: Settings = { useWorld: false }) { if (options.useWorld) new OfficialMap(this) }
}

export { PlayerClass, EnemyType, LocationType };