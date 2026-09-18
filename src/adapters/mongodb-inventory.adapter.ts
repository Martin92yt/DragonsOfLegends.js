import { consola } from "consola";
import { MongoClient, Collection, Db } from "mongodb";
import { InventoryEntity } from "../inventory/inventory.class.js";
import { EquipmentRecord, InventoryItemRecord } from "../inventory/inventory.interface.js";
import { EquipmentSlot, ItemCategory, ItemRarity, VALID_EQUIPMENT_SLOTS } from "../inventory/item.enum.js";

interface MongoInventoryDocument {
    playerId: string;
    itemId: string;
    quantity: number;
    itemNbtData: any | null;
    name: string;
    category: string;
    rarity: string;
    maxStack: number;
    description: string | null;
    isEquipped: boolean;
    equipmentSlot: string | null;
}

type EquipmentKey = Exclude<keyof EquipmentRecord, "playerId">;

export default class MongoInventoryAdapter {
    private client!: MongoClient;
    private db!: Db;
    private inventoryCollection!: Collection<MongoInventoryDocument>;
    private isConnected: boolean = false;
    private initPromise: Promise<void>; // 🛡️ Permet d'attendre la connexion

    private static readonly VALID_CATEGORIES = new Set<string>(Object.values(ItemCategory));
    private static readonly VALID_RARITIES = new Set<string>(Object.values(ItemRarity));
    private static readonly VALID_SLOTS = new Set<string>(VALID_EQUIPMENT_SLOTS);

    public constructor(inventory: InventoryEntity, customUri?: string) {
        const uri = customUri || inventory.playerEntityReference.worldInstance.initializationOptions.database?.uri || "mongodb://localhost:27017";
        const dbName = inventory.playerEntityReference.worldInstance.initializationOptions.database?.name || "dragons_of_legends";

        this.client = new MongoClient(uri);
        this.initPromise = this.initConnection(dbName); // 🛡️ On stocke la promesse
    }

    private async initConnection(dbName: string): Promise<void> {
        try {
            await this.client.connect();
            this.db = this.client.db(dbName);
            this.inventoryCollection = this.db.collection<MongoInventoryDocument>("inventory");
            this.isConnected = true;
            consola.success("MongoDB inventory database initialized.");
        } catch (error) {
            consola.error("Failed to initialize MongoDB inventory database:", error);
            throw error;
        }
    }

    /**
     * Sécurité : Attend que la connexion MongoDB soit effective avant toute requête
     */
    private async ensureConnection(): Promise<void> {
        if (!this.isConnected) {
            await this.initPromise;
        }
    }

    public async getPlayerInventory(playerId: string): Promise<InventoryItemRecord[]> {
        try {
            await this.ensureConnection(); // 🛡️ On s'assure que la co est prête
            const documents = await this.inventoryCollection.find({ playerId }).toArray();
            return documents.map(doc => this.mapDocumentToInventoryItem(doc));
        } catch (error) {
            consola.error(`Failed to retrieve inventory for player ${playerId} from MongoDB:`, error);
            return [];
        }
    }

    public async savePlayerInventory(playerId: string, inventoryItems: InventoryItemRecord[]): Promise<void> {
        try {
            await this.ensureConnection();
            await this.inventoryCollection.deleteMany({ playerId });

            if (inventoryItems.length === 0) {
                return;
            }

            const documentsToInsert: MongoInventoryDocument[] = [];

            for (const itemRecord of inventoryItems) {
                if (!itemRecord.itemId || itemRecord.quantity <= 0) {
                    consola.warn(`Skipping invalid inventory item for player ${playerId}: ${itemRecord.itemId}`);
                    continue;
                }

                documentsToInsert.push({
                    playerId,
                    itemId: itemRecord.itemId,
                    quantity: itemRecord.quantity,
                    itemNbtData: itemRecord.itemNbtData ?? null,
                    name: itemRecord.name || "Unknown Item",
                    category: itemRecord.category || ItemCategory.Valuables,
                    rarity: itemRecord.rarity || ItemRarity.Common,
                    maxStack: itemRecord.maxStack ?? 64,
                    description: itemRecord.description ?? null,
                    isEquipped: !!itemRecord.isEquipped,
                    equipmentSlot: itemRecord.equipmentSlot ?? null
                });
            }

            if (documentsToInsert.length > 0) {
                await this.inventoryCollection.insertMany(documentsToInsert);
            }
        } catch (error) {
            consola.error(`Failed to save inventory for player ${playerId} in MongoDB:`, error);
            throw error;
        }
    }

