import { addToStacks } from "../inventory/item-stacks.js";
import type { InventoryItemRecord, Item, ItemNBT } from "../inventory/inventory.interface.js";
import { JobActionDefinition, JobActionResult, JobDefinition, JobLootResult, JobProgressState, JobProgressView, JobReward, PlayerJobsState, ToolModifiers, isToolOfJob } from "../jobs/job.types.js";
import { NO_TOOL_MODIFIERS, applyYield, effectiveCooldownMs, getMaxLevel, pickLootEntry, readToolModifiers, rollQuantity, xpRequiredForLevel } from "../jobs/job.rules.js";
import { parsePlayerJobsState } from "../jobs/job.serialization.js";
import { InvalidJobToolError, JobCooldownError, JobLevelTooLowError, JobToolRequiredError } from "../types/error.js";
import AsyncQueue from "../utils/async-queue.js";
import type PlayerEntity from "./player.entity.js";

/**
 * Jobs of a player: progression, equipped tools, cooldowns and action execution.
 *
 * Actions are serialized per player, so a cooldown cannot be bypassed by sending commands concurrently.
 */
export default class PlayerJobs {
    private readonly states = new Map<string, JobProgressState>();
    private readonly queue = new AsyncQueue();

    /**
     * Creates the jobs of a player.
     *
     * @param player The owning player.
     * @param state The saved jobs state (validated).
     * @returns void
     */
    public constructor(private readonly player: PlayerEntity, state: unknown = {}) {
        for (const [jobId, jobState] of Object.entries(parsePlayerJobsState(state))) {
            this.states.set(jobId, jobState);
        }
    }

    /**
     * Gets the level of a job (1 if never practised).
     *
     * @param jobId The job identifier.
     * @returns The job level.
     */
    public getLevel(jobId: string): number {
        return this.states.get(jobId)?.level ?? 1;
    }

    /**
     * Gets the display progress of a job.
     *
     * @param jobId The job identifier.
     * @returns The progress view.
     * @throws {UnknownJobError} If the job is not registered.
     */
    public getProgress(jobId: string): JobProgressView {
        const job = this.player.worldInstance.jobs.require(jobId);
        const state = this.states.get(jobId);
        const level = state?.level ?? 1;
        const xp = state?.xp ?? 0;
        const maxLevel = getMaxLevel(job);
        const xpToNextLevel = level >= maxLevel ? 0 : xpRequiredForLevel(job, level);

        return {
            jobId,
            name: job.name,
            level,
            maxLevel,
            xp,
            xpToNextLevel,
            percent: xpToNextLevel === 0 ? 100 : Math.floor((xp / xpToNextLevel) * 100),
            equippedToolItemId: state?.equippedToolItemId ?? ""
        };
    }

    /**
     * Gets the progress of every registered job.
     *
     * @returns The progress views.
     */
    public listProgress(): JobProgressView[] {
        return this.player.worldInstance.jobs.list().map((job) => this.getProgress(job.id));
    }

    /**
     * Gets the remaining cooldown of an action.
     *
     * @param jobId The job identifier.
     * @param actionId The action identifier.
     * @returns The remaining cooldown in milliseconds (0 if available). Tool reductions are not applied: use the tool-aware value of `perform`.
     * @throws {UnknownJobError} If the job is not registered.
     * @throws {UnknownJobActionError} If the job has no such action.
     */
    public getRemainingCooldownMs(jobId: string, actionId: string): number {
        const action = this.player.worldInstance.jobs.requireAction(jobId, actionId);
        const last = this.states.get(jobId)?.lastActionAt[actionId];
        return last === undefined ? 0 : Math.max(0, last + action.cooldownMs - Date.now());
    }

    /**
     * Gets the identifier of the equipped tool of a job.
     *
     * @param jobId The job identifier.
     * @returns The tool item identifier, or an empty string.
     */
    public getEquippedToolId(jobId: string): string {
        return this.states.get(jobId)?.equippedToolItemId ?? "";
    }

