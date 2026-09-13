export enum LocationType {
    City = "city",
    Village = "village",
    Dungeon = "dungeon"
}

export type LocationTypeId = `${LocationType}`;

export const isLocationType = (value: unknown): value is LocationType => {
    return typeof value === "string" && Object.values(LocationType).includes(value as LocationType);
};
