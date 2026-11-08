import {
    ACHIEVEMENT_SNAPSHOT_VERSION,
    AchievementDump,
    AchievementSerializationError,
    PlayerAchievementSnapshot,
    PlayerAchievementState
} from "./achievement.types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseState(raw: unknown, path: string): PlayerAchievementState {
    if (!isRecord(raw)) throw new AchievementSerializationError(`${path}: expected an object.`);
    const { progress, unlockedAt, rewardsGranted } = raw;
    if (!isRecord(progress)) throw new AchievementSerializationError(`${path}.progress: expected an object.`);

    const cleanProgress: Record<string, number> = {};
    for (const [criterionId, value] of Object.entries(progress)) {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
            throw new AchievementSerializationError(`${path}.progress.${criterionId}: expected a non-negative number.`);
        }
        cleanProgress[criterionId] = value;
    }
    if (unlockedAt !== null && (typeof unlockedAt !== "number" || !Number.isFinite(unlockedAt))) {
        throw new AchievementSerializationError(`${path}.unlockedAt: expected a number or null.`);
    }
    if (typeof rewardsGranted !== "boolean") {
        throw new AchievementSerializationError(`${path}.rewardsGranted: expected a boolean.`);
    }
    return { progress: cleanProgress, unlockedAt, rewardsGranted };
}

/**
 * Valide une sauvegarde joueur inconnue (JSON.parse, base de données…).
 *
 * @param raw - Valeur à valider.
 * @returns Snapshot typé.
 * @throws {@link AchievementSerializationError} si la structure ou la version est invalide.
 */
export function parsePlayerSnapshot(raw: unknown): PlayerAchievementSnapshot {
    if (!isRecord(raw)) throw new AchievementSerializationError("Snapshot: expected an object.");
    if (raw.version !== ACHIEVEMENT_SNAPSHOT_VERSION) {
        throw new AchievementSerializationError(`Unsupported snapshot version: ${String(raw.version)}.`);
    }
    if (typeof raw.playerId !== "string" || raw.playerId === "") {
        throw new AchievementSerializationError("Snapshot.playerId: expected a non-empty string.");
    }
    if (!isRecord(raw.achievements)) throw new AchievementSerializationError("Snapshot.achievements: expected an object.");

    const achievements: Record<string, PlayerAchievementState> = {};
    for (const [id, state] of Object.entries(raw.achievements)) {
        achievements[id] = parseState(state, `achievements.${id}`);
    }
    return { version: ACHIEVEMENT_SNAPSHOT_VERSION, playerId: raw.playerId, achievements };
}

/**
 * Valide une sauvegarde multi-joueurs inconnue.
 *
 * @throws {@link AchievementSerializationError} si la structure ou la version est invalide.
 */
export function parseDump(raw: unknown): AchievementDump {
    if (!isRecord(raw) || raw.version !== ACHIEVEMENT_SNAPSHOT_VERSION || !Array.isArray(raw.players)) {
        throw new AchievementSerializationError("Dump: expected { version: 1, players: [...] }.");
    }
    return { version: ACHIEVEMENT_SNAPSHOT_VERSION, players: raw.players.map((player: unknown) => parsePlayerSnapshot(player)) };
}
