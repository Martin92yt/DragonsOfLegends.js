import Registry from "../registry/registry.js";
import { InvalidRegistryEntryError } from "../types/error.js";
import type { CropDefinition } from "./crop.types.js";

/**
 * Registry of the crops of a world (built on the generic {@link Registry}).
 */
export default class CropRegistry extends Registry<CropDefinition> {
    /**
     * Creates an empty crop registry.
     *
     * @returns void
     */
    public constructor() {
        super({ kind: "crop", idOf: (crop) => crop.id, validate: (crop) => CropRegistry.validate(crop) });
    }

    private static validate(crop: CropDefinition): void {
        const fail = (reason: string): never => {
            throw new InvalidRegistryEntryError("crop", `"${crop.id}": ${reason}`);
        };
        if (crop.id.trim() === "") throw new InvalidRegistryEntryError("crop", "the identifier must not be empty.");
        if (crop.name.trim() === "") fail("a name is required.");
        if (!Number.isFinite(crop.growTimeMs) || crop.growTimeMs <= 0) fail("growTimeMs must be a positive number.");
        if (crop.requiredLevel !== undefined && (!Number.isInteger(crop.requiredLevel) || crop.requiredLevel < 1)) fail("requiredLevel must be a positive integer.");
        if (crop.xp !== undefined && !(crop.xp >= 0)) fail("xp must be >= 0.");
        if (crop.yields.length === 0) fail("at least one yield is required.");
        for (const entry of [...crop.yields, ...(crop.seedReturn ? [crop.seedReturn] : [])]) {
            if (!Number.isInteger(entry.minQuantity) || !Number.isInteger(entry.maxQuantity) || entry.minQuantity < 0 || entry.maxQuantity < entry.minQuantity) fail("invalid yield quantities.");
        }
    }
}
