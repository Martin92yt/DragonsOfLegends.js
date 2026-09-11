export enum LogLevel { DEBUG = "DEBUG", INFO = "INFO", WARN = "WARN", ERROR = "ERROR", FATAL = "FATAL" }
export interface LoggerOptions { context?: string; }

const Colors = {
    reset: "\x1b[0m", debug: "\x1b[38;5;146m", info: "\x1b[38;5;151m",
    warn: "\x1b[38;5;180m", error: "\x1b[38;5;174m", fatal: "\x1b[38;5;167m",
    timestamp: "\x1b[38;5;243m", context: "\x1b[38;5;250m", message: "\x1b[38;5;255m"
} as const;

const LEVEL_COLORS: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: Colors.debug, [LogLevel.INFO]: Colors.info,
    [LogLevel.WARN]: Colors.warn, [LogLevel.ERROR]: Colors.error, [LogLevel.FATAL]: Colors.fatal,
};

const LOG_METHODS: Record<LogLevel, "debug" | "info" | "warn" | "error"> = {
    [LogLevel.DEBUG]: "debug", [LogLevel.INFO]: "info",
    [LogLevel.WARN]: "warn", [LogLevel.ERROR]: "error", [LogLevel.FATAL]: "error",
};

export class Logger {
    private readonly context?: string;
    constructor(options: LoggerOptions = {}) { this.context = options.context; }

    public debug(msg: string, ...args: unknown[]): void { this.log(LogLevel.DEBUG, msg, ...args); }
    public info(msg: string, ...args: unknown[]): void { this.log(LogLevel.INFO, msg, ...args); }
    public warn(msg: string, ...args: unknown[]): void { this.log(LogLevel.WARN, msg, ...args); }
    public error(msg: string, ...args: unknown[]): void { this.log(LogLevel.ERROR, msg, ...args); }
    public fatal(msg: string, ...args: unknown[]): void { this.log(LogLevel.FATAL, msg, ...args); }
    public blank(): void { console.log(""); }

    private log(level: LogLevel, message: string, ...args: unknown[]): void {
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const timeStr = `${Colors.timestamp}[${time}]${Colors.reset}`;
        const levelStr = `${LEVEL_COLORS[level]}${level.padEnd(5)}${Colors.reset}`;
        const ctxStr = this.context ? ` ${Colors.context}[ ${this.context} ]${Colors.reset}` : "";
        
        const output = `${timeStr}  ${levelStr}${ctxStr}  ${Colors.message}${message}${Colors.reset}`;
        const method = LOG_METHODS[level];

        args.length > 0 ? console[method](output, ...args) : console[method](output);
    }
}