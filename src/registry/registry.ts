import { consola } from "consola";
import { DuplicateRegistryEntryError, RegistryLockedError, UnknownRegistryEntryError } from "../types/error.js";

/**
 * A change applied to a registry.
 */
export interface RegistryChange<TDefinition> {
    /** What happened. */
    readonly type: "registered" | "replaced" | "unregistered";
    /** The identifier of the entry. */
    readonly id: string;
    /** The entry after the change (`registered`, `replaced`) or before it (`unregistered`). */
    readonly definition: TDefinition;
    /** The entry that was replaced (only for `replaced`). */
    readonly previous?: TDefinition;
}

/** Listener notified of every registry change. */
export type RegistryListener<TDefinition> = (change: RegistryChange<TDefinition>) => void;

/** Function that stops a subscription. */
export type RegistryUnsubscribe = () => void;

/**
 * Options of a single registration.
 */
export interface RegisterOptions {
    /**
     * Replaces an existing entry instead of failing.
     * This is how third parties tweak or replace official content.
     * @defaultValue false
     */
    readonly override?: boolean;
}

/**
 * Configuration of a registry.
 */
export interface RegistryOptions<TDefinition> {
    /** Human-readable kind of content, used in logs and errors (`enemy`, `job`, ...). */
    readonly kind: string;
    /** Extracts the unique identifier of a definition. */
    readonly idOf: (definition: TDefinition) => string;
    /**
     * Validates a definition before it is stored.
     * Must throw a business error when the definition is invalid.
     */
    readonly validate?: (definition: TDefinition) => void;
    /** Normalises a definition before it is frozen and stored (e.g. trims the identifier). */
    readonly normalize?: (definition: TDefinition) => TDefinition;
    /** Custom error factories, to keep domain-specific error classes. */
    readonly errors?: {
        readonly duplicate?: (id: string) => Error;
        readonly unknown?: (id: string) => Error;
    };
    /** Sort order of {@link Registry.list}; insertion order when omitted. */
    readonly order?: (first: TDefinition, second: TDefinition) => number;
}

/**
 * Generic, typed and extensible registry of content definitions.
 *
 * Every kind of content of the library (enemies, items, jobs, titles, classes...) is stored in a
 * registry, so nothing is hard-coded: the official content is simply loaded as a content pack,
 * and third parties register their own through the exact same API.
 *
 * Definitions are stored as frozen shallow copies. Registrations are atomic: a batch is either fully
 * registered or not at all.
 *
 * @typeParam TDefinition The type of the stored definitions.
 */
export default class Registry<TDefinition extends object> implements Iterable<TDefinition> {
    private readonly entries = new Map<string, Readonly<TDefinition>>();
    private readonly listeners = new Set<RegistryListener<TDefinition>>();
    private locked = false;

    /**
     * Creates a registry.
     *
     * @param options The registry configuration.
     */
    public constructor(private readonly options: RegistryOptions<TDefinition>) {}

    /**
     * The kind of content stored by the registry.
     */
    public get kind(): string {
        return this.options.kind;
    }

    /**
     * The number of registered entries.
     */
    public get size(): number {
        return this.entries.size;
    }

    /**
     * Whether the registry refuses any modification.
     */
    public get isLocked(): boolean {
        return this.locked;
    }

    /**
     * Registers a definition.
     *
     * @param definition The definition to register.
     * @param options The registration options.
     * @returns The stored (frozen) definition.
     * @throws {RegistryLockedError} If the registry is locked.
     * @throws {DuplicateRegistryEntryError} If the identifier exists and `override` is not set.
     */
    public register(definition: TDefinition, options: RegisterOptions = {}): Readonly<TDefinition> {
        const [stored] = this.bulkRegister([definition], options);
        return stored as Readonly<TDefinition>;
    }

