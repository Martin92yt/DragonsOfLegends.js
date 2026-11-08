import { consola } from "consola";
import type EnemyRegistry from "../enemy/enemy.registry.js";
import type ItemRegistry from "../inventory/item.registry.js";
import type JobManager from "../jobs/job.manager.js";
import type LocationManager from "../location/location.js";
import type PlayerClassRegistry from "../player/player-class.registry.js";
import type Registry from "../registry/registry.js";
import type TitleManager from "../title/title.manager.js";
import { DuplicateContentPackError, InvalidContentPackError, MissingPackDependencyError, RegistryLockedError } from "../types/error.js";
import type World from "../world.js";
import type { ContentPack, LoadedContentPack, UseContentPackOptions } from "./content-pack.js";

/**
 * The registries a content pack fills.
 */
export interface ContentTargets {
    readonly items: ItemRegistry;
    readonly enemies: EnemyRegistry;
    readonly classes: PlayerClassRegistry;
    readonly jobs: JobManager;
    readonly titles: TitleManager;
    readonly location: LocationManager;
}

/**
 * Loads content packs into a world, atomically.
 *
 * A pack is applied in this order: items, enemies, classes, jobs, titles, locations, then its `setup` hook.
 * If anything fails, every registration made by the pack is reverted and the original error is rethrown.
 */
export default class ContentManager {
    private readonly packs = new Map<string, LoadedContentPack>();
    private locked = false;

    /**
     * Creates a content manager.
     *
     * @param world The world, handed to the `setup` hooks.
     * @param targets The registries to fill.
     */
    public constructor(private readonly world: World, private readonly targets: ContentTargets) {}

    /**
     * Loads a content pack.
     *
     * @param pack The pack to load.
     * @param options The loading options.
     * @returns The summary of the loaded pack.
     * @throws {RegistryLockedError} If the content is locked.
     * @throws {InvalidContentPackError} If the pack has no identifier.
     * @throws {DuplicateContentPackError} If a pack with the same identifier is already loaded.
     * @throws {MissingPackDependencyError} If a dependency is not loaded.
     * @throws The validation errors of the registries (invalid or duplicated entries...).
     */
    public use(pack: ContentPack, options: UseContentPackOptions = {}): LoadedContentPack {
        if (this.locked) throw new RegistryLockedError("content pack");
        if (pack.id.trim() === "") throw new InvalidContentPackError(pack.id, "the identifier must not be empty.");
        if (this.packs.has(pack.id)) throw new DuplicateContentPackError(pack.id);
        for (const dependency of pack.dependsOn ?? []) {
            if (!this.packs.has(dependency)) throw new MissingPackDependencyError(pack.id, dependency);
        }

        const undo: Array<() => void> = [];
        const counts: Record<string, number> = {};
        const { override = false } = options;

        try {
            this.fill(this.targets.items, pack.items, counts, undo, override);
            this.fill(this.targets.enemies, pack.enemies, counts, undo, override);
            this.fill(this.targets.classes, pack.classes, counts, undo, override);
            this.fill(this.targets.jobs, pack.jobs, counts, undo, override);
            this.fill(this.targets.titles, pack.titles, counts, undo, override);

            if ((pack.locations?.length ?? 0) > 0 || (pack.links?.length ?? 0) > 0) {
                undo.push(this.targets.location.snapshot());
                this.targets.location.registerAll(pack.locations ?? [], pack.links ?? []);
                counts["location"] = pack.locations?.length ?? 0;
            }

            pack.setup?.(this.world);
        } catch (error) {
            for (const revert of undo.reverse()) revert();
            consola.error(`Content pack "${pack.id}" rolled back.`);
            throw error;
        }

        const loaded: LoadedContentPack = { id: pack.id, name: pack.name ?? pack.id, version: pack.version, counts };
        this.packs.set(pack.id, loaded);
        consola.success(`Content pack "${loaded.name}" loaded.`);
        // Fire-and-forget: use() is synchronous, so asynchronous listeners are not awaited.
        this.world.events.emit("contentPackLoad", { world: this.world, pack: loaded });
        return loaded;
    }

    /**
     * Checks whether a pack is loaded.
     *
     * @param packId The pack identifier.
     * @returns True if loaded.
     */
    public has(packId: string): boolean {
        return this.packs.has(packId);
    }

    /**
     * Gets the summary of a loaded pack.
     *
     * @param packId The pack identifier.
     * @returns The summary, or undefined.
     */
    public get(packId: string): LoadedContentPack | undefined {
        return this.packs.get(packId);
    }

    /**
     * Lists the loaded packs, in loading order.
     *
     * @returns The summaries.
     */
    public list(): LoadedContentPack[] {
        return [...this.packs.values()];
    }

    /**
     * Whether the content is locked.
     */
    public get isLocked(): boolean {
        return this.locked;
    }

    /**
     * Freezes the content: packs can no longer be loaded and every content registry refuses changes.
     * Call it once the world is configured to guarantee a stable content during the game.
     *
     * @returns void
     */
    public lock(): void {
        this.locked = true;
        this.targets.items.lock();
        this.targets.enemies.lock();
        this.targets.classes.lock();
        this.targets.jobs.lock();
        this.targets.titles.lock();
    }

    /**
     * Reverts {@link ContentManager.lock}.
     *
     * @returns void
     */
    public unlock(): void {
        this.locked = false;
        this.targets.items.unlock();
        this.targets.enemies.unlock();
        this.targets.classes.unlock();
        this.targets.jobs.unlock();
        this.targets.titles.unlock();
    }

    private fill<TDefinition extends object>(
        registry: Registry<TDefinition>,
        definitions: readonly TDefinition[] | undefined,
        counts: Record<string, number>,
        undo: Array<() => void>,
        override: boolean
    ): void {
        if (!definitions || definitions.length === 0) return;

        const stop = registry.onChange((change) => {
            if (change.type === "registered") undo.push(() => registry.unregister(change.id));
            else if (change.type === "replaced" && change.previous) {
                const { previous } = change;
                undo.push(() => registry.register(previous, { override: true }));
            }
        });
        try {
            registry.bulkRegister(definitions, { override });
        } finally {
            stop();
        }
        counts[registry.kind] = definitions.length;
    }
}
