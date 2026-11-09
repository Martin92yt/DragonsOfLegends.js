import PlayerEntity from "../player/player.entity.js";
import AsyncQueue from "../utils/async-queue.js";
import { BankLimitReachedError, BankLockedError, InsufficientFundsError, InvalidAmountError } from "../types/error.js";
import { BankResult } from "../types/result.js";
import { consola } from "consola";
import World from "../world.js";

export default class BankClass {
    public readonly worldInstance: World;
    /** Serializes the transactions: a balance is never checked and spent by two calls at once. */
    private readonly transactions = new AsyncQueue();

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
        playerEntity.assertCanAct("bank.deposit");
        this.validateTransaction(playerEntity, depositAmount, "Deposit");

        await this.transactions.run(async () => {
            playerEntity.assertCanAct("bank.deposit"); // re-checked: the player may have died while queued
            if (playerEntity.gold < depositAmount) {
                consola.warn(`Deposit failed for ${playerEntity.name}: insufficient wallet funds (${playerEntity.gold}/${depositAmount}).`);
                throw new InsufficientFundsError("Not enough gold in wallet.");
            }

            const maxGoldLimit = this.worldInstance.initializationOptions.bankMaxGoldLimit ?? 500000;
            // Rationale: -1 means "unlimited" and must not be doubled for married players (it would become -2).
            const effectiveLimit = maxGoldLimit === -1 ? -1 : playerEntity.marriage.isMarried() ? maxGoldLimit * 2 : maxGoldLimit;

            if (effectiveLimit !== -1 && (playerEntity.bankGold + depositAmount) > effectiveLimit) {
                consola.warn(`Deposit failed for ${playerEntity.name}: bank limit reached (Max: ${effectiveLimit}, Current: ${playerEntity.bankGold}, Trying to add: ${depositAmount}).`);
                throw new BankLimitReachedError(effectiveLimit);
            }

            playerEntity.gold -= depositAmount;
            playerEntity.bankGold += depositAmount;
        });

        consola.success(`${playerEntity.name} deposited ${depositAmount} gold.`);
        await this.worldInstance.events.emitAsync("bankDeposit", {
            playerId: playerEntity.id,
            player: playerEntity,
            amount: depositAmount,
            wallet: playerEntity.gold,
            bankGold: playerEntity.bankGold
        });

        return { balance: await this.getBalanceTotal(playerEntity), success: true };
    }

    /**
     * Withdraws money from bank to wallet.
     */
    public async withdraw(playerEntity: PlayerEntity, withdrawalAmount: number): Promise<BankResult> {
        playerEntity.assertCanAct("bank.withdraw");
        this.validateTransaction(playerEntity, withdrawalAmount, "Withdrawal");

        await this.transactions.run(async () => {
            playerEntity.assertCanAct("bank.withdraw"); // re-checked: the player may have died while queued
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
        });
        const totalBankAfterWithdrawal = await this.getBalanceTotal(playerEntity);

        consola.success(`${playerEntity.name} withdrew ${withdrawalAmount} gold.`);
        await this.worldInstance.events.emitAsync("bankWithdraw", {
            playerId: playerEntity.id,
            player: playerEntity,
            amount: withdrawalAmount,
            wallet: playerEntity.gold,
            bankGold: playerEntity.bankGold
        });

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
        playerEntity.assertCanAct("bank.unlock");
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
        // Fire-and-forget: unlock is synchronous, so asynchronous listeners are not awaited.
        this.worldInstance.events.emit("bankUnlock", { playerId: playerEntity.id, player: playerEntity, cost: unlockCost });
        return true;
    }

    /**
     * Closes the banking system and logs a success message.
     */
    public close(): void {
        consola.success("Banking system closed.");
    }
}