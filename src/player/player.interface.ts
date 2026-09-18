import { PlayerClass } from "./player.class.js";

/**
 * Represents the complete persistent data structure of a player.
 */
export interface PlayerData {
    /** The unique identifier of the player. */
    id: string;
    /** The name of the player. */
    name: string;
    /** The class identifier assigned to the player. */
    classId: PlayerClass;
    /** The current location identifier where the player resides. */
    locationId: string;
    /** The current level of the player. */
    level: number;
    /** The current experience points accumulated by the player. */
    experience: number;
    /** The current health points of the player. */
    health: number;
    /** The maximum health capacity of the player. */
    maxHealth: number;
    /** The partner identifier if the player is married, or an empty string. */
    partnerId: string;
    /** The number of unallocated attribute points available. */
    attributePoints: number;
    /** The strength attribute value. */
    strength: number;
    /** The agility attribute value. */
    agility: number;
    /** The intelligence attribute value. */
    intelligence: number;
    /** The defense attribute value. */
    defense: number;
    /** The amount of gold carried by the player. */
    gold: number;
    /** The amount of gold deposited in the bank. */
    bankGold: number;
    /** Indicates whether the player's bank account is unlocked. */
    bankUnlocked: boolean;
}

/**
 * Represents the options required to create a new player.
 */
export interface CreatePlayerOptions {
    /** The unique identifier for the new player. */
    id: string;
    /** The display name of the new player. */
    name: string;
    /** The class chosen for the new player. */
    playerClass: PlayerClass;
}

/**
 * Represents active and total counts of players in the world.
 */
export interface PlayerCount {
    /** The number of players currently active in memory. */
    active: number;
    /** The total number of registered players in the database. */
    total: number;
}

/**
 * Represents base stat allocations for a player class.
 */
export interface ClassStats {
    /** Base strength value. */
    strength: number;
    /** Base agility value. */
    agility: number;
    /** Base intelligence value. */
    intelligence: number;
    /** Base defense value. */
    defense: number;
}

/**
 * Represents a player's health points status.
 */
export interface PlayerHealth {
    /** The current health value. */
    current: number;
    /** The maximum health value. */
    max: number;
}

/**
 * Represents a player's experience points progression.
 */
export interface PlayerExperience {
    /** The current experience points accumulated towards the next level. */
    current: number;
    /** The required experience points needed to level up. */
    required: number;
}

/**
 * Represents a player's attributes and available upgrade points.
 */
export interface PlayerAttributes {
    /** The pool of unallocated attribute points. */
    points: number;
    /** The strength attribute value. */
    strength: number;
    /** The agility attribute value. */
    agility: number;
    /** The intelligence attribute value. */
    intelligence: number;
    /** The defense attribute value. */
    defense: number;
}

/**
 * Represents a point-in-time snapshot of a player's state.
 */
export interface PlayerSnapshot {
    /** The unique identifier of the player. */
    id: string;
    /** The name of the player. */
    name: string;
    /** The class identifier of the player. */
    classId: PlayerClass;
    /** The current level of the player. */
    level: number;
    /** The experience progression of the player. */
    experience: PlayerExperience;
    /** The health status of the player. */
    health: PlayerHealth;
    /** The attributes of the player. */
    attributes: PlayerAttributes;
    /** The current location identifier. */
    locationId: string;
    /** The gold carried by the player. */
    gold: number;
}

/**
 * Represents basic player record data stored in database projections.
 */
export interface PlayerRecord {
    /** The unique identifier of the player. */
    id: string;
    /** The name of the player. */
    name: string;
    /** The class identifier of the player. */
    classId: PlayerData["classId"];
    /** The current location identifier. */
    locationId: string;
    /** The gold carried by the player. */
    gold: number;
    /** The gold stored in the bank. */
    bankGold: number;
    /** Indicates whether the bank is unlocked. */
    bankUnlocked: boolean;
}

/**
 * Represents statistical progression records for a player.
 */
export interface StatsRecord {
    /** The current level. */
    level: number;
    /** The current experience points. */
    experience: number;
    /** The current health. */
    health: number;
    /** The maximum health capacity. */
    maxHealth: number;
    /** The strength attribute value. */
    strength: number;
    /** The agility attribute value. */
    agility: number;
    /** The intelligence attribute value. */
    intelligence: number;
    /** The defense attribute value. */
    defense: number;
    /** The unspent attribute points. */
    attributePoints: number;
}

/**
 * Represents a marriage association record between two players.
 */
export interface MarriageRecord {
    /** The identifier of the first player. */
    Player1: string;
    /** The identifier of the second player. */
    Player2: string;
    /** The ISO timestamp representing when the marriage started. */
    DateStart: string;
}

/**
 * Represents a generic count aggregation record from database queries.
 */
export interface CountRecord {
    /** The numerical count result. */
    count: number;
}

/**
 * Represents a table column metadata record.
 */
export interface TableColumnRecord {
    /** The name of the database table column. */
    name: string;
}