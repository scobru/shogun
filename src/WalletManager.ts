/**
 * @fileoverview Manages wallet functionality, including authentication and key management
 * @module WalletManager
 */

import Gun from "gun";
import "gun/sea";
import { Wallet } from "ethers";
import { EthereumManager } from "./EthereumManager";
import { StealthChain } from "./StealthChain";
import type { GunKeyPair } from "./interfaces/GunKeyPair";
import { WalletResult, WalletData } from "./interfaces/WalletResult";

// Importiamo crypto condizionalmente
let cryptoModule: any;
try {
  cryptoModule = require("crypto");
} catch {
  cryptoModule = null;
}

// Extend Gun type definitions
declare module "gun" {
  interface _GunRoot {
    sea: GunKeyPair;
  }
}

const SEA = Gun.SEA;

enum StorageType {
  GUN,
  LOCAL,
  BOTH,
}

// Aggiungiamo un mock di localStorage per Node.js
const getLocalStorage = () => {
  if (typeof localStorage === "undefined") {
    const store: { [key: string]: string } = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((key) => delete store[key]);
      },
    };
  }
  return localStorage;
};

/**
 * Helper class for managing local storage operations
 */
class LocalStorageManager {
  static async saveWallet(wallet: Wallet, publicKey: string): Promise<void> {
    const storage = getLocalStorage();
    const walletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      entropy: (wallet as any).entropy || null,
    };
    storage.setItem(`wallet_${publicKey}`, JSON.stringify(walletData));
  }

  static async retrieveWallet(publicKey: string): Promise<Wallet | null> {
    const storage = getLocalStorage();
    const walletData = storage.getItem(`wallet_${publicKey}`);
    if (!walletData) return null;
    try {
      const parsed = JSON.parse(walletData);
      // Creiamo un nuovo wallet con la chiave privata
      const wallet = new Wallet(parsed.privateKey);
      // Aggiungiamo l'entropy se presente
      if (parsed.entropy) {
        Object.defineProperty(wallet, "entropy", {
          value: parsed.entropy,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
      return wallet;
    } catch (error) {
      console.error("Error retrieving local wallet:", error);
      return null;
    }
  }

  static async checkData(publicKey: string): Promise<{
    hasWallet: boolean;
    hasStealthKeys: boolean;
    hasPasskey: boolean;
  }> {
    const storage = getLocalStorage();
    return {
      hasWallet: storage.getItem(`wallet_${publicKey}`) !== null,
      hasStealthKeys: storage.getItem(`stealthKeys_${publicKey}`) !== null,
      hasPasskey: storage.getItem(`passkey_${publicKey}`) !== null,
    };
  }

  static async clearData(publicKey: string): Promise<void> {
    const storage = getLocalStorage();
    storage.removeItem(`wallet_${publicKey}`);
    storage.removeItem(`stealthKeys_${publicKey}`);
    storage.removeItem(`passkey_${publicKey}`);
  }
}

/**
 * Main class for managing wallet and related functionality
 */
export class WalletManager {
  private gun: any;
  private user: any;
  private ethereumManager: EthereumManager;
  private stealthChain: StealthChain;
  private isAuthenticating = false;

  /**
   * Creates a WalletManager instance
   * Initializes Gun, user and managers for Ethereum and StealthChain
   */
  constructor() {
    this.gun = Gun({
      peers: [
        "https://gun-manhattan.herokuapp.com/gun",
        "https://peer.wallie.io/gun",
        "https://ruling-mastodon-improved.ngrok-free.app/gun",
        "https://gun-relay.scobrudot.dev/gun",
      ],
      localStorage: false,
      radisk:false
    });
    this.user = this.gun.user();
    this.ethereumManager = new EthereumManager(this);
    this.stealthChain = new StealthChain(this.gun);
  }

  /**
   * Gets the EthereumManager instance
   * @returns {EthereumManager} The EthereumManager instance
   */
  public getEthereumManager(): EthereumManager {
    return this.ethereumManager;
  }

  /**
   * Gets the StealthChain instance
   * @returns {StealthChain} The StealthChain instance
   */
  public getStealthChain(): StealthChain {
    return this.stealthChain;
  }

  /**
   * Gets the current user's keyPair
   * @returns {GunKeyPair} The user's keyPair
   */
  public getCurrentUserKeyPair(): GunKeyPair {
    return this.user._.sea;
  }

  private async waitForAuth(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }

  /**
   * Creates a GunDB account using alias and passphrase
   * @param {string} alias - Account username
   * @param {string} passphrase - Account password
   * @param {Function} callback - Optional callback function
   * @returns {Promise<void>}
   */
  public async createAccount(
    alias: string,
    passphrase: string,
    callback?: (error?: Error) => void
  ): Promise<void> {
    try {
      // If there's an authentication in progress, wait a bit and retry
      if (this.isAuthenticating) {
        await this.waitForAuth();
        this.user.leave();
        await this.waitForAuth();
      }

      this.isAuthenticating = true;

      return new Promise((resolve, reject) => {
        console.log("Attempting account creation for:", alias);

        const timeoutId = setTimeout(() => {
          this.isAuthenticating = false;
          this.user.leave();
          const error = new Error("Timeout during account creation");
          if (callback) callback(error);
          reject(error);
        }, 30000); // Increased to 30 seconds

        this.user.create(alias, passphrase, async (ack: any) => {
          try {
            if (ack.err) {
              this.isAuthenticating = false;
              if (
                ack.err.includes("already created") ||
                ack.err.includes("being created")
              ) {
                console.log(
                  "Account already exists or is being created, waiting..."
                );
                await this.waitForAuth();
                try {
                  await this.login(alias, passphrase);
                  if (callback) callback();
                  resolve();
                } catch (loginError) {
                  if (callback) callback(loginError as Error);
                  reject(loginError);
                }
                return;
              }
              const error = new Error(
                `Error during account creation: ${ack.err}`
              );
              if (callback) callback(error);
              reject(error);
              return;
            }

            console.log("Account created successfully, performing login");
            await this.login(alias, passphrase);
            if (callback) callback();
            resolve();
          } catch (error) {
            if (callback) callback(error as Error);
            reject(error);
          } finally {
            clearTimeout(timeoutId);
            this.isAuthenticating = false;
          }
        });
      });
    } catch (error) {
      this.isAuthenticating = false;
      this.user.leave();
      if (callback) callback(error as Error);
      throw error;
    }
  }

  /**
   * Logs into GunDB with alias and passphrase
   * @param {string} alias - Account username
   * @param {string} passphrase - Account password
   * @returns {Promise<string>} Public key if login successful
   */
  public async login(alias: string, passphrase: string): Promise<string> {
    try {
      // If there's an authentication in progress, wait a bit and retry
      if (this.isAuthenticating) {
        await this.waitForAuth();
        this.user.leave();
        await this.waitForAuth();
      }

      this.isAuthenticating = true;
      console.log("Starting login process for:", alias);

      return new Promise<string>((resolve, reject) => {
        // If user is already authenticated with same credentials, return public key
        if (this.user.is?.alias === alias) {
          console.log("User already authenticated with same credentials");
          this.isAuthenticating = false;
          resolve(this.user.is.pub);
          return;
        }

        // Safety timeout
        const timeoutId = setTimeout(() => {
          this.isAuthenticating = false;
          this.user.leave();
          reject(new Error("Authentication timeout"));
        }, 30000); // Increased to 30 seconds

        this.user.auth(alias, passphrase, (ack: any) => {
          try {
            if (ack.err) {
              this.isAuthenticating = false;
              if (ack.err.includes("being created")) {
                // If user is being created, wait and retry
                setTimeout(async () => {
                  try {
                    const result = await this.login(alias, passphrase);
                    resolve(result);
                  } catch (error) {
                    reject(error);
                  }
                }, 2000);
                return;
              }
              reject(new Error(ack.err));
              return;
            }

            if (!this.user.is?.pub) {
              this.isAuthenticating = false;
              reject(new Error("Login failed: public key not found"));
              return;
            }

            console.log("Login completed successfully");
            this.isAuthenticating = false;
            resolve(this.user.is.pub);
          } catch (error) {
            reject(error);
          } finally {
            clearTimeout(timeoutId);
          }
        });
      });
    } catch (error) {
      this.isAuthenticating = false;
      this.user.leave();
      throw error;
    }
  }

  /**
   * Logs out current user from GunDB
   */
  public logout(): void {
    if (this.user.is) {
      this.user.leave();
    }
    this.isAuthenticating = false;
  }

  /**
   * Gets the public key of the logged in GunDB user
   * @returns {string} User's public key
   * @throws {Error} If user is not logged in
   */
  public getPublicKey(): string {
    if (!this.user.is?.pub) {
      throw new Error("User not authenticated");
    }
    return this.user.is.pub;
  }

  /**
   * Converts a Gun private key (in base64Url) to Ethereum-compatible hex format
   * @param {string} gunPrivateKey - Gun private key in base64Url format
   * @returns {Promise<string>} Private key in hex format
   */
  public async convertToEthPk(gunPrivateKey: string): Promise<string> {
    const base64UrlToHex = (base64url: string): string => {
      try {
        const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
        const base64 =
          base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
        const binary = atob(base64);
        const hex = Array.from(binary, (char) =>
          char.charCodeAt(0).toString(16).padStart(2, "0")
        ).join("");

        if (hex.length !== 64) {
          throw new Error("Unable to convert private key: invalid length");
        }
        return hex;
      } catch (error) {
        throw new Error("Unable to convert private key: invalid format");
      }
    };

    if (!gunPrivateKey || typeof gunPrivateKey !== "string") {
      throw new Error("Unable to convert private key: invalid input");
    }

    try {
      const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
      return hexPrivateKey;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Unable to convert private key: ${error.message}`);
      }
      throw new Error("Unable to convert private key: unknown error");
    }
  }

  public async loadMainWallet(gunPrivateKey: string): Promise<Wallet> {
    const pk = await this.convertToEthPk(gunPrivateKey);
    return new Wallet(pk);
  }

  /**
   * Saves wallet to GunDB
   * @param {Wallet} wallet - Wallet to save
   * @param {string} publicKey - Wallet's public key
   * @returns {Promise<void>}
   */
  public async saveWalletToGun(
    wallet: Wallet,
    publicKey: string
  ): Promise<void> {
    console.log(`💾 Saving wallet for ${publicKey}:`, wallet);

    return new Promise((resolve, reject) => {
      let hasResolved = false;

      const walletData = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        entropy: (wallet as any).entropy,
        timestamp: Date.now(),
      };

      console.log("📦 Wallet data to save:", walletData);

      const node = this.gun.get("wallets").get(publicKey);

      node.get("address").put(walletData.address);
      node.get("privateKey").put(walletData.privateKey);
      node.get("entropy").put(walletData.entropy);
      node.get("timestamp").put(walletData.timestamp);

      node.on((data: any) => {
        console.log("📥 Data received after save:", data);
        if (
          data &&
          data.address === wallet.address &&
          data.privateKey === wallet.privateKey &&
          !hasResolved
        ) {
          console.log("✅ Wallet saved successfully");
          hasResolved = true;
          resolve();
        }
      });

      setTimeout(() => {
        if (!hasResolved) {
          console.error("⌛ Timeout saving wallet");
          reject(new Error("Timeout saving wallet"));
        }
      }, 25000);
    });
  }

  /**
   * Retrieves all user wallets from Gun
   * @param {string} publicKey - User's public key
   * @returns {Promise<Wallet[]>} Array of wallets
   */
  public async retrieveWallets(publicKey: string): Promise<Wallet[]> {
    console.log(`🔄 Retrieving wallets for ${publicKey}`);

    return new Promise((resolve, reject) => {
      const wallets: Wallet[] = [];
      let hasResolved = false;

      this.gun
        .get("wallets")
        .get(publicKey)
        .once((data: any) => {
          console.log(`📥 Data received:`, data);

          if (!data) {
            console.log("❌ No wallets found");
            hasResolved = true;
            resolve([]);
            return;
          }

          try {
            const wallet = new Wallet(data.publicKey, data.entropy);
            console.log("✅ Wallet created:", wallet);
            wallets.push(wallet);
            hasResolved = true;
            resolve(wallets);
          } catch (error) {
            console.error("❌ Error parsing wallet:", error);
            reject(error);
          }
        });

      setTimeout(() => {
        if (!hasResolved) {
          console.error("⌛ Timeout retrieving wallets");
          reject(new Error("Timeout retrieving wallets"));
        }
      }, 25000);
    });
  }

  /**
   * Gets the Gun instance
   * @returns The Gun instance
   */
  public getGun(): any {
    return this.gun;
  }

  public getUser(): any {
    return this.gun.user();
  }

  async loginWithPrivateKey(privateKey: string): Promise<string> {
    try {
      // First set the wallet
      this.ethereumManager.setCustomProvider("", privateKey);
      // Then login
      const pubKey = await this.ethereumManager.loginWithEthereum();
      if (!pubKey) {
        throw new Error("Invalid private key");
      }
      return pubKey;
    } catch (error) {
      throw new Error("Invalid private key");
    }
  }

  /**
   * Retrieves wallet from local storage
   * @param {string} publicKey - User's Gun public key
   * @returns {Promise<Wallet | null>} Retrieved wallet or null if not found
   */
  public async retrieveWalletLocally(
    publicKey: string
  ): Promise<Wallet | null> {
    return LocalStorageManager.retrieveWallet(publicKey);
  }

  /**
   * Exports the current Gun key pair
   * @returns {Promise<string>} Exported key pair as JSON string
   * @throws {Error} If user is not authenticated
   */
  public async exportGunKeyPair(): Promise<string> {
    if (!this.user._.sea) {
      throw new Error("User not authenticated");
    }
    return JSON.stringify(this.user._.sea);
  }

  /**
   * Imports a Gun key pair and authenticates with it
   * @param {string} keyPairJson - JSON string of the key pair to import
   * @returns {Promise<string>} Public key of the imported pair
   * @throws {Error} If the key pair is invalid
   */
  public async importGunKeyPair(keyPairJson: string): Promise<string> {
    try {
      const keyPair = JSON.parse(keyPairJson);

      if (!keyPair.pub || !keyPair.priv || !keyPair.epub || !keyPair.epriv) {
        throw new Error("Invalid key pair");
      }

      return new Promise((resolve, reject) => {
        this.user.auth(keyPair, (ack: any) => {
          if (ack.err) {
            reject(new Error(`Authentication error: ${ack.err}`));
            return;
          }
          if (!this.user.is?.pub) {
            reject(new Error("Authentication failed: public key not found"));
            return;
          }
          resolve(this.user.is.pub);
        });
      });
    } catch (error) {
      throw new Error(
        `Error importing key pair: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  /**
   * Checks if there are locally saved data for a user
   * @param {string} publicKey - User's Gun public key
   * @returns {Promise<{hasWallet: boolean, hasStealthKeys: boolean, hasPasskey: boolean}>} Object indicating what data exists
   */
  public async checkLocalData(publicKey: string): Promise<{
    hasWallet: boolean;
    hasStealthKeys: boolean;
    hasPasskey: boolean;
  }> {
    return LocalStorageManager.checkData(publicKey);
  }

  /**
   * Clears all local data for a user
   * @param {string} publicKey - User's Gun public key
   * @returns {Promise<void>}
   */
  public async clearLocalData(publicKey: string): Promise<void> {
    await LocalStorageManager.clearData(publicKey);
  }

  /**
   * Exports all user data (wallet, stealth keys, and Gun pair) as a single JSON
   * @param {string} publicKey - User's Gun public key
   * @returns {Promise<string>} JSON string containing all user data
   */
  public async exportAllData(publicKey: string): Promise<string> {
    if (!this.user._.sea) {
      throw new Error("User not authenticated");
    }

    const wallet = await LocalStorageManager.retrieveWallet(publicKey);
    const stealthKeys = await this.stealthChain.retrieveStealthKeysLocally(publicKey);

    const exportData = {
      wallet: wallet
        ? {
            address: wallet.address,
            privateKey: wallet.privateKey,
            entropy: (wallet as any).entropy || null,
          }
        : null,
      stealthKeys: stealthKeys,
      gunPair: this.user._.sea,
      timestamp: Date.now(),
      version: "1.0",
    };

    return JSON.stringify(exportData);
  }

  /**
   * Imports all user data from a JSON export
   * @param {string} jsonData - JSON string containing user data
   * @param {string} publicKey - User's Gun public key
   * @returns {Promise<void>}
   */
  public async importAllData(
    jsonData: string,
    publicKey: string
  ): Promise<void> {
    try {
      const importData = JSON.parse(jsonData);

      // Verify version and structure
      if (!importData.version || !importData.timestamp) {
        throw new Error("Invalid data format");
      }

      // Import Gun pair and authenticate
      if (importData.gunPair) {
        await this.importGunKeyPair(JSON.stringify(importData.gunPair));
      }

      // Save wallet if present
      if (importData.wallet) {
        const wallet = new Wallet(importData.wallet.privateKey);
        if (importData.wallet.entropy) {
          Object.defineProperty(wallet, "entropy", {
            value: importData.wallet.entropy,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }
        await this.saveWalletLocally(wallet, publicKey);
      }

      // Save stealth keys if present
      if (importData.stealthKeys) {
        await this.stealthChain.saveStealthKeysLocally(
          publicKey,
          importData.stealthKeys
        );
      }
    } catch (error) {
      throw new Error(
        `Error importing data: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  /**
   * Creates a new wallet from Gun public key
   */
  public static async createWalletObj(
    gunKeyPair: GunKeyPair
  ): Promise<WalletResult> {
    try {
      if (!gunKeyPair.pub) throw new Error("Missing public key");

      const salt = `${gunKeyPair.pub}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 15)}`;
      const wallet = await WalletManager.createWalletFromSalt(gunKeyPair, salt);

      if (!wallet || !wallet.address) {
        throw new Error("Failed to create valid wallet");
      }

      const walletData: WalletData = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        entropy: salt,
      };

      return {
        walletObj: walletData,
        entropy: salt,
      };
    } catch (error: any) {
      throw new Error(`Error creating wallet: ${error.message}`);
    }
  }

  /**
   * Creates a hash using Web Crypto API in browser or Node.js crypto in Node
   * @param {string} data - Data to hash
   * @returns {Promise<string>} Hex string of the hash
   */
  private static async createHash(data: string): Promise<string> {
    try {
      // Se siamo in Node.js
      if (typeof window === "undefined" && cryptoModule) {
        return cryptoModule
          .createHash("sha256")
          .update(Buffer.from(data, "utf8"))
          .digest("hex");
      }

      // Se siamo nel browser
      if (typeof window !== "undefined" && window.crypto) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await window.crypto.subtle.digest(
          "SHA-256",
          dataBuffer
        );
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      }

      throw new Error("No crypto implementation available");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error during hash creation";
      throw new Error(`Hash creation failed: ${errorMessage}`);
    }
  }

  /**
   * Creates a wallet from salt and Gun keypair
   */
  public static async createWalletFromSalt(
    gunKeyPair: GunKeyPair,
    salt: string
  ): Promise<Wallet> {
    try {
      if (!salt || typeof salt !== "string") {
        throw new Error("Invalid salt provided");
      }

      const derivedKey = await SEA.work(salt, gunKeyPair);
      if (!derivedKey) throw new Error("Unable to generate derived key");

      const hash = await WalletManager.createHash(derivedKey as string);
      if (!hash || hash.length !== 64) {
        throw new Error("Invalid hash generated");
      }

      const wallet = new Wallet("0x" + hash);
      if (!wallet || !wallet.address || !wallet.privateKey) {
        throw new Error("Failed to create valid wallet");
      }

      // Verifica base del wallet
      if (!wallet.address.startsWith("0x") || wallet.address.length !== 42) {
        throw new Error("Invalid wallet address format");
      }

      (wallet as any).entropy = salt;
      return wallet;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error during wallet creation";
      throw new Error(`Error recreating wallet: ${errorMessage}`);
    }
  }

  /**
   * Unified wallet storage function
   */
  public async saveWallet(
    wallet: Wallet,
    publicKey: string,
    storageType: StorageType = StorageType.BOTH
  ): Promise<void> {
    if (storageType === StorageType.LOCAL || storageType === StorageType.BOTH) {
      await LocalStorageManager.saveWallet(wallet, publicKey);
    }

    if (storageType === StorageType.GUN || storageType === StorageType.BOTH) {
      await this.saveWalletToGun(wallet, publicKey);
    }
  }

  /**
   * Save wallet locally using only Gun
   */
  public async saveWalletLocally(
    wallet: Wallet,
    publicKey: string
  ): Promise<void> {
    await LocalStorageManager.saveWallet(wallet, publicKey);
  }

  /**
   * Unified wallet retrieval function
   */
  public async retrieveWallet(
    publicKey: string,
    storageType: StorageType = StorageType.BOTH
  ): Promise<Wallet | null> {
    if (storageType === StorageType.LOCAL) {
      return LocalStorageManager.retrieveWallet(publicKey);
    }

    if (storageType === StorageType.GUN) {
      const wallets = await this.retrieveWallets(publicKey);
      return wallets[0] || null;
    }

    // Try local first, then Gun
    const localWallet = await LocalStorageManager.retrieveWallet(publicKey);
    if (localWallet) return localWallet;

    const gunWallets = await this.retrieveWallets(publicKey);
    return gunWallets[0] || null;
  }

  /**
   * Deletes a specific wallet from Gun and localStorage
   * @param {string} publicKey - User's Gun public key
   * @param {string} walletAddress - Address of the wallet to delete
   * @returns {Promise<void>}
   */
  public async deleteWallet(publicKey: string, walletAddress: string): Promise<void> {
    // Rimuovi da Gun senza controlli
    this.gun
      .get("wallets")
      .get(publicKey)
      .get(walletAddress)
      .put(null);

    // Rimuovi da localStorage senza verifiche
    const storage = getLocalStorage();
    storage.removeItem(`wallet_${publicKey}`);
    
    return Promise.resolve();
  }
}
