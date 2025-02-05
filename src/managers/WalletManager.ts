import { IGunInstance, ISEAPair, SEA } from "gun";
import { GunKeyPair, WalletResult } from "../interfaces";
import { WalletData } from "../interfaces/WalletResult";
import { Wallet } from "ethers";
import { ValidationError } from "../utils/gun/errors";
import {
  validateEthereumAddress,
  validatePrivateKey,
} from "../utils/validation";
import { BaseManager } from "./BaseManager";

// Import crypto only for Node.js
let cryptoModule: any;
try {
  if (typeof window === "undefined") {
    // We are in Node.js
    cryptoModule = require("crypto");
  }
} catch {
  cryptoModule = null;
}

export class WalletManager extends BaseManager<WalletData[]> {
  protected storagePrefix = "wallets";

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
  }

  /**
   * Creates a new wallet from the Gun user
   * @returns {Promise<WalletResult>} - The result object of the created wallet
   * @throws {Error} - If the user is not authenticated or if wallet creation fails
   */
  public async createAccount(): Promise<WalletData[]> {
    try {
      this.checkAuthentication();
      const gunKeyPair = this.user._.sea;

      if (!gunKeyPair.pub) throw new Error("Missing public key");

      const salt = `${gunKeyPair.pub}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 15)}`;
      const wallet = await this.createWalletFromSalt(gunKeyPair, salt);

      if (!wallet || !wallet.address) {
        throw new Error("Failed to create valid wallet");
      }

      const walletData: WalletData = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        entropy: salt,
        timestamp: Date.now(),
      };

      await this.saveWallet(new Wallet(walletData.privateKey));
      return [walletData];
    } catch (error: any) {
      throw new Error(`Error creating wallet: ${error.message}`);
    }
  }

  /**
   * Creates a hash using the Web Crypto API in the browser or the crypto module in Node.js
   * @param {string} data - The data to hash
   * @returns {Promise<string>} - The created hash
   * @throws {Error} - If no crypto implementation is available or if hash creation fails
   */
  private async createHash(data: string): Promise<string> {
    try {
      // If we are in Node.js
      if (typeof window === "undefined" && cryptoModule) {
        return cryptoModule
          .createHash("sha256")
          .update(Buffer.from(data, "utf8"))
          .digest("hex");
      }

      // If we are in the browser
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
   * Creates a wallet from a salt and a Gun key pair
   * @param {GunKeyPair} gunKeyPair - The Gun key pair
   * @param {string} salt - The salt to use for wallet creation
   * @returns {Promise<Wallet>} - The created wallet
   * @throws {Error} - If the salt is invalid, if the derived key cannot be generated, if the generated hash is invalid, or if wallet creation fails
   */
  public async createWalletFromSalt(
    gunKeyPair: GunKeyPair,
    salt: string
  ): Promise<Wallet> {
    try {
      if (!salt || typeof salt !== "string") {
        throw new Error("Invalid salt provided");
      }

      const derivedKey = await SEA.work(salt, gunKeyPair);
      if (!derivedKey) throw new Error("Unable to generate derived key");

      const hash = await this.createHash(derivedKey as string);
      if (!hash || hash.length !== 64) {
        throw new Error("Invalid hash generated");
      }

      const wallet = new Wallet("0x" + hash);
      if (!wallet || !wallet.address || !wallet.privateKey) {
        throw new Error("Failed to create valid wallet");
      }

      // Basic wallet verification
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
   * Retrieves all user wallets with all their information
   * @returns {Promise<Array<Wallet & { entropy?: string; timestamp?: number }>>} - An array of wallets with additional information
   * @throws {Error} - If wallet data retrieval fails
   */
  public async getWallets(): Promise<
    Array<Wallet & { entropy?: string; timestamp?: number }>
  > {
    const publicKey = this.getCurrentPublicKey();
    const walletData = await this.getPrivateData(publicKey);

    // If there is no wallet data, return an empty array
    if (!walletData) return [];

    // Convert to array if it is a single wallet
    const walletsArray = Array.isArray(walletData) ? walletData : [walletData];

    // Filter invalid wallets and create Wallet instances with additional information
    const wallets = walletsArray
      .filter((w) => w && w.privateKey && w.address)
      .map((w) => {
        const wallet = new Wallet(w.privateKey);

        // Add all additional properties to the wallet
        if (w.entropy) {
          Object.defineProperty(wallet, "entropy", {
            value: w.entropy,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }

        // Add the timestamp
        if (w.timestamp) {
          Object.defineProperty(wallet, "timestamp", {
            value: w.timestamp,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }

        // Ensure the privateKey is accessible
        Object.defineProperty(wallet, "privateKey", {
          value: w.privateKey,
          writable: true,
          enumerable: true,
          configurable: true,
        });

        return wallet;
      });

    // Sort by timestamp (from oldest to newest)
    return wallets.sort(
      (a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0)
    );
  }

  /**
   * Retrieves the main wallet (derived from the Gun key)
   * @returns {Promise<Wallet>} - The main wallet
   * @throws {Error} - If the user is not authenticated or if private key conversion fails
   */
  public async getWallet(): Promise<Wallet> {
    const pair = this.user._.sea;
    if (!pair) throw new Error("User not authenticated");

    const walletPK = this.convertToEthPk(pair.priv);
    const wallet = new Wallet(walletPK);
    return wallet;
  }

  /**
   * Saves a new wallet
   * @param {Wallet} wallet - The wallet to save
   * @param {string} publicKey - The user's public key
   * @returns {Promise<void>} - A promise that resolves when the wallet is saved
   * @throws {ValidationError} - If the Ethereum address or private key are invalid
   * @throws {Error} - If the user is not authenticated or if wallet saving fails
   */
  public async saveWallet(wallet: Wallet): Promise<void> {
    this.checkAuthentication();

    if (!validateEthereumAddress(wallet.address)) {
      throw new ValidationError("Invalid Ethereum address");
    }
    if (!validatePrivateKey(wallet.privateKey)) {
      throw new ValidationError("Invalid private key");
    }

    const publicKey = this.getCurrentPublicKey();
    const existingWallets = (await this.getPrivateData(publicKey)) || [];

    const walletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      entropy: (wallet as any).entropy,
      timestamp: Date.now(),
    };

    // If there are no existing wallets, create a new array
    const updatedWallets = Array.isArray(existingWallets)
      ? [...existingWallets, walletData]
      : [walletData];

    await this.savePrivateData(updatedWallets, publicKey);
    await this.savePublicData({ address: wallet.address }, publicKey);
  }

  /**
   * Converts a Gun private key to an Ethereum private key
   * @param {string} gunPrivateKey - The Gun private key
   * @returns {string} - The Ethereum private key
   * @throws {Error} - If the private key is invalid or if conversion fails
   */
  public convertToEthPk(gunPrivateKey: string): string {
    const base64UrlToHex = (base64url: string): string => {
      const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
      const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
      const binary = atob(base64);
      const hex = Array.from(binary, (char) =>
        char.charCodeAt(0).toString(16).padStart(2, "0")
      ).join("");

      if (hex.length !== 64) {
        throw new Error("Cannot convert private key: invalid length");
      }
      return hex;
    };

    if (!gunPrivateKey || typeof gunPrivateKey !== "string") {
      throw new Error("Cannot convert private key: invalid input");
    }

    try {
      const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
      return hexPrivateKey;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Cannot convert private key: ${error.message}`);
      } else {
        throw new Error("Cannot convert private key: unknown error");
      }
    }
  }
}
