/**
 * Moteur d'événements typé de DragonsOfLegends.js.
 *
 * Le moteur est générique sur une table `nom d'événement -> payload` :
 * le compilateur vérifie à la fois le nom et la forme du payload à chaque
 * `on()`, `emit()` ou `waitFor()`.
 *
 * @packageDocumentation
 */

/** Contrainte d'une table d'événements : chaque payload est un objet. */
export type EventMapConstraint<TEvents> = { [K in keyof TEvents]: object };

/** Fonction de désabonnement renvoyée par chaque abonnement. */
export type Unsubscribe = () => void;

/** Écouteur d'un événement précis (synchrone ou asynchrone). */
export type EventListener<TEvents, K extends keyof TEvents> = (payload: TEvents[K]) => void | Promise<void>;

/** Événement tel que reçu par un écouteur joker (`onAny`). */
export type AnyEvent<TEvents> = { [K in keyof TEvents]: { readonly name: K; readonly payload: TEvents[K] } }[keyof TEvents];

/** Écouteur joker : reçoit tous les événements. */
export type AnyEventListener<TEvents> = (event: AnyEvent<TEvents>) => void | Promise<void>;

/** Options d'abonnement. */
export interface ListenerOptions<TPayload> {
    /** Se désabonne automatiquement après la première livraison. */
    readonly once?: boolean;
    /**
     * Ordre d'exécution : les priorités les plus élevées s'exécutent en premier.
     * À priorité égale, l'ordre d'abonnement est conservé.
     * @defaultValue 0
     */
    readonly priority?: number;
    /** Ne livre le payload que si le prédicat renvoie `true`. */
    readonly filter?: (payload: TPayload) => boolean;
    /** Désabonne l'écouteur lorsque le signal est avorté. */
    readonly signal?: AbortSignal;
}

/** Options de `waitFor`. */
export interface WaitForOptions<TPayload> {
    readonly filter?: (payload: TPayload) => boolean;
    /** Délai maximal en millisecondes avant rejet par {@link EventTimeoutError}. */
    readonly timeoutMs?: number;
    readonly signal?: AbortSignal;
}

/** Logger minimal, compatible avec `consola`. */
export interface EventLogger {
    debug(message: string, ...details: unknown[]): void;
    error(message: string, ...details: unknown[]): void;
}

/** Options de construction du moteur. */
export interface EventEngineOptions {
    /** Logger structuré. @defaultValue aucun (silencieux) */
    readonly logger?: EventLogger;
    /**
     * Appelé lorsqu'un écouteur ou un filtre échoue.
     * Par défaut l'erreur est journalisée ; elle n'interrompt jamais la livraison aux autres écouteurs.
     */
    readonly onError?: (error: EventListenerError) => void;
}

/** Erreur de base du moteur d'événements. */
export class EventEngineError extends Error {
    public constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = new.target.name;
    }
}

/** Un écouteur (ou son filtre) a levé une erreur. */
export class EventListenerError extends EventEngineError {
    public constructor(public readonly eventName: string, cause: unknown) {
        super(`Listener for event "${eventName}" failed.`, { cause });
    }
}

/** `waitFor` a dépassé son délai. */
export class EventTimeoutError extends EventEngineError {
    public constructor(public readonly eventName: string, public readonly timeoutMs: number) {
        super(`Timed out after ${timeoutMs}ms waiting for event "${eventName}".`);
    }
}

/** Une attente (`waitFor`) a été annulée par un `AbortSignal`. */
export class EventAbortedError extends EventEngineError {
    public constructor(public readonly eventName: string) {
        super(`Waiting for event "${eventName}" was aborted.`);
    }
}

interface Registration<TPayload, TListener> {
    readonly listener: TListener;
    readonly once: boolean;
    readonly priority: number;
    readonly filter: ((payload: TPayload) => boolean) | undefined;
}

type AnyRegistration<TEvents> = Registration<AnyEvent<TEvents>, AnyEventListener<TEvents>>;

/**
 * Émetteur d'événements fortement typé.
 *
 * @typeParam TEvents - Table `nom -> payload` (typiquement `GameEvents`).
 *
 * @example
 * ```ts
 * interface Events { ping: { playerId: string } }
 * const engine = new EventEngine<Events>();
 * const off = engine.on("ping", ({ playerId }) => console.log(playerId));
 * engine.emit("ping", { playerId: "p1" });
 * off();
 * ```
 */
