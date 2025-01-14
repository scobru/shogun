import { Wallet } from "ethers";
import { convertToEthPk } from "./utils";
import type { GunKeyPair, AccountData, WalletData, WalletResult } from "./types";

export class WalletManager {
  static async createWalletFromGunKeyPair(keyPair: GunKeyPair): Promise<Wallet> {
    try {
      const ethPrivateKey = await convertToEthPk(keyPair.priv);
      return new Wallet(ethPrivateKey);
    } catch (error) {
      console.error("Errore nella creazione del wallet:", error);
      throw error;
    }
  }

  static async createWalletObj(keyPair: GunKeyPair): Promise<WalletResult | Error> {
    try {
      const wallet = await this.createWalletFromGunKeyPair(keyPair);
      return {
        walletObj: wallet,
        entropy: keyPair.priv
      };
    } catch (error) {
      return error as Error;
    }
  }

  static async addWallet(accountData: AccountData, walletData: WalletData): Promise<AccountData> {
    return {
      ...accountData,
      wallets: {
        ...accountData.wallets,
        [walletData.address]: walletData
      }
    };
  }

  static async setSelectedWallet(accountData: AccountData, address: string): Promise<boolean> {
    if (!accountData.wallets[address]) {
      return false;
    }

    accountData.selectedWallet = address;
    return true;
  }

  static getSelectedWallet(accountData: AccountData): WalletData | null {
    if (!accountData.selectedWallet || !accountData.wallets[accountData.selectedWallet]) {
      return null;
    }

    return accountData.wallets[accountData.selectedWallet];
  }

  static async removeWallet(accountData: AccountData, address: string): Promise<void> {
    if (!accountData.wallets[address]) {
      return;
    }

    const { [address]: _, ...remainingWallets } = accountData.wallets;
    accountData.wallets = remainingWallets;

    if (accountData.selectedWallet === address) {
      accountData.selectedWallet = null;
    }
  }
}
