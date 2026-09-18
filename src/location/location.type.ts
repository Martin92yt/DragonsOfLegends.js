export enum LocationType {
    City = "city",
    Village = "village",
    Dungeon = "dungeon"
}

export type LocationTypeId = `${LocationType}`;

const VALID_LOCATION_TYPES: ReadonlySet<unknown> = new Set(Object.values(LocationType));

/**
 * Checks whether an unknown value is a valid location type.
 *
 * @param potentialLocationType The value to check.
 * @returns True if the value is a valid LocationType, false otherwise.
 */
export const isLocationType = (potentialLocationType: unknown): potentialLocationType is LocationType =>
    VALID_LOCATION_TYPES.has(potentialLocationType);