export class EventEngine<TEvents extends EventMapConstraint<TEvents>> {
    private readonly registrations = new Map<keyof TEvents, Registration<never, never>[]>();
    private readonly wildcards: AnyRegistration<TEvents>[] = [];
    private readonly logger: EventLogger | undefined;
    private readonly onError: (error: EventListenerError) => void;

    /** @param options - Logger et gestion d'erreurs optionnels. */
    public constructor(options: EventEngineOptions = {}) {
        this.logger = options.logger;
        this.onError = options.onError ?? ((error) => this.logger?.error(error.message, error.cause));
    }

    /**
     * Abonne un écouteur à un événement.
     *
     * @param event - Nom de l'événement.
     * @param listener - Fonction appelée avec le payload typé.
     * @param options - `once`, `priority`, `filter`, `signal`.
     * @returns Fonction de désabonnement (idempotente).
     */
    public on<K extends keyof TEvents>(
        event: K,
        listener: EventListener<TEvents, K>,
        options: ListenerOptions<TEvents[K]> = {}
    ): Unsubscribe {
        const registration: Registration<TEvents[K], EventListener<TEvents, K>> = {
            listener,
            once: options.once ?? false,
            priority: options.priority ?? 0,
            filter: options.filter
        };
        const list = this.registrations.get(event) ?? [];
        // Rationale: insertion triée (priorité décroissante, stable) pour éviter un tri à chaque emit.
        const index = list.findIndex((existing) => existing.priority < registration.priority);
        list.splice(index === -1 ? list.length : index, 0, registration as unknown as Registration<never, never>);
        this.registrations.set(event, list);
        this.logger?.debug(`[events] listener added for "${String(event)}"`);

        const unsubscribe = (): void => this.remove(event, registration as unknown as Registration<never, never>);
        options.signal?.addEventListener("abort", unsubscribe, { once: true });
        return unsubscribe;
    }

    /** Équivalent de `on` avec `once: true`. */
    public once<K extends keyof TEvents>(
        event: K,
        listener: EventListener<TEvents, K>,
        options: Omit<ListenerOptions<TEvents[K]>, "once"> = {}
    ): Unsubscribe {
        return this.on(event, listener, { ...options, once: true });
    }

    /**
     * Abonne un écouteur joker qui reçoit tous les événements (journalisation, métriques, passerelles).
     *
     * @returns Fonction de désabonnement.
     */
    public onAny(listener: AnyEventListener<TEvents>, options: Pick<ListenerOptions<never>, "once" | "signal"> = {}): Unsubscribe {
        const registration: AnyRegistration<TEvents> = { listener, once: options.once ?? false, priority: 0, filter: undefined };
        this.wildcards.push(registration);
        const unsubscribe = (): void => {
            const index = this.wildcards.indexOf(registration);
            if (index !== -1) this.wildcards.splice(index, 1);
        };
        options.signal?.addEventListener("abort", unsubscribe, { once: true });
        return unsubscribe;
    }

    /** Retire un écouteur précis. @returns `true` s'il était abonné. */
    public off<K extends keyof TEvents>(event: K, listener: EventListener<TEvents, K>): boolean {
        const list = this.registrations.get(event);
        const target = list?.find((registration) => (registration.listener as unknown) === listener);
        if (!list || !target) return false;
        this.remove(event, target);
        return true;
    }

