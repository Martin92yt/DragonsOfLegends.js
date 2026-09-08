export enum LogLevel { DEBUG = "DEBUG", INFO = "INFO", WARN = "WARN", ERROR = "ERROR", FATAL = "FATAL" }
export interface LoggerOptions { context?: string; }

const Colors = { reset: "\x1b[0m", debug: "\x1b[38;5;146m", info:  "\x1b[38;5;151m", warn:  "\x1b[38;5;180m", error: "\x1b[38;5;174m", fatal: "\x1b[38;5;167m", timestamp: "\x1b[38;5;243m", context: "\x1b[38;5;250m", message: "\x1b[38;5;255m" };
export class Logger {
    private readonly context?: string;

    constructor(options: LoggerOptions = {}) { this.context = options.context; }

    private log(level: LogLevel, message: string, ...args: unknown[]): void {
        const color = this.getLevelColor(level);
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        const parts = [ `${Colors.timestamp}[${time}]${Colors.reset}`, `${color}${level.padEnd(5)}${Colors.reset}` ];
        if (this.context) parts.push(`${Colors.context}[ ${this.context} ]${Colors.reset}`);
        parts.push(`${Colors.message}${message}${Colors.reset}`);

        const output = parts.join("  ");
        switch (level) {
            case LogLevel.DEBUG: return console.debug(output, ...args);
            case LogLevel.INFO: return console.info(output, ...args);
            case LogLevel.WARN: return console.warn(output, ...args);
            case LogLevel.ERROR, LogLevel.FATAL: return console.error(output, ...args);
        }
    }

    private getLevelColor(level: LogLevel): string {
        switch (level) {
            case LogLevel.DEBUG: return Colors.debug;
            case LogLevel.INFO: return Colors.info;
            case LogLevel.WARN: return Colors.warn;
            case LogLevel.ERROR: return Colors.error;
            case LogLevel.FATAL: return Colors.fatal;
        }
    }
    
    debug(message: string, ...args: unknown[]): void { this.log(LogLevel.DEBUG, message, ...args); }
    info(message: string, ...args: unknown[]): void { this.log(LogLevel.INFO, message, ...args); }
    warn(message: string, ...args: unknown[]): void { this.log(LogLevel.WARN, message, ...args); }
    error(message: string, ...args: unknown[]): void { this.log(LogLevel.ERROR, message, ...args); }
    fatal(message: string, ...args: unknown[]): void { this.log(LogLevel.FATAL, message, ...args); }
}
