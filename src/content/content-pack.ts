import type { EnemyDefinition } from "../enemy/enemy.definition.js";
import type { EffectDefinition } from "../effects/effect.types.js";
import type { LootboxDefinition } from "../lootbox/lootbox.types.js";
import type { ShopDefinition } from "../shop/shop.types.js";
import type { Item } from "../inventory/inventory.interface.js";
import type { JobDefinition } from "../jobs/job.types.js";
import type { LocationBuilder } from "../location/location.builder.js";
import type { LocationCreateParametres, LocationLinkSpec } from "../location/location.interface.js";
import type { PlayerClassDefinition } from "../player/player-class.definition.js";
import type { TitleDefinition } from "../title/title.types.js";
import type World from "../world.js";

/**
 * A bundle of content that can be loaded into a world with `world.content.use(pack)`.
 *
 * Packs are how both the official content and third-party content are delivered: the library itself
 * does not impose any content. Every section is optional.
 */
export interface ContentPack {
    /** Unique identifier of the pack (e.g. `"dol-official"`, `"my-expansion"`). */
    readonly id: string;
    /** Display name. */
    readonly name?: string;
    /** Version of the pack (free-form, e.g. semver). */
    readonly version?: string;
    /** Identifiers of the packs that must already be loaded. */
    readonly dependsOn?: readonly string[];
    /** Items of the catalogue. */
    readonly items?: readonly Item[];
    /** Temporary effects (potions, buffs). Registered before the items so consumables can reference them. */
    readonly effects?: readonly EffectDefinition[];
    /** Lootboxes (mystery pouches). Their drops must reference items of this pack or of a dependency. */
    readonly lootboxes?: readonly LootboxDefinition[];
    /** Shops. Their listings must reference items of this pack or of a dependency. */
    readonly shops?: readonly ShopDefinition[];
    /** Enemy species. */
    readonly enemies?: readonly EnemyDefinition[];
    /** Player classes. */
    readonly classes?: readonly PlayerClassDefinition[];
    /** Jobs (and their actions, loot tables, tool rewards...). */
    readonly jobs?: readonly JobDefinition[];
    /** Titles. */
    readonly titles?: readonly TitleDefinition[];
    /**
     * Locations. They are added atomically and the whole graph is validated: after the pack is loaded the world must
     * have exactly one starting city, reciprocal connections and no unreachable location.
     */
    readonly locations?: readonly (LocationCreateParametres | LocationBuilder)[];
    /**
     * Bidirectional connections applied after the locations are created. This is how a pack plugs its locations into
     * existing ones (e.g. the official map): connect through `links`, not through the builder, so both sides are updated.
     */
    readonly links?: readonly LocationLinkSpec[];
    /**
     * Free-form hook run after the registrations (e.g. to subscribe to events or register achievements).
     * If it throws, the whole pack is rolled back (what the hook did outside the registries is not).
     */
    readonly setup?: (world: World) => void;
}

/**
 * Options of {@link ContentManager.use}.
 */
export interface UseContentPackOptions {
    /**
     * Lets the pack replace existing entries (same identifier) instead of failing.
     * @defaultValue false
     */
    readonly override?: boolean;
}

/**
 * Summary of a loaded pack.
 */
export interface LoadedContentPack {
    readonly id: string;
    readonly name: string;
    readonly version: string | undefined;
    /** Number of entries registered by kind (`item`, `enemy`, `player class`, `job`, `title`, `location`). */
    readonly counts: Readonly<Record<string, number>>;
}

/**
 * Declares a content pack with full type checking (identity helper).
 *
 * @param pack The pack definition.
 * @returns The same pack.
 */
export function defineContentPack<TPack extends ContentPack>(pack: TPack): TPack {
    return pack;
}
