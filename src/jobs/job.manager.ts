import { InvalidJobError, JobAlreadyExistsError, UnknownJobActionError, UnknownJobError } from "../types/error.js";
import Registry from "../registry/registry.js";
import { getMaxLevel } from "./job.rules.js";
import type { JobActionDefinition, JobDefinition } from "./job.types.js";

/**
 * Registry of every job available in a world.
 *
 * Built on the generic {@link Registry}: jobs are never hard-coded, the official ones are a content pack
 * and third parties register theirs the same way (`register`, `bulkRegister`, `{ override: true }`...).
 */
export default class JobManager extends Registry<JobDefinition> {
    /**
     * Creates an empty job registry.
     *
     * @returns void
     */
    public constructor() {
        super({
            kind: "job",
            idOf: (definition) => definition.id,
            validate: (definition) => JobManager.validate(definition),
            errors: {
                duplicate: (id) => new JobAlreadyExistsError(id),
                unknown: (id) => new UnknownJobError(id)
            }
        });
    }

    /**
     * Gets an action of a job or fails.
     *
     * @param jobId The job identifier.
     * @param actionId The action identifier.
     * @returns The action definition.
     * @throws {UnknownJobError} If the job is not registered.
     * @throws {UnknownJobActionError} If the job has no such action.
     */
    public requireAction(jobId: string, actionId: string): JobActionDefinition {
        const action = this.require(jobId).actions.find((candidate) => candidate.id === actionId);
        if (!action) throw new UnknownJobActionError(jobId, actionId);
        return action;
    }

    private static validate(definition: JobDefinition): void {
        const fail = (message: string): never => {
            throw new InvalidJobError(`Job "${definition.id}": ${message}`);
        };
        if (definition.id.trim() === "") throw new InvalidJobError("A job identifier must not be empty.");
        if (definition.name.trim() === "") fail("a name is required.");

        const maxLevel = getMaxLevel(definition);
        if (!Number.isInteger(maxLevel) || maxLevel < 1) fail("maxLevel must be a positive integer.");
        if (definition.xpCurve && (!(definition.xpCurve.base > 0) || !(definition.xpCurve.growth >= 1))) {
            fail("xpCurve requires base > 0 and growth >= 1.");
        }
        if (definition.actions.length === 0) fail("at least one action is required.");

        const actionIds = new Set<string>();
        for (const action of definition.actions) {
            if (action.id.trim() === "" || actionIds.has(action.id)) fail(`invalid or duplicate action id "${action.id}".`);
            actionIds.add(action.id);
            if (!(action.cooldownMs >= 0) || !(action.xp >= 0)) fail(`action "${action.id}" needs cooldownMs >= 0 and xp >= 0.`);
            if (action.requiredLevel !== undefined && (!Number.isInteger(action.requiredLevel) || action.requiredLevel < 1 || action.requiredLevel > maxLevel)) {
                fail(`action "${action.id}" has an invalid requiredLevel.`);
            }
            if (action.rolls !== undefined && (!Number.isInteger(action.rolls) || action.rolls < 1)) fail(`action "${action.id}" has invalid rolls.`);
            if (action.loot.length === 0) fail(`action "${action.id}" needs at least one loot entry.`);
            for (const entry of action.loot) {
                const validQuantities = Number.isInteger(entry.minQuantity) && Number.isInteger(entry.maxQuantity) && entry.minQuantity >= 1 && entry.maxQuantity >= entry.minQuantity;
                if (!(entry.weight > 0) || !validQuantities) fail(`action "${action.id}" has an invalid loot entry "${entry.item.itemId}".`);
            }
        }

        for (const reward of definition.levelRewards ?? []) {
            if (!Number.isInteger(reward.level) || reward.level < 2 || reward.level > maxLevel) fail(`level reward at ${reward.level} must be between 2 and ${maxLevel}.`);
        }
    }
}
