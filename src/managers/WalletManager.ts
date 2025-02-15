import { IGunInstance, ISEAPair, SEA } from "gun";
import { GunKeyPair } from "../interfaces";
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

interface ExtendedWallet extends Wallet {
  entropy: string;
  timestamp: number;
}

interface WalletDataContainer {
  wallets: WalletData[];
}

export class WalletManager extends BaseManager<WalletData> {
  protected storagePrefix = "wallets";

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
  }

  /**
   * Creates a new wallet from the Gun user
   * @returns {Promise<WalletData>} - The result object of the created wallet
   * @throws {Error} - If the user is not authenticated or if wallet creation fails
   */
  public async createAccount(): Promise<WalletData> {
    try {
      const gunKeyPair = this.user._.sea;

      if (!gunKeyPair || !gunKeyPair.pub) {
        throw new Error("Missing or invalid Gun key pair");
      }

      const salt = `${gunKeyPair.pub}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 15)}`;

      console.log("Creating wallet with salt:", salt);
      const wallet = await this.createWalletFromSalt(gunKeyPair, salt);

      if (!wallet || !wallet.address) {
        throw new Error("Failed to create valid wallet");
      }

      const walletData: WalletData = {
        address: wallet.address.toLowerCase(),
        privateKey: wallet.privateKey,
        entropy: salt,
        timestamp: Date.now(),
      };

      console.log("Saving wallet with address:", walletData.address);
      
      // Salva il wallet con retry
      let retryCount = 0;
      const maxRetries = 3;
      let saveSuccess = false;

      while (retryCount < maxRetries && !saveSuccess) {
        try {
          await this.saveWallet(new Wallet(walletData.privateKey));
          saveSuccess = true;
        } catch (error) {
          console.warn(`Retry ${retryCount + 1} failed:`, error);
          retryCount++;
          if (retryCount === maxRetries) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log("Wallet saved successfully");
      return walletData;
    } catch (error: any) {
      console.error("Error in createAccount:", error);
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
  public async getWallets(): Promise<ExtendedWallet[]> {
    try {
      await this.ensureAuthenticated();

      return new Promise<ExtendedWallet[]>((resolve, reject) => {
        const wallets: ExtendedWallet[] = [];
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(wallets);
          }
        }, 5000);

        // Leggi l'indice dei wallet
        this.getPrivateNode('wallets_index')
          .map()
          .once((data: any, key: string) => {
            if (key && !key.startsWith('_')) {
              // Per ogni riferimento, leggi il wallet completo
              this.getPrivateNode(`wallet_${key}`)
                .once((walletData: any) => {
                  if (walletData && walletData.address && walletData.privateKey) {
                    try {
                      const wallet = new Wallet(walletData.privateKey);
                      if (wallet.address.toLowerCase() === walletData.address.toLowerCase()) {
                        const extendedWallet = Object.assign(wallet, {
                          entropy: walletData.entropy || "",
                          timestamp: walletData.timestamp || Date.now()
                        });
                        wallets.push(extendedWallet);
                      }
                    } catch (error) {
                      console.error("Error creating wallet instance:", error);
                    }
                  }
                });
            }
          });

        // Verifica periodica
        const checkInterval = setInterval(() => {
          if (wallets.length > 0 && !resolved) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolved = true;
            resolve(wallets);
          }
        }, 500);
      });
    } catch (error) {
      console.error("Error retrieving wallets:", error);
      throw error;
    }
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
   * @returns {Promise<void>} - A promise that resolves when the wallet is saved
   * @throws {ValidationError} - If the Ethereum address or private key are invalid
   * @throws {Error} - If the user is not authenticated or if wallet saving fails
   */
  public async saveWallet(wallet: Wallet): Promise<void> {
    if (!wallet?.address || !wallet.privateKey) {
      throw new Error("Invalid wallet data");
    }

    try {
      await this.ensureAuthenticated();

      const walletData: WalletData = {
        address: wallet.address.toLowerCase(),
        privateKey: wallet.privateKey,
        entropy: (wallet as ExtendedWallet).entropy || "",
        timestamp: Date.now()
      };

      // Salva con retry
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          // Salva il wallet nel suo nodo specifico
          const walletNode = this.getPrivateNode(`wallet_${walletData.address}`);
          await new Promise<void>((resolve, reject) => {
            walletNode.put(walletData, (ack: any) => {
              if (ack.err) reject(new Error(ack.err));
              else resolve();
            });
          });

          // Aggiungi il riferimento al wallet nel nodo principale dei wallet
          const walletsNode = this.getPrivateNode('wallets_index');
          await new Promise<void>((resolve, reject) => {
            walletsNode.get(walletData.address).put(
              this.getPrivateNode(`wallet_${walletData.address}`),
              (ack: any) => {
                if (ack.err) reject(new Error(ack.err));
                else resolve();
              }
            );
          });

          // Verifica il salvataggio
          const saved = await this.getPrivateData(`wallet_${walletData.address}`);
          if (saved && saved.address === walletData.address) {
            return;
          }

          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Retry ${retryCount + 1} failed:`, error);
          retryCount++;
          if (retryCount === maxRetries) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      throw new Error("Failed to verify wallet was saved");
    } catch (error) {
      console.error("Error saving wallet:", error);
      throw error;
    }
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

  private async ensureAuthenticated(): Promise<void> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }
  }

  public async deleteWallet(address: string): Promise<void> {
    try {
      await this.ensureAuthenticated();
      
      // Rimuovi il riferimento dall'indice
      await new Promise<void>((resolve, reject) => {
        this.getPrivateNode('wallets_index')
          .get(address)
          .put(null, (ack: any) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
      });

      // Rimuovi i dati del wallet
      await new Promise<void>((resolve, reject) => {
        this.getPrivateNode(`wallet_${address}`)
          .put(null, (ack: any) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
      });
    } catch (error) {
      console.error("Error deleting wallet:", error);
      throw error;
    }
  }
}
