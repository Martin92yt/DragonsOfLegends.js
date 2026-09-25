import PlayerEntity from "../player/player.entity.js";
import { BankLockedError, InsufficientFundsError, InvalidAmountError } from "../types/error.js";
import { BankResult } from "../types/result.js";
import { consola } from "consola";
import World from "../world.js";

export default class BankClass {
    public readonly worldInstance: World;

    /**
     * Creates a new BankClass instance.
     *
     * @param worldInstance The world instance containing game state and players.
     * @returns void
     */
    public constructor(worldInstance: World) {
        this.worldInstance = worldInstance;
    }

    /**
     * Retrieves a player entity by their identifier.
     */
    private async getPlayerById(playerIdentifier: string): Promise<PlayerEntity | undefined> {
        const foundPlayerEntity = await this.worldInstance.players.get(playerIdentifier);
        if (!foundPlayerEntity) {
            consola.warn(`Failed to find player with identifier ${playerIdentifier} in bank system.`);
        }
        return foundPlayerEntity;
    }

    /**
     * Validates that the player's bank is unlocked and the amount is positive.
     */
    private validateTransaction(playerEntity: PlayerEntity, transactionAmount: number, actionName: string): void {
        if (!playerEntity.bankUnlocked) {
            consola.warn(`${actionName} failed: bank is locked for player ${playerEntity.name}.`);
            throw new BankLockedError();
        }

        if (transactionAmount <= 0) {
            consola.warn(`${actionName} failed for ${playerEntity.name}: invalid amount ${transactionAmount}.`);
            throw new InvalidAmountError(`${actionName} amount must be greater than 0.`);
        }
    }

    /**
     * Retrieves the partner of a player if they are married and the partner's bank is unlocked.
     */
    private async getValidPartner(playerEntity: PlayerEntity): Promise<PlayerEntity | undefined> {
        if (!playerEntity.marriage?.isMarried()) {
            return undefined;
        }

        const partnerIdentifier = playerEntity.marriage.getPartnerId();
        if (!partnerIdentifier) {
            return undefined;
        }

        const partnerPlayerEntity = await this.getPlayerById(partnerIdentifier);
        return partnerPlayerEntity && partnerPlayerEntity.bankUnlocked ? partnerPlayerEntity : undefined;
    }

    /**
     * Gets the total bank balance of the couple (or individual if not married).
     */
    public async getBalanceTotal(playerEntity: PlayerEntity): Promise<number> {
        let totalCombinedBankGold = playerEntity.bankGold;
        const validPartnerEntity = await this.getValidPartner(playerEntity);
        
        if (validPartnerEntity) {
            totalCombinedBankGold += validPartnerEntity.bankGold;
        }

        return totalCombinedBankGold;
    }

    /**
     * Deposits money from wallet to bank.
     */
    public async deposit(playerEntity: PlayerEntity, depositAmount: number): Promise<BankResult> {
        this.validateTransaction(playerEntity, depositAmount, "Deposit");

        if (playerEntity.gold < depositAmount) {
            consola.warn(`Deposit failed for ${playerEntity.name}: insufficient wallet funds (${playerEntity.gold}/${depositAmount}).`);
            throw new InsufficientFundsError("Not enough gold in wallet.");
        }

        const maxGoldLimit = this.worldInstance.initializationOptions.bankMaxGoldLimit ?? 500000;
        
        const effectiveLimit = playerEntity.marriage.isMarried() ? maxGoldLimit * 2 : maxGoldLimit;

        if (effectiveLimit !== -1 && (playerEntity.bankGold + depositAmount) > effectiveLimit) {
            consola.warn(`Deposit failed for ${playerEntity.name}: bank limit reached (Max: ${effectiveLimit}, Current: ${playerEntity.bankGold}, Trying to add: ${depositAmount}).`);
            throw new Error(`Bank gold limit reached (Maximum allowed: ${effectiveLimit}).`);
        }

        playerEntity.gold -= depositAmount;
        playerEntity.bankGold += depositAmount;

        consola.success(`${playerEntity.name} deposited ${depositAmount} gold.`);

        return { balance: await this.getBalanceTotal(playerEntity), success: true };
    }

    /**
     * Withdraws money from bank to wallet.
     */
    public async withdraw(playerEntity: PlayerEntity, withdrawalAmount: number): Promise<BankResult> {
        this.validateTransaction(playerEntity, withdrawalAmount, "Withdrawal");

        const totalBankBeforeWithdrawal = await this.getBalanceTotal(playerEntity);
        if (totalBankBeforeWithdrawal < withdrawalAmount) {
            consola.warn(`Withdrawal failed for ${playerEntity.name}: insufficient bank funds (${totalBankBeforeWithdrawal}/${withdrawalAmount}).`);
            throw new InsufficientFundsError("Not enough gold in the bank.");
        }

        let remainingAmountToWithdraw = withdrawalAmount;

        if (playerEntity.bankGold >= remainingAmountToWithdraw) {
            playerEntity.bankGold -= remainingAmountToWithdraw;
        } else {
            remainingAmountToWithdraw -= playerEntity.bankGold;
            playerEntity.bankGold = 0;

            const validPartnerEntity = await this.getValidPartner(playerEntity);
            if (validPartnerEntity) {
                validPartnerEntity.bankGold -= remainingAmountToWithdraw;
            }
        }

        playerEntity.gold += withdrawalAmount;
        const totalBankAfterWithdrawal = await this.getBalanceTotal(playerEntity);

        consola.success(`${playerEntity.name} withdrew ${withdrawalAmount} gold.`);

        return { balance: totalBankAfterWithdrawal, success: true };
    }

    /**
     * Gets the total bank balance.
     */
    public async solde(playerEntity: PlayerEntity): Promise<BankResult> {
        if (!playerEntity.bankUnlocked) {
            consola.warn(`Balance check failed: bank is locked for player ${playerEntity.name}.`);
            throw new BankLockedError();
        }

        return { balance: await this.getBalanceTotal(playerEntity), success: true };
    }

    /**
     * Unlocks the player's bank account.
     */
    public unlock(playerEntity: PlayerEntity): boolean {
        if (playerEntity.bankUnlocked) {
            consola.warn(`Bank unlock skipped: account is already unlocked for ${playerEntity.name}.`);
            return false;
        }

        const unlockCost = this.worldInstance.initializationOptions.bankUnlockCost ?? 0;

        if (unlockCost > 0) {
            if (playerEntity.gold < unlockCost) {
                consola.warn(`Failed to unlock bank for ${playerEntity.name}: insufficient gold (requires ${unlockCost}, has ${playerEntity.gold}).`);
                return false;
            }

            playerEntity.gold -= unlockCost;
            consola.success(`${playerEntity.name} paid ${unlockCost} gold to unlock their bank account.`);
        }

        playerEntity.bankUnlocked = true;
        consola.success(`Bank account unlocked for ${playerEntity.name}.`);
        return true;
    }

    /**
     * Closes the banking system and logs a success message.
     */
    public close(): void {
        consola.success("Banking system closed.");
    }
}