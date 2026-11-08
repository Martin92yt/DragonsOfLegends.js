import { OFFICIAL_EFFECTS, OFFICIAL_ITEMS, OFFICIAL_LOOTBOXES, OFFICIAL_SHOPS } from "./official-items.js";
import { OFFICIAL_ENEMIES } from "../enemy/official-enemies.js";
import { OFFICIAL_JOBS } from "../jobs/official-jobs.js";
import { createOfficialLocations } from "../location/official-map.js";
import { OFFICIAL_CLASSES } from "../player/official-classes.js";
import { OFFICIAL_TITLES } from "../title/official-titles.js";
import type { ContentPack } from "./content-pack.js";

/** Identifiers of the official content packs. */
export const OFFICIAL_PACK_IDS = {
    items: "dol:items",
    enemies: "dol:enemies",
    classes: "dol:classes",
    jobs: "dol:jobs",
    titles: "dol:titles",
    map: "dol:map"
} as const;

/**
 * Creates the official content packs.
 *
 * The official content is split per kind so a world can keep, for instance, the official jobs but
 * provide its own map. Worlds load them according to the `premade*` options, through the same
 * `world.content.use(...)` API as any third-party pack.
 *
 * @returns A new array of packs (the map pack builds fresh location builders on each call).
 */
export function createOfficialPacks(): ContentPack[] {
    return [
        {
            id: OFFICIAL_PACK_IDS.items,
            name: "Official items, effects, lootboxes and shops",
            effects: OFFICIAL_EFFECTS,
            items: OFFICIAL_ITEMS,
            lootboxes: OFFICIAL_LOOTBOXES,
            shops: OFFICIAL_SHOPS
        },
        { id: OFFICIAL_PACK_IDS.enemies, name: "Official enemies", enemies: OFFICIAL_ENEMIES },
        { id: OFFICIAL_PACK_IDS.classes, name: "Official classes", classes: OFFICIAL_CLASSES },
        { id: OFFICIAL_PACK_IDS.jobs, name: "Official jobs", jobs: OFFICIAL_JOBS },
        { id: OFFICIAL_PACK_IDS.titles, name: "Official titles", titles: OFFICIAL_TITLES },
        { id: OFFICIAL_PACK_IDS.map, name: "Official map", locations: createOfficialLocations() }
    ];
}
