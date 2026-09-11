import { EnemyType } from "./enemy.type.js";

export interface EnemyData {
    type: EnemyType;
    name: string;
    health: number;
    maxHealth: number;
    strength: number;
    defense: number;
    experience: number;
}

export default class Enemy {
    constructor(
        public readonly type: EnemyType,
        public readonly name: string,
        public health: number,
        public readonly maxHealth: number,
        public readonly strength: number,
        public readonly defense: number,
        public readonly experience: number
    ) {}

    public takeDamage(damage: number): number {
        const finalDamage = Math.max(1, damage - Math.floor(this.defense / 2));
        this.health = Math.max(0, this.health - finalDamage);
        return finalDamage;
    }

    public isAlive(): boolean { return this.health > 0; }
    public heal(amount: number): void { this.health = Math.min(this.maxHealth, this.health + amount); }
    public get healthRatio(): number { return this.health / this.maxHealth; }
}