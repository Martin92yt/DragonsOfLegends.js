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

export const isEnemyType = (value: string): value is EnemyType => 
    Object.values(EnemyType).includes(value as EnemyType);