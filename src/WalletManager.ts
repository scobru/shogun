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
import { WebAuthnService } from "./services/webAuthn";
import { EthereumService } from "./services/ethereum";
import { CredentialManager } from "./services/CredentialManager";
import {
  WebAuthnError,
  NetworkError,
  ValidationError,
  WalletError,
  AuthenticationError,
} from "./utils/errors";
import {
  validateAlias,
  validatePrivateKey,
  validateEthereumAddress,
} from "./utils/validation";
import type { ActivityPubKeys } from "./interfaces/ActivityPubKeys";
import type { GunData, GunAck } from "./interfaces/Gun";

// Extend Gun type definitions
declare module "gun" {
  interface _GunRoot {
    sea: GunKeyPair;
  }
}

const SEA = Gun.SEA;

export enum StorageType {
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

  static async saveUser(pair: GunKeyPair, publicKey: string): Promise<void> {
    const storage = getLocalStorage();
    storage.setItem(`user_${publicKey}`, JSON.stringify(pair));
  }

  static async retrieveUser(publicKey: string): Promise<GunKeyPair | null> {
    const storage = getLocalStorage();
    const userData = storage.getItem(`user_${publicKey}`);
    if (!userData) return null;
    try {
      const parsed = JSON.parse(userData);
      return parsed;
    } catch (error) {
      console.error("Error retrieving user:", error);
      return null;
    }
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
    hasActivityPubKeys: boolean;
  }> {
    const storage = getLocalStorage();
    return {
      hasWallet: storage.getItem(`wallet_${publicKey}`) !== null,
      hasStealthKeys: storage.getItem(`stealthKeys_${publicKey}`) !== null,
      hasPasskey: storage.getItem(`passkey_${publicKey}`) !== null,
      hasActivityPubKeys: storage.getItem(`activitypub_${publicKey}`) !== null,
    };
  }

  static async clearData(publicKey: string): Promise<void> {
    const storage = getLocalStorage();
    storage.removeItem(`wallet_${publicKey}`);
    storage.removeItem(`stealthKeys_${publicKey}`);
    storage.removeItem(`passkey_${publicKey}`);
    storage.removeItem(`activitypub_${publicKey}`);
  }

  static async saveActivityPubKeys(
    keys: ActivityPubKeys,
    publicKey: string
  ): Promise<void> {
    const storage = getLocalStorage();
    storage.setItem(`activitypub_${publicKey}`, JSON.stringify(keys));
  }

  static async retrieveActivityPubKeys(
    publicKey: string
  ): Promise<ActivityPubKeys | null> {
    const storage = getLocalStorage();
    const keysData = storage.getItem(`activitypub_${publicKey}`);
    if (!keysData) return null;
    try {
      const parsed = JSON.parse(keysData);
      if (!parsed.publicKey || !parsed.privateKey) {
        return null;
      }
      return {
        publicKey: parsed.publicKey,
        privateKey: parsed.privateKey,
        createdAt: parsed.createdAt || Date.now(),
      };
    } catch (error) {
      console.error(
        "Errore nel recupero delle chiavi ActivityPub locali:",
        error
      );
      return null;
    }
  }
}

// Importiamo crypto solo per Node.js
let cryptoModule: any;
try {
  if (typeof window === "undefined") {
    // Siamo in Node.js
    cryptoModule = require("crypto");
  }
} catch {
  cryptoModule = null;
}

