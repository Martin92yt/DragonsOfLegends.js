import LocationManager from "./location/location.manager.js";
import { LocationType } from "./location/location.type.js";
import PlayerManager from "./player/player.manager.js";
import CombatManager from "./combat/combat.manager.js";
import { PlayerClass } from "./player/player.class.js";
import OfficialMap from "./location/official-map.js";
import { EnemyType } from "./enemy/enemy.type.js";
import { Logger } from "./utils/logger.js";
import type { EquipmentSlot } from "./inventory/item.enum.js";
import { ItemCategory, ItemRarity } from "./inventory/item.enum";

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
    public readonly players: PlayerManager = new PlayerManager(this);
    public readonly combat: CombatManager = new CombatManager();
    public readonly location: LocationManager = new LocationManager();

    /**
     * Creates a new world instance.
     *
     * @param options World configuration options.
     */
    public constructor(options: Settings = { useWorld: false }) {
        if (options.useWorld) {
            new OfficialMap(this);
        }
    }

    /**
     * Stops all active combats and saves all players.
     *
     * @returns A promise resolved when the world shutdown process is complete.
     */
    public async quick(): Promise<void> {
        this.combat.stopAllCombats();
        await this.players.saveAll();
        logger.blank();
        logger.info("Thank you for using the library!");
        logger.blank();
    }
}

export { PlayerClass, EnemyType, LocationType, EquipmentSlot, ItemCategory, ItemRarity };
