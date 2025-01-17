/**
 * @fileoverview Manages wallet functionality, including authentication and key management
 * @module WalletManager
 */

import Gun from "gun";
import "gun/sea";
import { ethers } from "ethers";

import { Wallet } from "./interfaces/Wallet";
import type { GunKeyPair } from "./interfaces/GunKeyPair";
import type { WalletResult } from "./interfaces/WalletResult";
import { EthereumManager } from "./EthereumManager";
import { StealthChain } from "./Stealth";

// Extend Gun type definitions
declare module "gun" {
  interface _GunRoot {
    sea: GunKeyPair;
  }
}

const SEA = Gun.SEA;

/**
 * Calcola l'hash SHA-256 di un input
 * @param input - Input da hashare
 * @returns Promise che risolve nell'hash in formato hex
 */
async function sha256(input: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Main class for managing wallet and related functionality
 */
export class WalletManager {
  private gun: any;
  private user: any;
  private ethereumManager: EthereumManager;
  private stealthChain: StealthChain;

  /**
   * Creates a WalletManager instance
   * Initializes Gun, user and managers for Ethereum and StealthChain
   */
  constructor() {
    // Initialize Gun with correct options for testing
    this.gun = new Gun({
      peers: ["https://gun-relay.scobrudot.dev/gun"],
      localStorage: true,
      radisk: true,
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

  /**
   * Creates a GunDB account using alias and passphrase
   * @param {string} alias - Account username
   * @param {string} passphrase - Account password
   * @returns {Promise<void>}
   */
  public async createAccount(alias: string, passphrase: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.user.create(alias, passphrase, async (ack: any) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }
        try {
          // After creation, automatically log in
          await this.login(alias, passphrase);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Logs into GunDB with alias and passphrase
   * @param {string} alias - Account username
   * @param {string} passphrase - Account password
   * @returns {Promise<string|null>} Public key if login successful, otherwise null
   */
  public async login(
    alias: string,
    passphrase: string
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.user.auth(alias, passphrase, (ack: any) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }
        resolve(this.user.is?.pub || null);
      });
    });
  }

  /**
   * Logs out current user from GunDB
   */
  public logout(): void {
    this.user.leave();
  }

  /**
   * Gets the public key of the logged in GunDB user
   * @returns {string|null} User's public key or null
   */
  public getPublicKey(): string | null {
    return this.user.is?.pub || null;
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
          throw new Error("Impossibile convertire la chiave privata: lunghezza non valida");
        }
        return hex;
      } catch (error) {
        throw new Error("Impossibile convertire la chiave privata: formato non valido");
      }
    };

    if (!gunPrivateKey || typeof gunPrivateKey !== "string") {
      throw new Error(
        "Impossibile convertire la chiave privata: input non valido"
      );
    }

    try {
      const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
      return hexPrivateKey;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Impossibile convertire la chiave privata: ${error.message}`);
      }
      throw new Error("Impossibile convertire la chiave privata: errore sconosciuto");
    }
  }

  /**
   * Saves wallet to GunDB
   * @param {Wallet} wallet - Wallet to save
   * @param {string} alias - Username associated with wallet
   * @returns {Promise<void>}
   */
  public async saveWalletToGun(wallet: Wallet, alias: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Save wallet using a simpler path
        this.gun
          .get("wallets")
          .get(alias)
          .set(
            {
              publicKey: wallet.publicKey,
              entropy: wallet.entropy,
              alias: alias,
              timestamp: Date.now(),
            },
            (ack: any) => {
              if (ack.err) {
                console.error("Error saving:", ack.err);
                reject(new Error(ack.err));
                return;
              }
              resolve();
            }
          );
      } catch (error) {
        console.error("Error saving:", error);
        reject(error);
      }
    });
  }

  /**
   * Saves wallet locally using only Gun
   * @param {Wallet} wallet - Wallet to save
   * @param {string} alias - Username associated with wallet
   * @returns {Promise<void>}
   */
  public async saveWalletLocally(wallet: Wallet, alias: string): Promise<void> {
    return this.saveWalletToGun(wallet, alias);
  }

  /**
   * Saves recipient's stealth keys to localStorage
   * @param {string} alias - Recipient's username
   * @param {Object} stealthKeys - Object containing stealth keys
   * @param {string} stealthKeys.spendingKey - Spending key
   * @param {string} stealthKeys.viewingKey - Viewing key
   * @returns {Promise<void>}
   */
  public async saveStealthKeysLocally(
    alias: string,
    stealthKeys: { spendingKey: string; viewingKey: string }
  ): Promise<void> {
    localStorage.setItem(`stealthKeys_${alias}`, JSON.stringify(stealthKeys));
  }

  /**
   * Retrieves recipient's stealth keys from localStorage
   * @param {string} alias - Recipient's username
   * @returns {Promise<{spendingKey: string, viewingKey: string}>} Stealth keys
   */
  public async retrieveStealthKeysLocally(
    alias: string
  ): Promise<{ spendingKey: string; viewingKey: string }> {
    const stealthKeys = localStorage.getItem(`stealthKeys_${alias}`);
    if (!stealthKeys) {
      throw new Error("Stealth keys not found in localStorage");
    }
    const parsed = JSON.parse(stealthKeys);
    if (!parsed || !parsed.spendingKey || !parsed.viewingKey) {
      throw new Error("Invalid stealth keys in localStorage");
    }
    return parsed;
  }

  /**
   * Saves recipient's stealth keys
   * @param {string} alias - Recipient's username
   * @param {Object} stealthKeys - Object containing stealth keys
   * @param {string} stealthKeys.spendingKey - Spending key
   * @param {string} stealthKeys.viewingKey - Viewing key
   * @returns {Promise<void>}
   */
  public async saveStealthKeys(
    alias: string,
    stealthKeys: { spendingKey: string; viewingKey: string }
  ): Promise<void> {
    this.gun.get(`stealthKeys/${alias}`).put(stealthKeys);
  }

  /**
   * Retrieves recipient's stealth keys
   * @param {string} alias - Recipient's username
   * @returns {Promise<{spendingKey: string, viewingKey: string}>} Stealth keys
   */
  public async retrieveStealthKeys(
    alias: string
  ): Promise<{ spendingKey: string; viewingKey: string }> {
    if (!alias || typeof alias !== "string") {
      throw new Error("Chiavi stealth non trovate: alias non valido");
    }

    return new Promise((resolve, reject) => {
      this.gun.get(`stealthKeys/${alias}`).once((data: any) => {
        if (!data) {
          reject(new Error("Chiavi stealth non trovate"));
          return;
        }
        if (!data.spendingKey || !data.viewingKey) {
          reject(new Error("Chiavi stealth non trovate o incomplete"));
          return;
        }
        resolve({
          spendingKey: data.spendingKey,
          viewingKey: data.viewingKey,
        });
      });

      // Aggiungi un timeout per gestire il caso in cui Gun non risponda
      setTimeout(() => {
        reject(new Error("Chiavi stealth non trovate: timeout"));
      }, 5000);
    });
  }

  /**
   * Retrieves all user wallets from Gun
   * @param {string} alias - User's username
   * @returns {Promise<Wallet[]>} Array of wallets
   */
  public async retrieveWallets(alias: string): Promise<Wallet[]> {
    return new Promise<Wallet[]>((resolve) => {
      const startTime = performance.now();
      console.log(`🔄 Started retrieving wallets for ${alias}`);

      const wallets: Wallet[] = [];

      this.gun
        .get("wallets")
        .get(alias)
        .map()
        .once((data: any) => {
          if (!data || !data.publicKey) return;
          try {
            wallets.push(new Wallet(data.publicKey, data.entropy));
          } catch (error) {
            console.error("Error parsing wallet:", error);
          }
        });

      // Increased timeout to better handle non-optimal network conditions
      setTimeout(() => {
        const endTime = performance.now();
        console.log(
          `✅ Wallet retrieval completed in ${Math.round(
            endTime - startTime
          )}ms`
        );
        resolve(wallets);
      }, 2000);
    });
  }

  /**
   * Retrieves a specific wallet given its public address
   * @param {string} alias - User's username
   * @param {string} publicKey - Wallet's public key
   * @returns {Promise<Wallet|null>} Found wallet or null
   */
  public async retrieveWalletByAddress(
    alias: string,
    publicKey: string
  ): Promise<Wallet | null> {
    const wallets = await this.retrieveWallets(alias);
    return wallets.find((w) => w.publicKey === publicKey) || null;
  }

  /**
   * Creates a new wallet object from Gun public key,
   * generating "entropy" which we'll use to create an Ethereum-style address
   * @param {GunKeyPair} gunKeyPair - Gun key pair
   * @returns {Promise<WalletResult>} Object containing wallet and entropy
   */
  public static async createWalletObj(
    gunKeyPair: GunKeyPair
  ): Promise<WalletResult> {
    try {
      if (!gunKeyPair.pub) {
        throw new Error("Missing public key");
      }

      // Genera entropia casuale usando crypto.getRandomValues
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const entropy = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Combina l'entropia con la chiave pubblica per generare il salt
      const salt = `${entropy}_${gunKeyPair.pub}_${Date.now()}`;

      const wallet = await this.createWalletFromSalt(gunKeyPair, salt);
      wallet.entropy = entropy;

      return {
        walletObj: wallet,
        entropy: entropy,
      };
    } catch (error: any) {
      throw new Error(`Error creating wallet: ${error.message}`);
    }
  }

  /**
   * Given a `salt` and Gun key pair, generates a derived key and hashes it with
   * SHA-256 to get an address to use as "public key"
   * @param {GunKeyPair} gunKeyPair - Gun key pair
   * @param {string} salt - Salt for key derivation
   * @returns {Promise<Wallet>} Created wallet
   */
  public static async createWalletFromSalt(
    gunKeyPair: GunKeyPair,
    salt: string
  ): Promise<Wallet> {
    try {
      // Derive key from salt + Gun key
      const derivedKey = await SEA.work(salt, gunKeyPair);

      if (!derivedKey) {
        throw new Error("Unable to generate derived key");
      }

      // Generate address by hashing derivedKey
      const hash = await sha256(derivedKey as string);
      
      // Prendi solo gli ultimi 40 caratteri per creare un indirizzo Ethereum valido
      const address = "0x" + hash.slice(-40);

      return new Wallet(address);
    } catch (error: any) {
      throw new Error(`Error recreating wallet: ${error.message}`);
    }
  }

  /**
   * Generates spending and viewing keys for recipient
   * @param {GunKeyPair} pair - Gun key pair
   * @returns {Promise<{spendingKey: string, viewingKey: string}>} Generated stealth keys
   */
  public async generateStealthKeys(
    pair: GunKeyPair
  ): Promise<{ spendingKey: string; viewingKey: string }> {
    const viewingKeyPair = await SEA.pair();
    const spendingKeyPair = await SEA.pair();

    const stealthKeyPairs = {
      spendingKey: spendingKeyPair.epriv,
      viewingKey: viewingKeyPair.epriv,
    };

    // encrypt the viewing key with the spending key
    const encryptedViewingKey = await SEA.encrypt(stealthKeyPairs, pair);
    const decryptedKeys = await SEA.decrypt(encryptedViewingKey, pair);

    return {
      spendingKey: decryptedKeys.spendingKey,
      viewingKey: decryptedKeys.viewingKey,
    };
  }
}
