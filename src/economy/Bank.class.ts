import PlayerEntity from "../player/player.entity.js";
import { BankLockedError, InsufficientFundsError, InvalidAmountError } from "../types/error.js";
import { BankResult } from "../types/result.js";
import { Logger } from "../utils/logger.js";
import World from "../world.js";

export default class BankClass {
    readonly #logger = new Logger({ context: "BankClass" });

    public readonly rpg: World;
    public constructor(rpg: World) { 
        this.rpg = rpg;
    }

    private getPlayerById(identifier: string): PlayerEntity | undefined {
        return this.rpg.players.get(identifier); 
    }

    /**
     * Gets the total bank balance of the couple (or individual if not married).
     */
    public getBalanceTotal(player: PlayerEntity): number {
        let total = player.bankGold;

        if (player.marriage?.isMarried()) {
            const partnerId = player.marriage.getPartnerId();
            if (partnerId) {
                const partner = this.getPlayerById(partnerId);
                if (partner && partner.bankUnlocked) {
                    total += partner.bankGold;
                }
            }
        }
        return total;
    }

    /**
     * Deposits money from wallet to bank.
     */
    public deposit(player: PlayerEntity, amount: number): BankResult {
        if (!player.bankUnlocked) {
            this.#logger.warn(`Attempt to deposit on a locked account by ${player.name}.`);
            throw new BankLockedError();
        }

        if (amount <= 0) {
            throw new InvalidAmountError("Deposit amount must be greater than 0.");
        }

        if (player.gold < amount) {
            throw new InsufficientFundsError("Not enough gold in wallet.");
        }

        const balanceBefore = player.bankGold;
        player.gold -= amount;
        player.bankGold += amount;
        const balanceAfter = player.bankGold;

        this.#logger.info(`${player.name} deposited ${amount} gold to bank (Personal Account: ${balanceBefore} -> ${balanceAfter}). Total couple balance: ${this.getBalanceTotal(player)}`);

        return { solde: this.getBalanceTotal(player), success: true };
    }
    
    /**
     * Withdraws money from bank to wallet.
     */
    public withdraw(player: PlayerEntity, amount: number): BankResult {
        if (!player.bankUnlocked) {
            this.#logger.warn(`Attempt to withdraw from a locked account by ${player.name}.`);
            throw new BankLockedError();
        }

        if (amount <= 0) {
            throw new InvalidAmountError("Withdrawal amount must be greater than 0.");
        }

        const totalBankBefore = this.getBalanceTotal(player);

        if (totalBankBefore < amount) {
            throw new InsufficientFundsError("Not enough gold in the bank.");
        }

        // Withdraw from player's account first, then from partner's account if needed
        let remainingToWithdraw = amount;
        const playerBankBefore = player.bankGold;
        let partnerBankBefore = 0;
        let partnerBankAfter = 0;
        let partner: PlayerEntity | undefined;

        if (player.bankGold >= remainingToWithdraw) {
            player.bankGold -= remainingToWithdraw;
        } else {
            remainingToWithdraw -= player.bankGold;
            player.bankGold = 0;

            if (player.marriage?.isMarried()) {
                const partnerId = player.marriage.getPartnerId();
                if (partnerId) {
                    partner = this.getPlayerById(partnerId);
                    if (partner) {
                        partnerBankBefore = partner.bankGold;
                        partner.bankGold -= remainingToWithdraw;
                        partnerBankAfter = partner.bankGold;
                    }
                }
            }
        }

        const playerBankAfter = player.bankGold;
        player.gold += amount;
        const totalBankAfter = this.getBalanceTotal(player);

        // Detailed transaction log
        if (partner && partnerBankBefore !== partnerBankAfter) {
            this.#logger.info(`${player.name} withdrew ${amount} gold. Personal Bank: (${playerBankBefore} -> ${playerBankAfter}), Partner (${partner.name}) Bank: (${partnerBankBefore} -> ${partnerBankAfter}). Total Bank: ${totalBankBefore} -> ${totalBankAfter}`);
        } else {
            this.#logger.info(`${player.name} withdrew ${amount} gold. Personal Bank: (${playerBankBefore} -> ${playerBankAfter}). Total Bank: ${totalBankBefore} -> ${totalBankAfter}`);
        }

        return { solde: totalBankAfter, success: true };
    }

    /**
     * Gets the total bank balance.
     */
    public solde(player: PlayerEntity): BankResult {
        if (!player.bankUnlocked) {
            throw new BankLockedError();
        }

        return { solde: this.getBalanceTotal(player), success: true };
    }

    /**
     * Unlocks the player's bank account.
     */
    public unlock(player: PlayerEntity): boolean {
        if (player.bankUnlocked) return false;

        player.bankUnlocked = true;
        this.#logger.info(`Bank account of ${player.name} has been unlocked.`);
        return true;
    }

    public close(): void {
        this.#logger.info("Closing the banking system.");
    }
}