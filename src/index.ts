import PlayerManager from "./world/Player.manager.js";
import CombatManager from "./world/Combat.manager.js";
import { EnemyType } from "../enums/Enemy.Type.js";
import { PlayerClass } from "../enums/Player.Class.js";
import { Logger } from "./utils/Logger.js";
const logger = new Logger({ context: "Packages" });

logger.info("🐉 Welcome to DragonsOfLegends.js!");
logger.info("Thank you for using the library!");

logger.blank();
logger.warn("This module is currently under development and may be unstable.");
logger.blank();

export default class World {

    public readonly players = new PlayerManager();
    public readonly combat = new CombatManager();
}

export { PlayerClass, EnemyType };