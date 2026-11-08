import { InvalidRegistryEntryError } from "../types/error.js";
import Registry from "../registry/registry.js";
import { ItemCategory, ItemRarity } from "./item.enum.js";
import type { Item } from "./inventory.interface.js";

const CATEGORIES: ReadonlySet<string> = new Set(Object.values(ItemCategory));
const RARITIES: ReadonlySet<string> = new Set(Object.values(ItemRarity));

/**
 * Registry of the item catalogue of a world.
 *
 * Items are identified by their `itemId`. Registering an item makes it resolvable by identifier
 * (e.g. for the `starterItems` option) without embedding the full definition everywhere.
 */
export default class ItemRegistry extends Registry<Item> {
    /**
     * Creates an empty item registry.
     *
     * @returns void
     */
    public constructor() {
        super({
            kind: "item",
            idOf: (item) => item.itemId,
            validate: (item) => ItemRegistry.validate(item)
        });
    }

    /**
     * Lists the items of a category.
     *
     * @param category The category.
     * @returns The matching items.
     */
    public listByCategory(category: ItemCategory): Array<Readonly<Item>> {
        return this.filter((item) => item.category === category);
    }

    private static validate(item: Item): void {
        const fail = (reason: string): never => {
            throw new InvalidRegistryEntryError("item", `"${item.itemId}": ${reason}`);
        };
        if (item.itemId.trim() === "") throw new InvalidRegistryEntryError("item", "the identifier must not be empty.");
        if (item.name.trim() === "") fail("a name is required.");
        if (!CATEGORIES.has(item.category)) fail(`unknown category "${String(item.category)}".`);
        if (!RARITIES.has(item.rarity)) fail(`unknown rarity "${String(item.rarity)}".`);
        if (item.maxStack !== undefined && (!Number.isInteger(item.maxStack) || item.maxStack < 1)) fail("maxStack must be a positive integer.");
    }
}
