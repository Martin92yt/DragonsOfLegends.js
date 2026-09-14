export enum PlayerClass {
    Warrior = "warrior",
    Explorer = "explorer",
    Rogue = "rogue"
}

export type PlayerClassId = `${PlayerClass}`;

export const isPlayerClass = (value: unknown): value is PlayerClass => {
    return typeof value === "string" && Object.values(PlayerClass).includes(value as PlayerClass);
};