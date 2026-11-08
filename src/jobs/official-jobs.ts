import type JobManager from "./job.manager.js";
import type { JobDefinition } from "./job.types.js";
import { FISHING_JOB } from "./official/fishing.job.js";
import { MINING_JOB } from "./official/mining.job.js";
import { WOODCUTTING_JOB } from "./official/woodcutting.job.js";

export { FISHING_JOB, MINING_JOB, WOODCUTTING_JOB };

/**
 * Jobs shipped with the library (loaded when the `premadeJobs` world option is enabled).
 */
export const OFFICIAL_JOBS: readonly JobDefinition[] = [FISHING_JOB, MINING_JOB, WOODCUTTING_JOB];

/**
 * Registers the official jobs in a job registry.
 *
 * @param registry The registry to fill.
 * @returns void
 * @throws {JobAlreadyExistsError} If one of the official identifiers is already registered.
 */
export function registerOfficialJobs(registry: JobManager): void {
    registry.bulkRegister(OFFICIAL_JOBS);
}
