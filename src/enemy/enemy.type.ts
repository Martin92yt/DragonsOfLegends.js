export enum EnemyType {
    Goblin = "goblin",
    Wolf = "wolf",
    Slime = "slime",
    Bandit = "bandit",
    GiantRat = "giant_rat",
    WildBoar = "wild_boar",
    Skeleton = "skeleton",
    Spider = "spider",
    Orc = "orc",
    Ghost = "ghost",
    Zombie = "zombie",
    DarkCultist = "dark_cultist",
    Troll = "troll",
    Minotaur = "minotaur",
    Vampire = "vampire",
    Witch = "witch",
    StoneGolem = "stone_golem",
    Lich = "lich",
    DemonLord = "demon_lord",
    AncientDragon = "ancient_dragon",
    Hydra = "hydra",
}

export type EnemyTypeId = `${EnemyType}`;

// Cache values in a Set to optimize validation performance from O(N) to O(1)
const VALID_ENEMY_TYPE_SET: ReadonlySet<unknown> = new Set(Object.values(EnemyType));

/**
 * Checks if an unknown value is a valid enemy type.
 *
 * @param candidateValue The value to check.
 * @returns True if the value is a valid enemy type, false otherwise.
 */
export const isEnemyType = (candidateValue: unknown): candidateValue is EnemyType => VALID_ENEMY_TYPE_SET.has(candidateValue);