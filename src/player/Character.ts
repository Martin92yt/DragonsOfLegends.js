import { Logger } from "../utils/Logger.js";

export default class Player {
    private readonly logger = new Logger({ context: "Player" });
    constructor(public readonly id: string, public name: string) { this.logger.debug(`Player ${id} initialized.`); }
}