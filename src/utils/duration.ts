import { InvalidDurationError } from "../types/error.js";

const UNIT_TO_MS: Readonly<Record<string, number>> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
};

const DURATION_PATTERN = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i;

/**
 * Parses a duration into milliseconds.
 *
 * @param value A number of milliseconds (>= 0) or a string such as `"500ms"`, `"30s"`, `"5m"`, `"2h"`, `"1d"`.
 * @returns The duration in milliseconds.
 * @throws {InvalidDurationError} If the value is negative, not finite or not in a supported format.
 */
export function parseDuration(value: string | number): number {
    if (typeof value === "number") {
        if (!Number.isFinite(value) || value < 0) throw new InvalidDurationError(value);
        return value;
    }

    const match = DURATION_PATTERN.exec(value.trim());
    const amount = match?.[1];
    const unit = match?.[2];
    if (amount === undefined || unit === undefined) throw new InvalidDurationError(value);
    return Math.round(Number(amount) * (UNIT_TO_MS[unit.toLowerCase()] as number));
}
