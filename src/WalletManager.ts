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

  static async createWalletObj(gunKeyPair: GunKeyPair): Promise<WalletResult> {
    try {
      if (!gunKeyPair.pub) {
        throw new Error("Chiave pubblica mancante");
      }

      // Generiamo un salt unico usando timestamp e valore casuale
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 15);
      const salt = `${gunKeyPair.pub}_${timestamp}_${random}`;
      
      const wallet = await this.createWalletFromSalt(gunKeyPair, salt);
      
      return {
        walletObj: wallet,
        entropy: salt
      };
    } catch (error: any) {
      throw new Error(`Errore nella creazione del wallet: ${error.message}`);
    }
  }

  static async createWalletFromSalt(gunKeyPair: GunKeyPair, salt: string): Promise<Wallet> {
    try {
      const derivedKey = await SEA.work(salt, gunKeyPair);

      if (!derivedKey) {
        throw new Error("Impossibile generare la chiave derivata");
      }

      const hash = createHash('sha256')
        .update(Buffer.from(derivedKey as string, 'utf8'))
        .digest('hex');

      return new Wallet('0x' + hash);
    } catch (error: any) {
      throw new Error(`Errore nella ricreazione del wallet: ${error.message}`);
    }
  }

  static async addWallet(accountData: AccountData, walletData: WalletData): Promise<AccountData> {
    // Verifichiamo che i dati del wallet siano validi
    if (!walletData.address || !walletData.entropy || !walletData.name) {
      throw new Error("Dati del wallet non validi");
    }

    // Creiamo una copia profonda dell'oggetto accountData
    const updatedData: AccountData = JSON.parse(JSON.stringify({
      ...accountData,
      wallets: accountData.wallets || {},
      selectedWallet: accountData.selectedWallet
    }));

    // Verifichiamo che il wallet non esista già
    if (updatedData.wallets[walletData.address]) {
      throw new Error("Wallet già esistente con questo indirizzo");
    }

    // Aggiungiamo il nuovo wallet
    updatedData.wallets[walletData.address] = {
      address: walletData.address,
      entropy: walletData.entropy,
      name: walletData.name
    };
    
    // Se non c'è un wallet selezionato, selezioniamo questo
    if (!updatedData.selectedWallet) {
      updatedData.selectedWallet = walletData.address;
    }

    return updatedData;
  }

  static async setSelectedWallet(accountData: AccountData, address: string): Promise<AccountData> {
    const updatedData = {
      ...accountData,
      wallets: { ...(accountData.wallets || {}) },
      selectedWallet: accountData.selectedWallet
    };

    if (!updatedData.wallets[address]) {
      return updatedData;
    }

    updatedData.selectedWallet = address;
    return updatedData;
  }

  static getSelectedWallet(accountData: AccountData): WalletData | null {
    if (!accountData.selectedWallet || !accountData.wallets) {
      return null;
    }

    return accountData.wallets[accountData.selectedWallet] || null;
  }

  static async removeWallet(accountData: AccountData, address: string): Promise<AccountData> {
    // Verifichiamo che il wallet esista
    if (!accountData.wallets?.[address]) {
      throw new Error("Wallet non trovato");
    }

    // Creiamo una copia profonda dell'oggetto
    const updatedData: AccountData = JSON.parse(JSON.stringify({
      ...accountData,
      wallets: accountData.wallets || {},
      selectedWallet: accountData.selectedWallet
    }));

    // Verifichiamo che ci sia più di un wallet
    const walletCount = Object.keys(updatedData.wallets).length;
    if (walletCount <= 1) {
      throw new Error("Non puoi rimuovere l'ultimo wallet");
    }

    // Se era il wallet selezionato, troviamo un altro wallet prima di rimuoverlo
    if (updatedData.selectedWallet === address) {
      const remainingWallets = Object.keys(updatedData.wallets).filter(a => a !== address);
      updatedData.selectedWallet = remainingWallets.length > 0 ? remainingWallets[0] as string : null;
    }

    // Rimuoviamo il wallet
    delete updatedData.wallets[address];

    return updatedData;
  }
}
