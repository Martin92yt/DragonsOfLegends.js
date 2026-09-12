import Player from "../player/player.entity.js";
import Enemy from "../enemy/enemy.entity.js";
import { Logger } from "../utils/logger.js";

export interface CombatResult {
    playerDamage: number; // Dégâts réels pris par le joueur (après défense)
    enemyDamage: number;  // Dégâts infligés par le joueur au monstre
    enemyHealth: number;  // PV restants du monstre
    victory: boolean;
    defeat: boolean;
    enemy: Enemy;         // 👈 Ajouté pour accéder facilement au monstre et à ses drops
}

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
            this.player.gainExperience(this.enemy.experience);
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
        const statMap: Record<string, number> = { 
            warrior: this.player.attributes.strength, 
            explorer: this.player.attributes.agility, 
            mage: this.player.attributes.intelligence 
        };
        const baseStat = statMap[this.player.classId] ?? this.player.attributes.strength;
        return Math.max(1, baseStat + Math.floor(Math.random() * 6) - 2);
    }

    public isFinished(): boolean { 
        return !this.player.isAlive() || !this.enemy.isAlive(); 
    }
}