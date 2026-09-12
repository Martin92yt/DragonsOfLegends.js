import LocationManager from "./location/location.manager.js";
import { LocationType } from "./location/location.type.js";
import PlayerManager from "./player/player.manager.js";
import CombatManager from "./combat/combat.manager.js";
import { PlayerClass } from "./player/player.class.js";
import OfficialMap from "./location/official-map.js";
import { EnemyType } from "./enemy/enemy.type.js";
import { Logger } from "./utils/logger.js";
import { PlayerNoCharacterError, SelfCombatError } from "./types/error.js";
import { EquipmentSlot } from "./inventory/item.enum.js"

const logger = new Logger({ context: "World" });

logger.info("🐉 Welcome to DragonsOfLegends.js!");
logger.info("Thank you for using the library!");

logger.blank();
logger.warn("DragonsOfLegends.js is currently in development; APIs may change.");
logger.blank();

interface Settings {
    useWorld: boolean;
    debug?: boolean;
}

export default class World {
    public readonly players = new PlayerManager(this);
    public readonly combat = new CombatManager();
    public readonly location = new LocationManager();

    constructor(options: Settings = { useWorld: false }) {
        if (options.useWorld) {
            new OfficialMap(this);
        }
    }

    // Exemple de fonction de duel à placer dans ton gestionnaire ou World
    public startDuel(player1Id: string, player2Id: string) {
        const p1 = this.players.get(player1Id);
        const p2 = this.players.get(player2Id);

        if (!p1 || !p2) throw new PlayerNoCharacterError();
        if (p1.id === p2.id) throw new SelfCombatError();

        // Calcul de la puissance globale basé sur les attributs (Force + Agilité + Niveau)
        const p1Power = p1.attributes.strength + p1.attributes.agility + (p1.level * 2) + Math.floor(Math.random() * 10);
        const p2Power = p2.attributes.strength + p2.attributes.agility + (p2.level * 2) + Math.floor(Math.random() * 10);

        const winner = p1Power >= p2Power ? p1 : p2;
        const loser = winner.id === p1.id ? p2 : p1;

        return {
            winner,
            loser,
            p1Power,
            p2Power
        };
    }

    public async quick() {
        this.combat.stopAllCombats();

        if (this.players && typeof (this.players as any).saveAll === "function") {
            (this.players as any).saveAll();
        }
        
        logger.blank();
        logger.info("Thank you for using the library!");
        logger.blank();
    }
}

export { PlayerClass, EnemyType, LocationType, EquipmentSlot };