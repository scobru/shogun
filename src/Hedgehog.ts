import type { Wallet } from "ethers";
import type { StorageProvider, AccountData, AuthData } from "./types";
import { WalletManager } from "./WalletManager";
import { waitUntil } from "./utils";
import { LocalStorageProvider } from "./storage/LocalStorageProvider";
import SEA from "gun/sea";

export class Hedgehog {
  protected wallet: Wallet | null = null;
  protected ready: boolean = false;
  protected username: string | null = null;
  private storageProvider: StorageProvider;

  constructor(storageProvider?: StorageProvider) {
    this.storageProvider = storageProvider || new LocalStorageProvider();
    this.ready = true;
  }

  /**
   * Helper function to check if Hedgehog instance is ready.
   */
  isReady() {
    return this.ready;
  }

  /**
   * Helper function to wait until Hedgehog instance is ready.
   */
  async waitUntilReady() {
    await waitUntil(() => this.isReady());
  }

  /**
   * Returns if the user has a client side wallet.
   */
  isLoggedIn() {
    return !!this.wallet && !!this.username;
  }

  /**
   * Returns the current user wallet
   */
  getWallet() {
    return this.wallet;
  }

  /**
   * Login with username and password
   */
  async login(username: string, password: string): Promise<Wallet> {
    const auth = await this.storageProvider.getAuth(username);
    if (!auth) {
      throw new Error("Utente non trovato");
    }

    // Verifica la password usando la chiave pubblica come salt
    const passwordHash = await SEA.work(password, auth.keyPair.pub);
    if (auth.passwordHash !== passwordHash) {
      throw new Error("Password non valida");
    }

    const userData = await this.storageProvider.getUserData(username);
    if (!userData) {
      throw new Error("Dati utente non trovati");
    }

    const selectedWallet = WalletManager.getSelectedWallet(userData);
    if (!selectedWallet) {
      throw new Error("Nessun wallet trovato");
    }

    // Ricrea il wallet dall'entropy salvato
    this.wallet = await WalletManager.createWalletFromSalt(auth.keyPair, selectedWallet.entropy);
    this.username = username;

    return this.wallet;
  }

  /**
   * Sign up with username and password
   */
  async signUp(username: string, password: string): Promise<Wallet> {
    const existingAuth = await this.storageProvider.getAuth(username);
    if (existingAuth) {
      throw new Error("Username già in uso");
    }

    // Crea l'auth con la password
    const auth = await this.storageProvider.createAuth(username, password);

    // Crea un nuovo account con un wallet
    let accountData: AccountData = {
      username,
      wallets: {},
      selectedWallet: null
    };

    // Salva l'auth e i dati iniziali
    await this.storageProvider.setAuth(username, auth);
    await this.storageProvider.setUserData(username, accountData);

    // Crea e salva il primo wallet
    const walletResult = await WalletManager.createWalletObj(auth.keyPair, accountData);
    const walletData = {
      address: walletResult.walletObj.address,
      entropy: walletResult.entropy,
      name: "Wallet 1"
    };

    // Aggiungi il wallet e salva i dati aggiornati
    accountData = await WalletManager.addWallet(accountData, walletData);
    await this.storageProvider.setUserData(username, accountData);

    this.wallet = walletResult.walletObj;
    this.username = username;

    return this.wallet;
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    this.wallet = null;
    this.username = null;
  }
}
