export enum LocationFlags {
    None = 0,
    StarterCity = 1 << 0,
    OnWater = 1 << 1,
    TeleportOnly = 1 << 2
}

/**
 * Checks whether a location contains the specified flag.
 *
 * @param combinedLocationFlags The current combined location flags.
 * @param targetLocationFlag The specific flag to check.
 * @returns True if the flag is present, false otherwise.
 */
export const hasFlag = (combinedLocationFlags: LocationFlags, targetLocationFlag: LocationFlags): boolean =>
    (combinedLocationFlags & targetLocationFlag) === targetLocationFlag;

/**
 * Adds a flag to a set of location flags.
 *
 * @param currentLocationFlags The current location flags.
 * @param flagToAdd The flag to add.
 * @returns The updated location flags.
 */
export const addFlag = (currentLocationFlags: LocationFlags, flagToAdd: LocationFlags): LocationFlags =>
    (currentLocationFlags | flagToAdd) as LocationFlags;

/**
 * Removes a flag from a set of location flags.
 *
 * @param currentLocationFlags The current location flags.
 * @param flagToRemove The flag to remove.
 * @returns The updated location flags.
 */
export const removeFlag = (currentLocationFlags: LocationFlags, flagToRemove: LocationFlags): LocationFlags =>
    (currentLocationFlags & ~flagToRemove) as LocationFlags;

/**
 * Toggles a flag in a set of location flags (adds it if absent, removes it if present).
 *
 * @param currentLocationFlags The current location flags.
 * @param flagToToggle The flag to toggle.
 * @returns The updated location flags.
 */
export const toggleFlag = (currentLocationFlags: LocationFlags, flagToToggle: LocationFlags): LocationFlags =>
    hasFlag(currentLocationFlags, flagToToggle)
        ? removeFlag(currentLocationFlags, flagToToggle)
        : addFlag(currentLocationFlags, flagToToggle);