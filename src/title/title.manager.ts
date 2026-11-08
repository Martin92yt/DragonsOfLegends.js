import { InvalidTitleError, TitleAlreadyExistsError, UnknownTitleError } from "../types/error.js";
import Registry from "../registry/registry.js";
import { TITLE_RARITY_WEIGHTS, TitleDefinition, TitleRarity } from "./title.types.js";

/**
 * Registry of every title available in a world.
 *
 * Built on the generic {@link Registry}; `list()` returns the most prestigious titles first.
 */
export default class TitleManager extends Registry<TitleDefinition> {
    /**
     * Creates an empty title registry.
     *
     * @returns void
     */
    public constructor() {
        super({
            kind: "title",
            idOf: (definition) => definition.id,
            validate: (definition) => TitleManager.validate(definition),
            normalize: (definition) => ({ ...definition, id: definition.id.trim() }),
            errors: {
                duplicate: (id) => new TitleAlreadyExistsError(id),
                unknown: (id) => new UnknownTitleError(id)
            },
            order: (first, second) => TitleManager.compare(first, second)
        });
    }

    private static validate(definition: TitleDefinition): void {
        const titleId = definition.id.trim();
        if (titleId === "") throw new InvalidTitleError("A title identifier must not be empty.");
        if (definition.name.trim() === "") throw new InvalidTitleError(`Title "${titleId}" must have a name.`);
        if (!(definition.rarity in TITLE_RARITY_WEIGHTS)) {
            throw new InvalidTitleError(`Title "${titleId}" has an invalid rarity: ${String(definition.rarity)}.`);
        }
    }

    /**
     * Lists the titles of a rarity.
     *
     * @param rarity The rarity to filter on.
     * @returns The matching title definitions.
     */
    public listByRarity(rarity: TitleRarity): TitleDefinition[] {
        return this.list().filter((definition) => definition.rarity === rarity);
    }

    /**
     * Sorts by rarity (most prestigious first), then by name.
     *
     * @param first The first definition.
     * @param second The second definition.
     * @returns The comparison result.
     */
    public static compare(first: TitleDefinition, second: TitleDefinition): number {
        return TITLE_RARITY_WEIGHTS[second.rarity] - TITLE_RARITY_WEIGHTS[first.rarity] || first.name.localeCompare(second.name);
    }
}
