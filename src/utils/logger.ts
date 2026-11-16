import { consola, type ConsolaInstance } from "consola";

/**
 * Verbosity of the library logs.
 *
 * - `silent`: nothing.
 * - `minimal`: only what needs attention (warnings and errors).
 * - `normal`: also the success and information messages (default).
 * - `verbose`: also the debug messages.
 */
export type LogMode = "silent" | "minimal" | "normal" | "verbose";

/** Every log mode, from the quietest to the most talkative. */
export const LOG_MODES: readonly LogMode[] = ["silent", "minimal", "normal", "verbose"];

/** Root tag shared by every message of the library (`[DoL:bank]`, `[DoL:combat]`...). */
export const LOG_ROOT_TAG = "DoL";

/** Name of the environment variable that selects the log mode. */
export const LOG_MODE_ENV = "DOL_LOG_MODE";

/** Command-line flag equivalent to `DOL_LOG_MODE=minimal`. */
export const MINIMAL_LOGS_FLAG = "--minimal-logs";

type LogMethod = "error" | "warn" | "success" | "info" | "debug";

// Rationale: each method has a rank; a mode shows every method whose rank does not exceed its threshold.
const METHOD_RANK: Readonly<Record<LogMethod, number>> = { error: 0, warn: 1, success: 2, info: 2, debug: 3 };
const MODE_THRESHOLD: Readonly<Record<LogMode, number>> = { silent: -1, minimal: 1, normal: 2, verbose: 3 };

/**
 * Checks whether a value is a log mode.
 *
 * @param value The value to check.
 * @returns True if it is one of {@link LOG_MODES}.
 */
export function isLogMode(value: unknown): value is LogMode {
    return typeof value === "string" && (LOG_MODES as readonly string[]).includes(value);
}

/**
 * Reads the initial log mode from the environment (`DOL_LOG_MODE`) or the `--minimal-logs` command-line flag.
 *
 * @returns The requested mode, `normal` when nothing is set.
 */
function resolveInitialMode(): LogMode {
    const fromEnvironment = process.env[LOG_MODE_ENV]?.trim().toLowerCase();
    if (isLogMode(fromEnvironment)) return fromEnvironment;
    return process.argv.includes(MINIMAL_LOGS_FLAG) ? "minimal" : "normal";
}

let currentMode: LogMode = resolveInitialMode();

/**
 * Sets the log mode of the whole library (the setting is process-wide, like the logger it drives).
 *
 * @param mode The new mode.
 * @returns void
 */
export function setLogMode(mode: LogMode): void {
    currentMode = mode;
}

/**
 * Gets the current log mode.
 *
 * @returns The mode.
 */
export function getLogMode(): LogMode {
    return currentMode;
}

/**
 * A logger whose messages carry a `[DoL:<tag>]` tag and obey the library log mode.
 */
export interface TaggedLogger {
    /** The full tag (`DoL:bank`). */
    readonly tag: string;
    error(message: unknown, ...details: unknown[]): void;
    warn(message: unknown, ...details: unknown[]): void;
    success(message: unknown, ...details: unknown[]): void;
    info(message: unknown, ...details: unknown[]): void;
    debug(message: unknown, ...details: unknown[]): void;
}

const loggers = new Map<string, TaggedLogger>();

/**
 * Gets the logger of a module of the library. The tagged `consola` instance is created on first use, so it inherits the
 * reporters configured on the global `consola`; the library filters by log mode itself.
 *
 * @param scope The module name (`"bank"`, `"combat"`...). The result is cached: the same scope always returns the same logger.
 * @returns The tagged logger.
 */
export function createLogger(scope: string): TaggedLogger {
    const existing = loggers.get(scope);
    if (existing) return existing;

    const tag = `${LOG_ROOT_TAG}:${scope}`;
    let sink: ConsolaInstance | undefined;
    const emit = (method: LogMethod, message: unknown, details: unknown[]): void => {
        if (METHOD_RANK[method] > MODE_THRESHOLD[currentMode]) return;
        if (!sink) {
            sink = consola.withTag(tag);
            sink.level = Number.POSITIVE_INFINITY; // the log mode already decided: do not filter twice
        }
        sink[method](message, ...details);
    };

    const logger: TaggedLogger = {
        tag,
        error: (message, ...details) => emit("error", message, details),
        warn: (message, ...details) => emit("warn", message, details),
        success: (message, ...details) => emit("success", message, details),
        info: (message, ...details) => emit("info", message, details),
        debug: (message, ...details) => emit("debug", message, details)
    };
    loggers.set(scope, logger);
    return logger;
}
