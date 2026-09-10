import { Class } from "../enums/Player.Class.js";

export interface Player {
    Name: string;
    Identifier: string;
    Class: Class;
    Level: number;
    Experience: number;
    Health: number;
    MaxHealth: number;
    AttributePoints: number;
    Strength: number;
    Agility: number;
    Intelligence: number;
    Defense: number;
}
