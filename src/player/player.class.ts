export enum PlayerClass {
    Warrior = "warrior",
    Explorer = "explorer",
    Mage = "mage",
}

export type PlayerClassId = `${PlayerClass}`;

export const isPlayerClass = (value: string): value is PlayerClass => 
    Object.values(PlayerClass).includes(value as PlayerClass);