    /**
     * Émet un événement de façon synchrone.
     *
     * Les écouteurs asynchrones sont lancés sans être attendus (fire-and-forget explicite) :
     * leurs rejets sont capturés et transmis à `onError`. Utiliser {@link emitAsync} pour attendre.
     *
     * @returns Nombre d'écouteurs ayant reçu l'événement (jokers inclus).
     */
    public emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): number {
        let delivered = 0;
        for (const run of this.plan(event, payload)) {
            delivered++;
            try {
                const result = run();
                if (result instanceof Promise) {
                    // Fire-and-forget voulu : la rejection est routée vers onError.
                    result.catch((error: unknown) => this.onError(new EventListenerError(String(event), error)));
                }
            } catch (error) {
                this.onError(new EventListenerError(String(event), error));
            }
        }
        return delivered;
    }

    /**
     * Émet un événement et attend la fin de tous les écouteurs, séquentiellement (ordre de priorité).
     * Une erreur d'écouteur est transmise à `onError` sans interrompre la chaîne.
     *
     * @returns Nombre d'écouteurs ayant reçu l'événement.
     */
    public async emitAsync<K extends keyof TEvents>(event: K, payload: TEvents[K]): Promise<number> {
        let delivered = 0;
        for (const run of this.plan(event, payload)) {
            delivered++;
            try {
                await run();
            } catch (error) {
                this.onError(new EventListenerError(String(event), error));
            }
        }
        return delivered;
    }

    /**
     * Attend la prochaine occurrence d'un événement (filtrable).
     *
     * @throws {@link EventTimeoutError} si `timeoutMs` est dépassé.
     * @throws {@link EventAbortedError} si le signal est avorté.
     */
    public waitFor<K extends keyof TEvents>(event: K, options: WaitForOptions<TEvents[K]> = {}): Promise<TEvents[K]> {
        return new Promise<TEvents[K]>((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            const cleanup = (): void => {
                unsubscribe();
                if (timer !== undefined) clearTimeout(timer);
                options.signal?.removeEventListener("abort", onAbort);
            };
            const onAbort = (): void => {
                cleanup();
                reject(new EventAbortedError(String(event)));
            };
            const unsubscribe = this.on(
                event,
                (payload) => {
                    cleanup();
                    resolve(payload);
                },
                { once: true, filter: options.filter }
            );
            if (options.timeoutMs !== undefined) {
                timer = setTimeout(() => {
                    cleanup();
                    reject(new EventTimeoutError(String(event), options.timeoutMs ?? 0));
                }, options.timeoutMs);
            }
            if (options.signal?.aborted) return onAbort();
            options.signal?.addEventListener("abort", onAbort, { once: true });
        });
    }

    /** Nombre d'écouteurs d'un événement (ou de tous si omis, jokers inclus). */
    public listenerCount(event?: keyof TEvents): number {
        if (event !== undefined) return this.registrations.get(event)?.length ?? 0;
        let total = this.wildcards.length;
        for (const list of this.registrations.values()) total += list.length;
        return total;
    }

    /** Supprime les écouteurs d'un événement, ou tous si omis. */
    public clear(event?: keyof TEvents): void {
        if (event !== undefined) {
            this.registrations.delete(event);
            return;
        }
        this.registrations.clear();
        this.wildcards.length = 0;
    }

    /**
     * Construit la liste des exécutions à effectuer pour une émission.
     * Rationale: on travaille sur un instantané pour qu'un (dés)abonnement pendant l'émission
     * n'affecte pas la livraison en cours.
     */
    private plan<K extends keyof TEvents>(event: K, payload: TEvents[K]): Array<() => void | Promise<void>> {
        const runs: Array<() => void | Promise<void>> = [];
        const list = (this.registrations.get(event) ?? []).slice() as unknown as Registration<TEvents[K], EventListener<TEvents, K>>[];
        for (const registration of list) {
            if (!this.accepts(String(event), registration, payload)) continue;
            if (registration.once) this.remove(event, registration as unknown as Registration<never, never>);
            runs.push(() => registration.listener(payload));
        }
        if (this.wildcards.length === 0) {
            this.logger?.debug(`[events] "${String(event)}" -> ${runs.length} listener(s)`);
            return runs;
        }
        const wrapped = { name: event, payload } as AnyEvent<TEvents>;
        for (const registration of this.wildcards.slice()) {
            if (registration.once) {
                const index = this.wildcards.indexOf(registration);
                if (index !== -1) this.wildcards.splice(index, 1);
            }
            runs.push(() => registration.listener(wrapped));
        }
        this.logger?.debug(`[events] "${String(event)}" -> ${runs.length} listener(s)`);
        return runs;
    }

    private accepts<P>(eventName: string, registration: Registration<P, unknown>, payload: P): boolean {
        if (!registration.filter) return true;
        try {
            return registration.filter(payload);
        } catch (error) {
            this.onError(new EventListenerError(eventName, error));
            return false;
        }
    }

    private remove(event: keyof TEvents, registration: Registration<never, never>): void {
        const list = this.registrations.get(event);
        if (!list) return;
        const index = list.indexOf(registration);
        if (index !== -1) list.splice(index, 1);
        if (list.length === 0) this.registrations.delete(event);
    }
}
