export enum LocationType {
    City = "city",
    Village = "village",
    Dungeon = "dungeon",
}

export type LocationTypeId = `${LocationType}`;
export const isLocationType = (value: string): value is LocationType => Object.values(LocationType).includes(value as LocationType);