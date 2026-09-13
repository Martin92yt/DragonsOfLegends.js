export enum LocationFlags {
    None = 0,
    StarterCity = 1 << 0,
    OnWater = 1 << 1,
    TeleportOnly = 1 << 2
}

/**
 * Checks whether a location has the specified flag.
 *
 * @param flags Location flags.
 * @param flag Flag to check.
 * @returns True if the flag is present.
 */
export const hasFlag = (flags: LocationFlags, flag: LocationFlags): boolean => {
    return (flags & flag) === flag;
};

/**
 * Adds a flag to a set of location flags.
 *
 * @param flags Current location flags.
 * @param flag Flag to add.
 * @returns Updated location flags.
 */
export const addFlag = (flags: LocationFlags, flag: LocationFlags): LocationFlags => {
    return (flags | flag) as LocationFlags;
};

/**
 * Removes a flag from a set of location flags.
 *
 * @param flags Current location flags.
 * @param flag Flag to remove.
 * @returns Updated location flags.
 */
export const removeFlag = (flags: LocationFlags, flag: LocationFlags): LocationFlags => {
    return (flags & ~flag) as LocationFlags;
};
