import LocationClass from "./location/location.class.js";
import PlayerManager from "./player/player.manager.js";
import CombatManager from "./combat/combat.manager.js";
import OfficialMap from "./location/official-map.js";
import { consola } from "consola";
import BankClass from "./economy/Bank.class.js";
import packageInfo from "../package.json" with { type: "json" };

consola.success("🐉 DragonsOfLegends.js loaded successfully!");
consola.warn("DragonsOfLegends.js is currently in development; APIs may change.");

interface WorldInitializationOptions {
    premadeMap?: boolean;
    checkUpdates?: boolean;
    
    database?: {
        adapter?: "file" | "mongodb";
        path?: string;
        uri?: string;
        name?: string
    };

    deathMode?: "hardcore" | "cooldown" | "loose";
    deathCooldown?: string;
    deathPenaltyRate?: number;

    starterGold?: number;
    starterItems?: Record<string, number>;

    bankUnlockCost?: number;
    // bankCapacitySlots?: number;
    bankMaxGoldLimit?: number;

    regen?: {
        enabled: boolean;
        rate: number; // 5 PV récupérés par tour ou par action
        cooldown: number; // ou toutes les X secondes
    }
}

export default class World {
    public readonly combat: CombatManager;
    public readonly location: LocationClass;
    public readonly bank: BankClass;
    public readonly players: PlayerManager;
    public initializationOptions: WorldInitializationOptions
    /**
     * Creates an instance of the World class and initializes game systems.
     * 
     * @param initializationOptions Configuration settings for the world initialization.
     * @returns void
     */
    public constructor(initializationOptions: WorldInitializationOptions = {}) {
        // Fusion propre des options par défaut et personnalisées
        this.initializationOptions = {
            premadeMap: true,
            checkUpdates: true,
            deathMode: "cooldown",
            deathCooldown: "1m",
            deathPenaltyRate: 5,
            starterGold: 150,
            starterItems: { health_potion: 3, rusty_sword: 1 },
            bankUnlockCost: 1000,
            bankMaxGoldLimit: 500000,
            ...initializationOptions,
            database: {
                adapter: "file",
                path: "./data.db",
                ...initializationOptions.database
            },
            regen: {
                enabled: true,
                rate: 5,
                cooldown: 10,
                ...initializationOptions.regen
            }
        };

        // Initialisation des managers et des systèmes du monde
        this.location = new LocationClass();
        this.bank = new BankClass(this);
        this.combat = new CombatManager();
        this.players = new PlayerManager(this);
        
        this.initializeWorld(this.initializationOptions);
        this.setupRegeneration();
    }

    /**
     * Configure le timer automatique de régénération des joueurs si activé.
     */
    private setupRegeneration(): void {
        const regenConfig = this.initializationOptions.regen;
        if (!regenConfig?.enabled) return;

        const regenRate = regenConfig.rate;
        const regenCooldownMs = (regenConfig.cooldown || 10) * 1000;

        const regenInterval = setInterval(() => {
            this.players.tickRegen(regenRate);
        }, regenCooldownMs);

        // Empêche l'intervalle de bloquer la fermeture du processus Node.js si besoin
        regenInterval.unref?.();
    }

    /**
     * Initializes the world systems based on provided configuration options.
     * 
     * @param options Configuration settings for world initialization.
     * @returns void
     */
    private initializeWorld(options: WorldInitializationOptions): void {
        if (options.checkUpdates) { this.checkForUpdates(); }

        if (options.premadeMap) {
            new OfficialMap(this);
            consola.success("Official map initialized.");
        }
    }

    /**
     * Checks the npm registry for package updates against the current local version.
     * 
     * @returns A promise that resolves when the update check is complete.
     */
    public async checkForUpdates(): Promise<void> {
        try {
            const { name: packageName, version: installedVersion } = packageInfo;
            const registryVersion = await this.fetchLatestVersion(packageName);

            if (!registryVersion) {
                return;
            }

            this.compareVersions(packageName, installedVersion, registryVersion);
        } catch (error) {
            consola.error("An error occurred while checking for updates.");
        }
    }

    /**
     * Fetches the latest version of the package from the npm registry.
     * 
     * @param targetPackageName The name of the package being checked.
     * @returns A promise resolving to the latest version string, or undefined if the request failed.
     */
    private async fetchLatestVersion(targetPackageName: string): Promise<string | undefined> {
        const registryResponse = await fetch(`https://registry.npmjs.org/${targetPackageName}/latest`);
        if (!registryResponse.ok) {
            consola.warn("Failed to check for updates from npm registry.");
            return undefined;
        }

        const registryData = await registryResponse.json() as { version: string };
        return registryData.version;
    }

    /**
     * Compares the current local version with the latest registry version and logs the outcome.
     * 
     * @param targetPackageName The name of the package.
     * @param installedVersion The local version currently installed.
     * @param registryVersion The latest version retrieved from the npm registry.
     * @returns void
     */
    private compareVersions(targetPackageName: string, installedVersion: string, registryVersion: string): void {
        if (registryVersion !== installedVersion) {
            consola.warn(`A new version of ${targetPackageName} is available: ${registryVersion} (currently installed: ${installedVersion})`);
        } else {
            consola.info("Package is up to date.");
        }
    }

    /**
     * Quickly saves the world state, stops active systems, and closes down the environment.
     * 
     * @returns A promise that resolves when the world shutdown sequence is complete.
     */
    public async quick(): Promise<void> {
        this.combat.stopAllCombats();
        this.bank.close();
        await this.players.saveAll();
        consola.info("World state successfully saved and closed.");
    }
}