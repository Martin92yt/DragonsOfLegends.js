import Player from "../player/player.entity.js";
import Enemy from "../enemy/enemy.entity.js";
import { Logger } from "../utils/logger.js";
import { CombatResult } from "../types/result.js";

export default class Combat {
    private readonly logger = new Logger({ context: "Combat" });

    constructor(public readonly player: Player, public readonly enemy: Enemy) {}

    public attack(): CombatResult {
        // 1. Le joueur attaque le monstre
        const rawPlayerAttack = this.getPlayerDamage();
        const previousEnemyHealth = this.enemy.health; 
        const enemyDamage = this.enemy.takeDamage(rawPlayerAttack);
        
        this.logger.debug(`${this.player.name} dealt ${enemyDamage} damage to ${this.enemy.name} (${previousEnemyHealth} -> ${this.enemy.health} HP).`);

        // 2. Vérification si le monstre est mort
        if (!this.enemy.isAlive()) {
            this.player.addXP(this.enemy.experience);
            this.player.gold += this.enemy.gold;
            this.logger.info(`${this.player.name} defeated ${this.enemy.name}.`);
            
            return { 
                playerDamage: 0, 
                enemyDamage, 
                enemyHealth: 0, 
                victory: true, 
                defeat: false,
                enemy: this.enemy 
            };
        }

        // 3. Le monstre riposte
        const theoreticalMonsterDamage = Math.max(1, this.enemy.strength);
        const previousPlayerHealth = this.player.health.current; 
        
        // 🛡️ CORRECTION : On sécurise au cas où takeDamage renvoie null
        const damageResult = this.player.takeDamage(theoreticalMonsterDamage);
        const playerDamage = damageResult?.reducedDamage ?? theoreticalMonsterDamage;

        this.logger.debug(`${this.enemy.name} dealt ${playerDamage} damage to ${this.player.name} (${previousPlayerHealth} -> ${this.player.health.current} HP).`);

        const defeat = !this.player.isAlive();
        if (defeat) {
            this.logger.info(`${this.player.name} was defeated by ${this.enemy.name}...`);
        }

        return { 
            playerDamage, 
            enemyDamage, 
            enemyHealth: this.enemy.health, 
            victory: false, 
            defeat,
            enemy: this.enemy
        };
    }

private getPlayerDamage(): number {
    // 1. Calcul de la stat de base selon la classe
    const statMap: Record<string, number> = { 
        warrior: this.player.attributes.strength, 
        explorer: this.player.attributes.agility, 
        mage: this.player.attributes.intelligence 
    };
    const baseStat = statMap[this.player.classId] ?? this.player.attributes.strength;
    
    // Dégâts bruts de base + aléas (ex: jet de dé)
    let totalDamage = baseStat + Math.floor(Math.random() * 6) - 2;

    // 2. Récupération des bonus/malus d'équipement
    if (this.player.inventory && typeof this.player.inventory.getItems === "function") {
        const items = this.player.inventory.getItems();
        const equippedItems = items.filter((i: any) => i.isEquipped);
        
        let flatBonus = 0;
        let percentageBonus = 0; // Ex: 0.016 pour +1.6% ou -0.008 pour -0.8%

        for (const item of equippedItems) {
            if (item.data) {
                // Dégâts additionnels bruts (ex: +5)
                if (typeof item.data.flatDamage === "number") {
                    flatBonus += item.data.flatDamage;
                }
                
                // Dégâts en pourcentage (ex: 1.6 pour 1.6% ou -0.8 pour -0.8%)
                // On divise par 100 pour transformer le pourcentage en multiplicateur (1.6% -> 0.016)
                if (typeof item.data.damageBonusPercent === "number") {
                    percentageBonus += item.data.damageBonusPercent / 100;
                }
            }
        }

        // Application des bonus bruts
        totalDamage += flatBonus;

        // Application des bonus/malus en pourcentage (ex: 1 + 0.016 = 1.016 ou 1 - 0.008 = 0.992)
        totalDamage = totalDamage * (1 + percentageBonus);
    }

    // 3. Retourne les dégâts finaux (minimum 1)
    return Math.max(1, Math.floor(totalDamage));
}

    public isFinished(): boolean { 
        return !this.player.isAlive() || !this.enemy.isAlive(); 
    }
}