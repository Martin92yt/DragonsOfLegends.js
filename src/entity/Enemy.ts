import { EnemyType } from "../../enums/Enemy.Type";

export default class Enemy {
    constructor(public readonly type: EnemyType, public readonly name: string, public health: number, public readonly maxHealth: number, public readonly strength: number, public readonly defense: number, public readonly experience: number) {}
    
    public takeDamage(damage: number): number {
        const finalDamage = Math.max(1, damage - Math.floor(this.defense / 2));

        this.health = Math.max(0, this.health - finalDamage);
        return finalDamage;
    }

    public isAlive(): boolean { return this.health > 0; }
}