    public async clearInventory(playerId: string): Promise<boolean> {
        try {
            await this.ensureConnection();
            const result = await this.inventoryCollection.deleteMany({ playerId });
            return (result.deletedCount ?? 0) > 0;
        } catch (error) {
            consola.error(`Failed to clear inventory for player ${playerId} in MongoDB:`, error);
            return false;
        }
    }

    public async getPlayerEquipment(playerId: string): Promise<EquipmentRecord> {
        const playerEquipmentRecord: EquipmentRecord = {
            playerId,
            helmetItemId: null,
            chestItemId: null,
            leggingsItemId: null,
            bootsItemId: null,
            swordItemId: null,
            shieldItemId: null,
            amuletOneItemId: null,
            amuletTwoItemId: null,
            amuletThreeItemId: null
        };

        try {
            await this.ensureConnection();
            const equippedDocuments = await this.inventoryCollection.find({
                playerId,
                isEquipped: true,
                equipmentSlot: { $ne: null }
            }).toArray();

            for (const doc of equippedDocuments) {
                if (doc.equipmentSlot && MongoInventoryAdapter.VALID_SLOTS.has(doc.equipmentSlot)) {
                    playerEquipmentRecord[doc.equipmentSlot as EquipmentKey] = doc.itemId;
                }
            }
        } catch (error) {
            consola.error(`Failed to retrieve equipment for player ${playerId} from MongoDB:`, error);
        }

        return playerEquipmentRecord;
    }

    public async save(): Promise<void> {
        // MongoDB gère l'écriture en continu
    }

    public async saveAndClose(): Promise<void> {
        if (!this.isConnected) {
            return;
        }

        try {
            await this.initPromise;
            await this.client.close();
            this.isConnected = false;
            consola.success("MongoDB inventory database closed.");
        } catch (error) {
            consola.error("Error while closing MongoDB inventory database:", error);
        }
    }

    private mapDocumentToInventoryItem(doc: MongoInventoryDocument): InventoryItemRecord {
        return {
            playerId: doc.playerId,
            itemId: doc.itemId,
            quantity: doc.quantity,
            itemNbtData: doc.itemNbtData ?? null,
            name: doc.name || "Unknown Item",
            category: this.parseCategory(doc.category),
            rarity: this.parseRarity(doc.rarity),
            maxStack: doc.maxStack,
            description: doc.description ?? undefined,
            isEquipped: !!doc.isEquipped,
            equipmentSlot: this.parseEquipmentSlot(doc.equipmentSlot)
        };
    }

    private parseCategory(categoryValue: string): ItemCategory {
        if (MongoInventoryAdapter.VALID_CATEGORIES.has(categoryValue)) {
            return categoryValue as ItemCategory;
        }
        consola.warn(`Unknown item category encountered: ${categoryValue}. Falling back to valuables.`);
        return ItemCategory.Valuables;
    }

    private parseRarity(categoryValue: string): ItemRarity {
        if (MongoInventoryAdapter.VALID_RARITIES.has(categoryValue)) {
            return categoryValue as ItemRarity;
        }
        consola.warn(`Unknown item rarity encountered: ${categoryValue}. Falling back to common.`);
        return ItemRarity.Common;
    }

    private parseEquipmentSlot(slotValue: string | null): EquipmentSlot | null {
        if (!slotValue) return null;
        if (MongoInventoryAdapter.VALID_SLOTS.has(slotValue)) {
            return slotValue as EquipmentSlot;
        }
        consola.warn(`Unknown equipment slot encountered: ${slotValue}.`);
        return null;
    }
}