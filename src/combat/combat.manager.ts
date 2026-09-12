import EnemyManager from "../enemy/enemy.manager.js";
import { Logger } from "../utils/logger.js";
import Player from "../player/player.entity.js";
import Combat from "./combat.js";
import { CombatResult } from "../types/result.js";
import { PlayerAlreadyInCombatError, PlayerNotInCombatError } from "../types/error.js";
import EnemyEntity from "../enemy/enemy.entity.js";

export default class CombatManager {
    private readonly combats = new Map<string, Combat>();
    private readonly enemies = new EnemyManager();
    private readonly logger = new Logger({ context: "CombatManager" });

    public start(player: Player): Combat {
        const existing = this.combats.get(player.id);
        if (existing && !existing.isFinished()) throw new PlayerAlreadyInCombatError(player.id);

        const enemy = this.enemies.create(player);
        const combat = new Combat(player, enemy);

        this.logger.info(`Combat started: ${player.name} vs ${enemy.name} (Lv. ${player.level}, ${enemy.health} HP).`);
        this.combats.set(player.id, combat);
        return combat;
    }

    public startWithEnemy(player: Player, enemy: EnemyEntity): Combat {
        const existing = this.combats.get(player.id);
        if (existing && !existing.isFinished()) throw new PlayerAlreadyInCombatError(player.id);

        const combat = new Combat(player, enemy);
        
        // On active le flag de combat sur l'entité du joueur
        player.inCombat = true;

        this.logger.info(`Combat started (Ambush): ${player.name} vs ${enemy.name} (Lv. ${player.level}, ${enemy.health} HP).`);
        this.combats.set(player.id, combat);
        return combat;
    }

    public attack(playerId: string): CombatResult {
        const combat = this.combats.get(playerId);
        if (!combat) throw new PlayerNotInCombatError(playerId);

        const result = combat.attack();
        if (result.victory || result.defeat) {
            this.combats.delete(playerId)
        };
        return result;
    }

    public has(playerId: string): boolean { 
        return this.combats.has(playerId); 
    }

    public get(playerId: string): Combat | undefined { 
        return this.combats.get(playerId); 
    }

    public clear(playerId: string): boolean { 
        return this.combats.delete(playerId); 
    }

    public get size(): number { 
        return this.combats.size; 
    }

    /**
     * Arrête tous les combats en cours, nettoie l'état des joueurs
     * et leur donne une compensation d'XP pour le dérangement.
     */
    public stopAllCombats(): void {
        this.logger.info("Arrêt de tous les combats en cours...");

        for (const [playerId, combat] of this.combats.entries()) {
            const player = combat.player;

            // Donne une petite compensation d'XP (ex: 15 XP ou basé sur le niveau)
            const compensationXP = player.level * 10;
            player.addXP(compensationXP);

            // Remet le flag de combat à false sur le joueur si la propriété existe
            if (player.inCombat !== undefined) {
                player.inCombat = false;
            }

            this.logger.info(`Combat arrêté pour ${player.name}. Compensation accordée : +${compensationXP} XP.`);
        }

        // Vide complètement la liste des combats actifs
        this.combats.clear();
    }
}