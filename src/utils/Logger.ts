export enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
    FATAL = "FATAL"
}

export interface LoggerOptions {
    context?: string;
    enabled?: boolean;
}

const Colors = {
    reset: "\x1b[0m",
    debug: "\x1b[38;5;146m",
    info: "\x1b[38;5;151m",
    warn: "\x1b[38;5;180m",
    error: "\x1b[38;5;174m",
    fatal: "\x1b[38;5;167m",
    timestamp: "\x1b[38;5;243m",
    context: "\x1b[38;5;250m",
    message: "\x1b[38;5;255m"
} as const;

const LEVEL_COLORS: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: Colors.debug,
    [LogLevel.INFO]: Colors.info,
    [LogLevel.WARN]: Colors.warn,
    [LogLevel.ERROR]: Colors.error,
    [LogLevel.FATAL]: Colors.fatal
};

const LOG_METHODS: Record<LogLevel, (message?: unknown, ...args: unknown[]) => void> = {
    [LogLevel.DEBUG]: console.debug,
    [LogLevel.INFO]: console.info,
    [LogLevel.WARN]: console.warn,
    [LogLevel.ERROR]: console.error,
    [LogLevel.FATAL]: console.error
};

export class Logger {
    private readonly context?: string;
    private readonly enabled: boolean;

    /**
     * Creates a new logger instance.
     *
     * @param options Logger configuration options.
     */
    public constructor(options: LoggerOptions = {}) {
        this.context = options.context;
        this.enabled = options.enabled ?? true;
    }

    /**
     * Logs a debug message.
     *
     * @param message Message to log.
     * @param args Additional values to display.
     */
    public debug(message: string, ...args: unknown[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    /**
     * Logs an informational message.
     *
     * @param message Message to log.
     * @param args Additional values to display.
     */
    public info(message: string, ...args: unknown[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    /**
     * Logs a warning message.
     *
     * @param message Message to log.
     * @param args Additional values to display.
     */
    public warn(message: string, ...args: unknown[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    /**
     * Logs an error message.
     *
     * @param message Message to log.
     * @param args Additional values to display.
     */
    public error(message: string, ...args: unknown[]): void {
        this.log(LogLevel.ERROR, message, ...args);
    }

    /**
     * Logs a fatal error message.
     *
     * @param message Message to log.
     * @param args Additional values to display.
     */
    public fatal(message: string, ...args: unknown[]): void {
        this.log(LogLevel.FATAL, message, ...args);
    }

    /**
     * Prints an empty line when logging is enabled.
     *
     * @returns Nothing.
     */
    public blank(): void {
        if (this.enabled) {
            console.log("");
        }
    }

    /**
     * Logs a message at the specified level.
     *
     * @param level Log level.
     * @param message Message to log.
     * @param args Additional values to display.
     * @returns Nothing.
     */
    private log(level: LogLevel, message: string, ...args: unknown[]): void {
        if (!this.enabled) {
            return;
        }

        if (level === LogLevel.DEBUG && process.env.ENVIRONMENT !== "debug") {
            return;
        }

        const time = new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        const timestamp = `${Colors.timestamp}[${time}]${Colors.reset}`;
        const levelLabel = `${LEVEL_COLORS[level]}${level.padEnd(5)}${Colors.reset}`;
        const context = this.context ? ` ${Colors.context}[${this.context}]${Colors.reset}` : "";
        const output = `${timestamp} ${levelLabel}${context} — ${Colors.message}${message}${Colors.reset}`;
        const logMethod = LOG_METHODS[level];

        logMethod(output, ...args);
    }
}
