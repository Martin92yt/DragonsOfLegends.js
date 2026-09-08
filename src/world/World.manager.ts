import PlayerManager from "./Player.manager.js";

export default class World {
    public readonly players: PlayerManager;
    constructor() { this.players = new PlayerManager(); }
}