// Funzione helper per la generazione delle chiavi RSA utilizzando WebCrypto o Node crypto
const generateRSAKeyPair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  // Se siamo in Node.js, usa il modulo crypto
  if (typeof window === "undefined" && cryptoModule) {
    try {
      return cryptoModule.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: "spki",
          format: "pem",
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem",
        },
      });
    } catch (error) {
      throw new Error(
        `Errore nella generazione delle chiavi RSA con Node crypto: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }

  // Se siamo nel browser, usa WebCrypto API
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    try {
      // Genera la coppia di chiavi RSA
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]), // 65537
          hash: "SHA-256",
        },
        true, // extractable
        ["encrypt", "decrypt"]
      );

      // Esporta la chiave pubblica
      const publicKeyBuffer = await window.crypto.subtle.exportKey(
        "spki",
        keyPair.publicKey
      );

      // Converti il buffer in base64 in modo sicuro
      const publicKeyArray = Array.from(new Uint8Array(publicKeyBuffer));
      const publicKeyBase64 = btoa(String.fromCharCode.apply(null, publicKeyArray));
      const publicKeyPEM = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----`;

      // Esporta la chiave privata
      const privateKeyBuffer = await window.crypto.subtle.exportKey(
        "pkcs8",
        keyPair.privateKey
      );

      // Converti il buffer in base64 in modo sicuro
      const privateKeyArray = Array.from(new Uint8Array(privateKeyBuffer));
      const privateKeyBase64 = btoa(String.fromCharCode.apply(null, privateKeyArray));
      const privateKeyPEM = `-----BEGIN PRIVATE KEY-----\n${privateKeyBase64}\n-----END PRIVATE KEY-----`;

      return {
        publicKey: publicKeyPEM,
        privateKey: privateKeyPEM,
      };
    } catch (error) {
      throw new Error(
        `Errore nella generazione delle chiavi RSA con WebCrypto: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }

  throw new Error("Nessuna implementazione crittografica disponibile (richiesto Node.js crypto o WebCrypto API)");
};

/**
 * Main class for managing wallet and related functionality
 */
export class WalletManager {
  private gun: any;
  private user: any;
  private ethereumManager: EthereumManager;
  private stealthChain: StealthChain;
  private isAuthenticating = false;
  private webAuthnService: WebAuthnService;
  private ethereumService: EthereumService;
  private credentialManager: CredentialManager;

  /**
   * Creates a WalletManager instance
   * Initializes Gun, user and managers for Ethereum and StealthChain
   */
  constructor(gunOptions: any) {
    this.gun = Gun(gunOptions);
    this.user = this.gun.user();
    this.ethereumManager = new EthereumManager(this);
    this.stealthChain = new StealthChain(this.gun);
    this.webAuthnService = new WebAuthnService(this.gun);
    this.ethereumService = new EthereumService();
    this.credentialManager = new CredentialManager();
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
      // Se c'è un'autenticazione in corso, attendi e riprova
      if (this.isAuthenticating) {
        await this.waitForAuth();
        this.user.leave();
        await this.waitForAuth();
      }

      this.isAuthenticating = true;
      console.log("Starting login process for:", alias);

      return new Promise<string>((resolve, reject) => {
        // Timeout di sicurezza
        const timeoutId = setTimeout(() => {
          this.isAuthenticating = false;
          this.user.leave();
          reject(new Error("Authentication timeout"));
        }, 30000); // Aumentato a 30 secondi

        this.user.auth(alias, passphrase, (ack: any) => {
          try {
            if (ack.err) {
              this.isAuthenticating = false;
              if (ack.err.includes("being created")) {
                // Se l'utente è in fase di creazione, attendi e riprova
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
        entropy: (wallet as any).entropy,
        timestamp: Date.now(),
      };

      console.log("📦 Wallet data to save:", walletData);

      const node = this.gun.get("wallets").get(publicKey);

      node.get("address").put(walletData.address);
      node.get("entropy").put(walletData.entropy);
      node.get("timestamp").put(walletData.timestamp);

      node.on((data: any) => {
        console.log("📥 Data received after save:", data);
        if (data && data.address === wallet.address && !hasResolved) {
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
        .once(async (data: any) => {
          console.log(`📥 Data received:`, data);

          if (!data) {
            console.log("❌ No wallets found");
            hasResolved = true;
            resolve([]);
            return;
          }

          try {
            if (!data.entropy) {
              throw new Error("Missing entropy for wallet recreation");
            }

            const wallet = await WalletManager.createWalletFromSalt(
              this.user._.sea,
              data.entropy
            );

            console.log("✅ Wallet created:", wallet.address);
            wallets.push(wallet);
            hasResolved = true;
            resolve(wallets);
          } catch (error) {
            console.error("❌ Error recreating wallet:", error);
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
      validatePrivateKey(privateKey);

      this.ethereumManager.setCustomProvider("", privateKey);
      const pubKey = await this.ethereumManager.loginWithEthereum();

      if (!pubKey) {
        throw new WalletError("Chiave privata non valida");
      }

      return pubKey;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof WalletError) {
        throw error;
      }
      throw new AuthenticationError(
        "Errore durante il login con chiave privata"
      );
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
    LocalStorageManager.saveUser(this.user._.sea, this.user.is.pub);
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
    const stealthKeys = await this.stealthChain.retrieveStealthKeysLocally(
      publicKey
    );

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
  public async deleteWallet(
    publicKey: string,
    walletAddress: string
  ): Promise<void> {
    // Rimuovi da Gun senza controlli
    this.gun.get("wallets").get(publicKey).get(walletAddress).put(null);

    // Rimuovi da localStorage senza verifiche
    const storage = getLocalStorage();
    storage.removeItem(`wallet_${publicKey}`);

    return Promise.resolve();
  }

  /**
   * Crea un account utilizzando WebAuthn
   * @param {string} alias - Username dell'account
   * @returns {Promise<WalletResult>} Risultato della creazione dell'account
   * @throws {WebAuthnError} Se WebAuthn non è supportato o fallisce la registrazione
   * @throws {NetworkError} Se c'è un problema di rete
   */
  public async createAccountWithWebAuthn(alias: string): Promise<WalletResult> {
    try {
      if (!this.webAuthnService.isSupported()) {
        throw new WebAuthnError("WebAuthn non è supportato su questo browser");
      }

      const webAuthnResult = await this.webAuthnService.generateCredentials(alias);
      if (!webAuthnResult.success || !webAuthnResult.password) {
        throw new WebAuthnError(webAuthnResult.error || "Errore durante la registrazione con WebAuthn");
      }

      await this.createAccount(alias, webAuthnResult.password);
      const walletResult = await WalletManager.createWalletObj(this.user._.sea);
      const wallet = new Wallet(walletResult.walletObj.privateKey);
      await this.saveWallet(wallet, this.user.is.pub, StorageType.BOTH);

      return walletResult;
    } catch (error) {
      if (error instanceof WebAuthnError) {
        throw error;
      }
      throw new NetworkError(`Errore durante la creazione dell'account con WebAuthn: ${error instanceof Error ? error.message : "Errore sconosciuto"}`);
    }
  }

  /**
   * Effettua il login utilizzando WebAuthn
   * @param {string} alias - Username dell'account
   * @returns {Promise<string>} Public key dell'utente
   */
  public async loginWithWebAuthn(alias: string): Promise<string> {
    try {
      validateAlias(alias);

      if (!this.webAuthnService.isSupported()) {
        throw new WebAuthnError("WebAuthn non è supportato su questo browser");
      }

      const webAuthnResult = await this.webAuthnService.login(alias);
      if (!webAuthnResult.success || !webAuthnResult.password) {
        throw new WebAuthnError(
          webAuthnResult.error || "Errore durante il login con WebAuthn"
        );
      }

      const pubKey = await this.login(alias, webAuthnResult.password);
      return pubKey;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof WebAuthnError) {
        throw error;
      }
      throw new AuthenticationError(
        `Errore durante il login con WebAuthn: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }

  /**
   * Verifica se WebAuthn è supportato
   * @returns {boolean} true se WebAuthn è supportato
   */
  public isWebAuthnSupported(): boolean {
    return this.webAuthnService.isSupported();
  }

  /**
   * Genera una coppia di chiavi RSA per ActivityPub
   * @returns {Promise<ActivityPubKeys>} Coppia di chiavi RSA
   * @throws {Error} Se la generazione delle chiavi fallisce
   */
  public async generateActivityPubKeys(): Promise<ActivityPubKeys> {
    try {
      const { privateKey, publicKey } = await generateRSAKeyPair();

      const keys: ActivityPubKeys = {
        publicKey,
        privateKey,
        createdAt: Date.now(),
      };

      return keys;
    } catch (error) {
      throw new Error(
        `Errore nella generazione delle chiavi RSA: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }

  /**
   * Salva le chiavi ActivityPub sia su Gun che localmente
   * @param {ActivityPubKeys} keys - Chiavi da salvare
   * @param {StorageType} storageType - Tipo di storage da utilizzare
   * @returns {Promise<void>}
   * @throws {Error} Se il salvataggio fallisce o l'utente non è autenticato
   */
  public async saveActivityPubKeys(
    keys: ActivityPubKeys,
    storageType: StorageType = StorageType.BOTH
  ): Promise<void> {
    if (!this.user.is) {
      throw new Error("Utente non autenticato");
    }

    const publicKey = this.getPublicKey();

    if (storageType === StorageType.LOCAL || storageType === StorageType.BOTH) {
      await LocalStorageManager.saveActivityPubKeys(keys, publicKey);
    }

    if (storageType === StorageType.GUN || storageType === StorageType.BOTH) {
      return new Promise((resolve, reject) => {
        this.user
          .get("activitypub")
          .get("keys")
          .put(
            {
              publicKey: keys.publicKey,
              privateKey: keys.privateKey,
              createdAt: keys.createdAt,
            },
            (ack: GunAck) => {
              if (ack.err) {
                reject(new Error(ack.err));
                return;
              }

              // Verifica che le chiavi siano state salvate correttamente
              this.user
                .get("activitypub")
                .get("keys")
                .once((data: GunData) => {
                  if (data && data.publicKey === keys.publicKey) {
                    resolve();
                  } else {
                    reject(new Error("Verifica salvataggio chiavi fallita"));
                  }
                });
            }
          );
      });
    }
  }

  /**
   * Recupera le chiavi ActivityPub da Gun e/o localStorage
   * @param {StorageType} storageType - Tipo di storage da utilizzare
   * @returns {Promise<ActivityPubKeys|null>} Chiavi ActivityPub o null se non trovate
   * @throws {Error} Se il recupero fallisce o l'utente non è autenticato
   */
  public async getActivityPubKeys(
    storageType: StorageType = StorageType.BOTH
  ): Promise<ActivityPubKeys | null> {
    if (!this.user.is) {
      throw new Error("Utente non autenticato");
    }

    const publicKey = this.getPublicKey();

    if (storageType === StorageType.LOCAL) {
      return LocalStorageManager.retrieveActivityPubKeys(publicKey);
    }

    if (storageType === StorageType.GUN) {
      return new Promise((resolve, reject) => {
        this.user
          .get("activitypub")
          .get("keys")
          .once((data: GunData) => {
            if (!data) {
              resolve(null);
              return;
            }

            if (!data.publicKey || !data.privateKey) {
              reject(new Error("Chiavi ActivityPub incomplete"));
              return;
            }

            resolve({
              publicKey: data.publicKey,
              privateKey: data.privateKey,
              createdAt: data.createdAt || Date.now(),
            });
          });
      });
    }

    // Se siamo qui, storageType è BOTH
    // Prima proviamo il recupero locale
    const localKeys = await LocalStorageManager.retrieveActivityPubKeys(
      publicKey
    );
    if (localKeys) return localKeys;

    // Se non troviamo le chiavi localmente, proviamo su Gun
    return this.getActivityPubKeys(StorageType.GUN);
  }

  /**
   * Elimina le chiavi ActivityPub da Gun e localStorage
   * @param {StorageType} storageType - Tipo di storage da utilizzare
   * @returns {Promise<void>}
   * @throws {Error} Se l'eliminazione fallisce o l'utente non è autenticato
   */
  public async deleteActivityPubKeys(
    storageType: StorageType = StorageType.BOTH
  ): Promise<void> {
    if (!this.user.is) {
      throw new Error("Utente non autenticato");
    }

    const publicKey = this.getPublicKey();

    if (storageType === StorageType.LOCAL || storageType === StorageType.BOTH) {
      const storage = getLocalStorage();
      storage.removeItem(`activitypub_${publicKey}`);
    }

    if (storageType === StorageType.GUN || storageType === StorageType.BOTH) {
      return new Promise((resolve, reject) => {
        this.user
          .get("activitypub")
          .get("keys")
          .put(null, (ack: GunAck) => {
            if (ack.err) {
              reject(new Error(ack.err));
              return;
            }
            resolve();
          });
      });
    }
  }
}