    /**
     * Registers several definitions atomically: if one is invalid or duplicated, nothing is registered.
     *
     * @param definitions The definitions to register.
     * @param options The registration options.
     * @returns The stored (frozen) definitions, in the given order.
     * @throws {RegistryLockedError} If the registry is locked.
     * @throws {DuplicateRegistryEntryError} If an identifier is duplicated (in the batch or in the registry).
     */
    public bulkRegister(definitions: readonly TDefinition[], options: RegisterOptions = {}): Readonly<TDefinition>[] {
        this.assertUnlocked();

        const staged: Array<{ id: string; stored: Readonly<TDefinition> }> = [];
        const batchIds = new Set<string>();
        for (const definition of definitions) {
            this.options.validate?.(definition);
            const normalized = this.options.normalize ? this.options.normalize(definition) : definition;
            const id = this.options.idOf(normalized);
            if (batchIds.has(id) || (!options.override && this.entries.has(id))) throw this.duplicateError(id);
            batchIds.add(id);
            staged.push({ id, stored: Object.freeze({ ...normalized }) });
        }

        const changes: Array<RegistryChange<TDefinition>> = [];
        for (const { id, stored } of staged) {
            const previous = this.entries.get(id);
            this.entries.set(id, stored);
            changes.push(previous ? { type: "replaced", id, definition: stored, previous } : { type: "registered", id, definition: stored });
            consola.debug(`${this.options.kind} ${previous ? "replaced" : "registered"}: ${id}.`);
        }
        for (const change of changes) this.notify(change);
        return staged.map(({ stored }) => stored);
    }

    /**
     * Removes an entry.
     *
     * @param id The identifier of the entry.
     * @returns True if the entry existed.
     * @throws {RegistryLockedError} If the registry is locked.
     */
    public unregister(id: string): boolean {
        this.assertUnlocked();
        const existing = this.entries.get(id);
        if (!existing) return false;

        this.entries.delete(id);
        this.notify({ type: "unregistered", id, definition: existing });
        return true;
    }

    /**
     * Gets an entry.
     *
     * @param id The identifier of the entry.
     * @returns The definition, or undefined.
     */
    public get(id: string): Readonly<TDefinition> | undefined {
        return this.entries.get(id);
    }

    /**
     * Gets an entry or fails.
     *
     * @param id The identifier of the entry.
     * @returns The definition.
     * @throws {UnknownRegistryEntryError} If the entry does not exist (or the custom `unknown` error).
     */
    public require(id: string): Readonly<TDefinition> {
        const definition = this.entries.get(id);
        if (!definition) throw this.options.errors?.unknown?.(id) ?? new UnknownRegistryEntryError(this.options.kind, id);
        return definition;
    }

    /**
     * Checks whether an entry exists.
     *
     * @param id The identifier of the entry.
     * @returns True if registered.
     */
    public has(id: string): boolean {
        return this.entries.has(id);
    }

    /**
     * Lists the definitions, sorted by the registry order (insertion order by default).
     *
     * @returns A new array of definitions.
     */
    public list(): Array<Readonly<TDefinition>> {
        const all = [...this.entries.values()];
        return this.options.order ? all.sort(this.options.order) : all;
    }

    /**
     * Lists the identifiers, in insertion order.
     *
     * @returns A new array of identifiers.
     */
    public ids(): string[] {
        return [...this.entries.keys()];
    }

    /**
     * Lists the definitions matching a predicate.
     *
     * @param predicate The filter.
     * @returns The matching definitions.
     */
    public filter(predicate: (definition: Readonly<TDefinition>) => boolean): Array<Readonly<TDefinition>> {
        return this.list().filter(predicate);
    }

    /**
     * Subscribes to the changes of the registry.
     *
     * @param listener The listener, called synchronously after each change. Its errors are logged, never thrown.
     * @returns A function that stops the subscription.
     */
    public onChange(listener: RegistryListener<TDefinition>): RegistryUnsubscribe {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Locks the registry: any further registration or removal is refused.
     * Useful to freeze the content once the world is running.
     *
     * @returns void
     */
    public lock(): void {
        this.locked = true;
    }

    /**
     * Unlocks the registry.
     *
     * @returns void
     */
    public unlock(): void {
        this.locked = false;
    }

    /**
     * Iterates over the definitions (see {@link Registry.list}).
     *
     * @returns An iterator over the definitions.
     */
    public [Symbol.iterator](): Iterator<Readonly<TDefinition>> {
        return this.list()[Symbol.iterator]();
    }

    private duplicateError(id: string): Error {
        return this.options.errors?.duplicate?.(id) ?? new DuplicateRegistryEntryError(this.options.kind, id);
    }

    private assertUnlocked(): void {
        if (this.locked) throw new RegistryLockedError(this.options.kind);
    }

    private notify(change: RegistryChange<TDefinition>): void {
        for (const listener of this.listeners) {
            try {
                listener(change);
            } catch (error) {
                consola.error(`A ${this.options.kind} registry listener failed.`, error);
            }
        }
    }
}
