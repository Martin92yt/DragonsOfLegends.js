export enum EnemyType {
    Goblin = "goblin",
    Wolf = "wolf",
    Skeleton = "skeleton",
}

export type EnemyTypeId = `${EnemyType}`;
export const isEnemyType = (value: string): value is EnemyType => Object.values(EnemyType).includes(value as EnemyType);