    /**
     * Equips a tool for a job (one tool per job; it replaces the previous one).
     * The tool stays in the inventory and must be a `tool` item whose data targets this job.
     *
     * @param jobId The job identifier.
     * @param itemId The tool item identifier.
     * @returns void
     * @throws {UnknownJobError} If the job is not registered.
     * @throws {InvalidJobToolError} If the item is not an owned tool for this job.
     */
    public async equipTool(jobId: string, itemId: string): Promise<void> {
        this.player.assertCanAct("jobs.equipTool");
        this.player.worldInstance.jobs.require(jobId);
        await this.queue.run(async () => {
            this.player.assertCanAct("jobs.equipTool");
            const records = await this.player.inventory.getItems();
            if (!records.some((record) => record.itemId === itemId && isToolOfJob(record, jobId))) {
                throw new InvalidJobToolError(jobId, itemId);
            }
            this.stateOf(jobId).equippedToolItemId = itemId;
            await this.player.worldInstance.players.save(this.player);
        });
        // Emitted outside the queue so a listener can call the jobs API without deadlocking.
        await this.player.worldInstance.events.emitAsync("jobToolEquip", { playerId: this.player.id, player: this.player, jobId, itemId });
    }

    /**
     * Unequips the tool of a job.
     *
     * @param jobId The job identifier.
     * @returns True if a tool was equipped.
     */
    public async unequipTool(jobId: string): Promise<boolean> {
        this.player.assertCanAct("jobs.unequipTool");
        const removedItemId = await this.queue.run(async () => {
            const state = this.states.get(jobId);
            if (!state || state.equippedToolItemId === "") return undefined;
            const previousItemId = state.equippedToolItemId;
            state.equippedToolItemId = "";
            await this.player.worldInstance.players.save(this.player);
            return previousItemId;
        });
        if (removedItemId === undefined) return false;
        await this.player.worldInstance.events.emitAsync("jobToolUnequip", { playerId: this.player.id, player: this.player, jobId, itemId: removedItemId });
        return true;
    }

    /**
     * Performs a job action (e.g. `perform("fishing", "fish")`).
     *
     * @param jobId The job identifier.
     * @param actionId The action identifier.
     * @returns The loot, experience, level-ups and rewards of the action.
     * @throws {UnknownJobError} If the job is not registered.
     * @throws {UnknownJobActionError} If the job has no such action.
     * @throws {JobLevelTooLowError} If the job level is too low for the action.
     * @throws {JobToolRequiredError} If the action requires a tool and none is equipped.
     * @throws {JobCooldownError} If the action is still on cooldown.
     * @throws {PlayerDeadError} If the player is dead.
     */
    public async perform(jobId: string, actionId: string): Promise<JobActionResult> {
        this.player.assertCanAct("jobs.perform");
        const job = this.player.worldInstance.jobs.require(jobId);
        const action = this.player.worldInstance.jobs.requireAction(jobId, actionId);
        return this.queue.run(() => {
            this.player.assertCanAct("jobs.perform"); // re-checked: the player may have died while queued
            return this.execute(job, action);
        });
    }

    /**
     * Exports the state for persistence.
     *
     * @returns A copy of the jobs state.
     */
    public toState(): PlayerJobsState {
        const state: PlayerJobsState = {};
        for (const [jobId, jobState] of this.states) {
            state[jobId] = { ...jobState, lastActionAt: { ...jobState.lastActionAt } };
        }
        return state;
    }

    private stateOf(jobId: string): JobProgressState {
        let state = this.states.get(jobId);
        if (!state) {
            state = { level: 1, xp: 0, equippedToolItemId: "", lastActionAt: {} };
            this.states.set(jobId, state);
        }
        return state;
    }

