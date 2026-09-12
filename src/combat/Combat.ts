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
        
        const roll = Math.floor(Math.random() * 6) - 2;
        let totalDamage = baseStat + roll;

        // 2. Récupération des bonus/malus d'équipement
        let flatBonus = 0;
        let percentageBonus = 0;

        if (this.player.inventory && typeof this.player.inventory.getItems === "function") {
            const items = this.player.inventory.getItems();
            const equippedItems = items.filter((i: any) => i.isEquipped);

            for (const item of equippedItems) {
                if (item.data) {
                    let contributesToAttack = false;

                    const rawDmgBonus = (item.data as any).damageBonus ?? (item.data as any).flatDamage;
                    if (typeof rawDmgBonus === "number") {
                        flatBonus += rawDmgBonus;
                        contributesToAttack = true;
                        this.logger.debug(`➕ [${item.name}] Bonus dégâts : +${rawDmgBonus}`);
                    }
                    
                    const rawPctBonus = (item.data as any).damageBonusPercent;
                    if (typeof rawPctBonus === "number") {
                        percentageBonus += rawPctBonus / 100;
                        contributesToAttack = true;
                        this.logger.debug(`➕ [${item.name}] Bonus % dégâts : +${rawPctBonus}%`);
                    }

                    // USURE
                    if (contributesToAttack && item.data.durability !== undefined && item.data.durability > 0) {
                        const rarityMultipliers: Record<string, number> = {
                            common: 1.5,
                            uncommon: 1.2,
                            rare: 1.0,
                            epic: 0.7,
                            legendary: 0.3
                        };
                        const mult = rarityMultipliers[item.rarity?.toLowerCase()] ?? 1.0;
                        const durabilityLoss = Math.max(1, Math.floor(1 * mult));
                        const oldDurability = item.data.durability;

                        item.data.durability = Math.max(0, item.data.durability - durabilityLoss);
                        this.logger.debug(`🔨 [${item.name}] Usure : ${oldDurability} ➔ ${item.data.durability}`);

                        if (item.data.durability === 0) {
                            this.logger.debug(`⚠️ [${item.name}] L'équipement est cassé !`);
                        }
                    }
                }
            }

            totalDamage += flatBonus;
            totalDamage = totalDamage * (1 + percentageBonus);

            if (this.player.inventory && typeof this.player.inventory.save === "function") {
                this.player.inventory.save(items); 
            }
        }

        const finalDamage = Math.max(1, Math.floor(totalDamage));

        // Log unique condensé
        this.logger.debug(`${this.player.name} attack: base=${baseStat}, roll=${roll}, equipment=+${flatBonus} (+${percentageBonus * 100}%), final=${finalDamage}.`);

        return finalDamage;
    }

    public isFinished(): boolean { 
        return !this.player.isAlive() || !this.enemy.isAlive(); 
    }
}