import { Wallet } from "ethers";
import { convertToEthPk } from "./utils";
import type { GunKeyPair, AccountData, WalletData, WalletResult } from "./types";
import { createHash } from "crypto";
import SEA from "gun/sea";

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

  static async createWalletObj(gunKeyPair: GunKeyPair, accountData?: AccountData): Promise<WalletResult> {
    try {
      // Calcoliamo l'indice del wallet in base ai wallet esistenti
      const walletIndex = accountData ? Object.keys(accountData.wallets || {}).length : 0;
      
      // Generiamo un salt deterministico basato sulla chiave pubblica e l'indice
      const salt = `${gunKeyPair.pub || ''}_${walletIndex}`;
      
      // Generiamo una chiave deterministica usando la chiave privata e il salt
      const derivedKey = await SEA.work(salt, gunKeyPair);

      if (!derivedKey) {
        throw new Error("Impossibile generare la chiave derivata");
      }

      // Generiamo una chiave privata Ethereum valida usando SHA-256
      const hash = createHash('sha256')
        .update(Buffer.from(derivedKey as string, 'utf8'))
        .digest('hex');

      // Creiamo il wallet con la chiave privata
      const wallet = new Wallet('0x' + hash);
      
      const result: WalletResult = {
        walletObj: wallet,
        entropy: salt
      };
      return result;
    } catch (error: any) {
      throw new Error(`Errore nella creazione del wallet: ${error.message}`);
    }
  }

  static async addWallet(accountData: AccountData, walletData: WalletData): Promise<AccountData> {
    if (!accountData.wallets) {
      accountData.wallets = {};
    }

    accountData.wallets[walletData.address] = walletData;
    
    if (!accountData.selectedWallet) {
      accountData.selectedWallet = walletData.address;
    }

    return accountData;
  }

  static async setSelectedWallet(accountData: AccountData, address: string): Promise<boolean> {
    if (!accountData.wallets[address]) {
      return false;
    }

    accountData.selectedWallet = address;
    return true;
  }

  static getSelectedWallet(accountData: AccountData): WalletData | null {
    if (!accountData.selectedWallet || !accountData.wallets) {
      return null;
    }

    return accountData.wallets[accountData.selectedWallet] || null;
  }

  static async removeWallet(accountData: AccountData, address: string): Promise<void> {
    if (!accountData.wallets || !accountData.wallets[address]) {
      throw new Error("Wallet non trovato");
    }

    delete accountData.wallets[address];

    if (accountData.selectedWallet === address) {
      accountData.selectedWallet = null;
    }
  }
}
