import { OFFICIAL_ENEMIES } from "../enemy/official-enemies.js";
import type { BestiarySpeciesInfo } from "./bestiary.types.js";

/**
 * Names and descriptions of the official species.
 *
 * Derived from the official enemy definitions, kept for convenience and backward compatibility:
 * the bestiary itself reads the `bestiary` entry of every registered {@link EnemyDefinition}.
 */
export const BESTIARY_SPECIES: Readonly<Record<string, BestiarySpeciesInfo>> = Object.fromEntries(
    OFFICIAL_ENEMIES.map((enemy) => [enemy.id, { name: enemy.bestiary?.name ?? enemy.name, description: enemy.bestiary?.description ?? "" }])
);

/**
 * Discovery gold of the official species (their `discoveryGold`).
 */
// Rationale: the first discovery of a species pays roughly 1.5x its normal gold reward, so exploring new monsters is
// worth more than farming known ones, and tougher species pay proportionally more (slime 10 ... ancient dragon 1000).
export const DEFAULT_DISCOVERY_GOLD: Readonly<Record<string, number>> = Object.fromEntries(
    OFFICIAL_ENEMIES.map((enemy) => [enemy.id, enemy.discoveryGold ?? 0])
);
