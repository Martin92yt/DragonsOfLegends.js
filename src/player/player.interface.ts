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
    attributePoints: number;
    strength: number;
    agility: number;
    intelligence: number;
    defense: number;
}

export interface CreatePlayerOptions {
    id: string;
    name: string;
    playerClass: PlayerClass;
    locationId: string;
}

export interface PlayerCount { active: number; total: number; }
export interface ClassStats { strength: number; agility: number; intelligence: number; defense: number; }
export interface PlayerHealth { current: number; max: number; } 
export interface PlayerExperience { current: number; required: number; } 
export interface PlayerAttributes { points: number; strength: number; agility: number; intelligence: number; defense: number; }
export interface GainExperienceResult { amount: number; total: number; leveledUp: boolean; level: number; }

export interface PlayerSnapshot {
    id: string;
    name: string;
    classId: PlayerClass;
    level: number;
    experience: PlayerExperience;
    health: PlayerHealth;
    attributes: PlayerAttributes;
    locationId: string;
}