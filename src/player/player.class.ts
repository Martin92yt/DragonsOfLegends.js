export enum PlayerClass {
    Warrior = "warrior",
    Explorer = "explorer",
    Rogue = "rogue"
}

export type PlayerClassId = `${PlayerClass}`;

const VALID_PLAYER_CLASSES: ReadonlySet<unknown> = new Set(Object.values(PlayerClass));

/**
 * Checks whether an unknown value is a valid player class.
 *
 * @param potentialPlayerClass The value to check.
 * @returns True if the value is a valid PlayerClass, false otherwise.
 */
export const isPlayerClass = (potentialPlayerClass: unknown): potentialPlayerClass is PlayerClass =>
    VALID_PLAYER_CLASSES.has(potentialPlayerClass);