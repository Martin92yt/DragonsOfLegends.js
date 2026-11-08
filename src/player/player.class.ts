/**
 * Identifiers of the official player classes.
 * They are ordinary values: other classes are registered at runtime in `world.classes`.
 */
export enum PlayerClass {
    Warrior = "warrior",
    Explorer = "explorer",
    Rogue = "rogue"
}

/**
 * Identifier of a player class: an official {@link PlayerClass} or any class registered by a content pack.
 */
export type PlayerClassId = string;

const VALID_PLAYER_CLASSES: ReadonlySet<unknown> = new Set(Object.values(PlayerClass));

/**
 * Checks whether an unknown value is one of the *official* player classes.
 * For classes registered at runtime, use `world.classes.has(id)`.
 *
 * @param potentialPlayerClass The value to check.
 * @returns True if the value is a valid PlayerClass, false otherwise.
 */
export const isPlayerClass = (potentialPlayerClass: unknown): potentialPlayerClass is PlayerClass =>
    VALID_PLAYER_CLASSES.has(potentialPlayerClass);