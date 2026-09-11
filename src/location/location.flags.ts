export enum LocationFlags {
    None = 0,
    StarterCity = 1 << 0,  // 1
    OnWater = 1 << 1,      // 2
    TeleportOnly = 1 << 2, // 4
}

export const hasFlag = (flags: number, flag: LocationFlags): boolean => (flags & flag) === flag;
export const addFlag = (flags: number, flag: LocationFlags): number => flags | flag;
export const removeFlag = (flags: number, flag: LocationFlags): number => flags & ~flag;