    private async execute(job: JobDefinition, action: JobActionDefinition): Promise<JobActionResult> {
        const world = this.player.worldInstance;
        const state = this.stateOf(job.id);
        const requiredLevel = action.requiredLevel ?? 1;
        if (state.level < requiredLevel) throw new JobLevelTooLowError(job.id, action.id, requiredLevel, state.level);

        const records = await this.player.inventory.getItems();
        const tool = records.find((record) => record.itemId === state.equippedToolItemId && isToolOfJob(record, job.id));
        if (state.equippedToolItemId !== "" && !tool) state.equippedToolItemId = ""; // the tool left the inventory
        if (action.requiresTool && !tool) throw new JobToolRequiredError(job.id, action.id);

        const modifiers: ToolModifiers = tool ? readToolModifiers(tool) : NO_TOOL_MODIFIERS;
        const cooldownMs = effectiveCooldownMs(action, modifiers);
        const now = Date.now();
        const last = state.lastActionAt[action.id];
        if (last !== undefined && now < last + cooldownMs) throw new JobCooldownError(job.id, action.id, last + cooldownMs - now);

        // Loot
        const eligible = action.loot.filter((entry) => (entry.minLevel ?? 1) <= state.level);
        const loot: JobLootResult[] = [];
        for (let roll = 0; roll < (action.rolls ?? 1); roll++) {
            const entry = pickLootEntry(eligible, modifiers.luck);
            if (entry) this.addLoot(loot, entry.item, applyYield(rollQuantity(entry), modifiers.yieldBonus), entry.nbt, records);
        }

        // Experience and levels
        const xpGained = Math.floor(action.xp * (1 + Math.max(modifiers.xpBonus, 0) / 100));
        const previousLevel = state.level;
        const rewards = this.applyExperience(job, state, xpGained, records);

        state.lastActionAt[action.id] = now;
        await this.player.inventory.save(records);
        await world.players.save(this.player);

        await world.events.emitAsync("jobAction", {
            playerId: this.player.id,
            player: this.player,
            jobId: job.id,
            actionId: action.id,
            xpGained,
            previousLevel,
            level: state.level,
            loot: loot.map(({ item, quantity }) => ({ itemId: item.itemId, quantity }))
        });
        for (let level = previousLevel + 1; level <= state.level; level++) {
            await world.events.emitAsync("jobLevelUp", { playerId: this.player.id, player: this.player, jobId: job.id, previousLevel: level - 1, level });
        }

        return {
            jobId: job.id,
            actionId: action.id,
            loot,
            xpGained,
            previousLevel,
            level: state.level,
            rewards,
            cooldownMs,
            nextAvailableAt: now + cooldownMs,
            toolModifiers: modifiers
        };
    }

    private applyExperience(job: JobDefinition, state: JobProgressState, xpGained: number, records: InventoryItemRecord[]): JobReward[] {
        const maxLevel = getMaxLevel(job);
        const granted: JobReward[] = [];
        let xp = state.xp + xpGained;

        while (state.level < maxLevel) {
            const required = xpRequiredForLevel(job, state.level);
            if (xp < required) break;
            xp -= required;
            state.level += 1;
            for (const levelReward of job.levelRewards ?? []) {
                if (levelReward.level !== state.level) continue;
                for (const reward of levelReward.rewards) {
                    this.grant(reward, records);
                    granted.push(reward);
                }
            }
        }

        state.xp = state.level >= maxLevel ? 0 : xp;
        return granted;
    }

    private grant(reward: JobReward, records: InventoryItemRecord[]): void {
        if (reward.kind === "gold") {
            this.player.gold += reward.amount;
            return;
        }
        this.addLoot([], reward.item, reward.quantity, reward.nbt, records);
    }

    private addLoot(loot: JobLootResult[], item: Item, quantity: number, nbt: ItemNBT | undefined, records: InventoryItemRecord[]): void {
        addToStacks(
            records,
            { ...item, playerId: this.player.id, quantity, itemNbtData: nbt ?? null, maxStack: item.maxStack ?? 64, isEquipped: false, equipmentSlot: null },
            this.player.id
        );
        loot.push({ item, quantity });
    }
}
