import { PlayerClass } from "./player.class.js";
import type { PlayerClassDefinition } from "./player-class.definition.js";
import type PlayerClassRegistry from "./player-class.registry.js";

/**
 * Classes shipped with the library (loaded when the `premadeClasses` world option is enabled).
 */
// Rationale: each class favours one attribute (warrior strength, explorer and rogue agility) while keeping a comparable total of base points.
export const OFFICIAL_CLASSES: readonly PlayerClassDefinition[] = [
    { id: PlayerClass.Warrior, name: "Warrior", description: "A sturdy fighter relying on raw strength.", baseStats: { strength: 10, agility: 4, intelligence: 3, defense: 8 }, attackStat: "strength" },
    { id: PlayerClass.Explorer, name: "Explorer", description: "A versatile traveller, quick on their feet.", baseStats: { strength: 6, agility: 8, intelligence: 6, defense: 5 }, attackStat: "agility" },
    { id: PlayerClass.Rogue, name: "Rogue", description: "A nimble striker who never fights fair.", baseStats: { strength: 5, agility: 10, intelligence: 4, defense: 4 }, attackStat: "agility" }
];

/**
 * Registers the official classes in a class registry.
 *
 * @param registry The registry to fill.
 * @returns void
 * @throws {DuplicateRegistryEntryError} If one of the official identifiers is already registered.
 */
export function registerOfficialClasses(registry: PlayerClassRegistry): void {
    registry.bulkRegister(OFFICIAL_CLASSES);
}
