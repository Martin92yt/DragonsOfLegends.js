import PlayerManager from "./world/Player.manager.js";
import CombatManager from "./world/Combat.manager.js";

export default class World {
    public readonly players: PlayerManager = new PlayerManager();
    public readonly combats: CombatManager = new CombatManager();
}
