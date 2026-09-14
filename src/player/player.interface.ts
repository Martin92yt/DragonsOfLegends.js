import { PlayerClass } from "./player.class.js";

export interface PlayerData {
    id: string;
    name: string;
    classId: PlayerClass;
    locationId: string;
    level: number;
    experience: number;
    health: number;
    maxHealth: number;
    partener: string;
    attributePoints: number;
    strength: number;
    agility: number;
    intelligence: number;
    defense: number;
    gold: number;
    bankGold: number;
    bankUnlocked: boolean;
}

export interface CreatePlayerOptions {
    id: string;
    name: string;
    playerClass: PlayerClass;
    locationId: string;
}

export interface PlayerCount {
    active: number;
    total: number;
}

export interface ClassStats {
    strength: number;
    agility: number;
    intelligence: number;
    defense: number;
}

export interface PlayerHealth {
    current: number;
    max: number;
}

export interface PlayerExperience {
    current: number;
    required: number;
}

export interface PlayerAttributes {
    points: number;
    strength: number;
    agility: number;
    intelligence: number;
    defense: number;
}

export interface PlayerSnapshot {
    id: string;
    name: string;
    classId: PlayerClass;
    level: number;
    experience: PlayerExperience;
    health: PlayerHealth;
    attributes: PlayerAttributes;
    locationId: string;
    gold: number;
}

export interface PlayerRecord {
    id: string;
    name: string;
    classId: PlayerData["classId"];
    locationId: string;
    gold: number;
    bankGold: number;
    bankUnlocked: boolean;
}

export interface StatsRecord {
    level: number;
    experience: number;
    health: number;
    maxHealth: number;
    strength: number;
    agility: number;
    intelligence: number;
    defense: number;
    attributePoints: number;
}

export interface MarriageRecord {
    Player1: string;
    Player2: string;
    DateStart: string;
}

export interface CountRecord {
    count: number;
}

export interface TableColumnRecord {
    name: string;
}