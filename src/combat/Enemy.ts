export default class Enemy {
    constructor(
        public readonly name: string,
        public health: number,
        public readonly maxHealth: number,
        public readonly strength: number,
        public readonly defense: number,
        public readonly experience: number,
    ) {}

    public isAlive(): boolean {
        return this.health > 0;
    }

    public takeDamage(damage: number): number {
        const damageDealt = Math.max(1, damage - this.defense);

        this.health = Math.max(0, this.health - damageDealt);

        return damageDealt;
    }
}
