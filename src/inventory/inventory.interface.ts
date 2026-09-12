export interface ItemNBT {
    damageBonus?: number;
    durability?: number;
    customName?: string;
    [key: string]: unknown;
}

export interface AddItemParameters {
    type: string; // ou ItemType
    number: number;
    data?: ItemNBT;
}

export interface RemoveItemParameters {
    type: string; // ou ItemType
    number: number;
}

export interface InventoryItemRecord {
    id?: number;
    playerId: string;
    itemId: string; // Nom de la colonne en base de données
    quantity: number;
    data?: ItemNBT | null;
}