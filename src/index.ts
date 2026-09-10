import PlayerManager from "./world/Player.manager.js";
import CombatManager from "./world/Combat.manager.js";
import { EnemyType } from "../enums/Enemy.Type.js";
import { Class } from "../enums/Player.Class.js";

export default class World {
    public readonly players = new PlayerManager();
    public readonly combats = new CombatManager();
}

export { Class, EnemyType };

