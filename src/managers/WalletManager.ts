import { SEA } from "gun";
import { GunKeyPair, WalletResult } from "../interfaces";
import { WalletData } from "../interfaces/WalletResult";
import { Wallet } from "ethers";
import { ValidationError } from "../utils/errors";
import {
  validateEthereumAddress,
  validatePrivateKey,
} from "../utils/validation";
import { GunAuthManager } from "./GunAuthManager";

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

export class WalletManager {
  private gunAuthManager: GunAuthManager;

  constructor(gunAuthManager: GunAuthManager) {
    this.gunAuthManager = gunAuthManager;
  }

  /**
   * Creates a new wallet from Gun public key
   */
  public async createWalletObj(): Promise<WalletResult> {
    try {
      const user = await this.gunAuthManager.getUser();

      if (!user.is) {
        throw new Error("User not authenticated");
      }

      const gunKeyPair = user.pair();

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
   */
  private async createHash(data: string): Promise<string> {
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
   * Recupera tutti i wallet dell'utente con tutte le loro informazioni
   */
  public async getWallets(): Promise<Array<Wallet & { entropy?: string; timestamp?: number }>> {
    const publicKey = this.gunAuthManager.getPublicKey();
    const walletData = await this.gunAuthManager.getPrivateData(
      `wallets/${publicKey}`
    );
  
    // Se non ci sono dati del wallet, ritorna array vuoto
    if (!walletData) return [];

    // Converti in array se è un singolo wallet
    const walletsArray = Array.isArray(walletData) ? walletData : [walletData];

    // Filtra wallet non validi e crea istanze Wallet con informazioni aggiuntive
    const wallets = walletsArray
      .filter(w => w && w.privateKey && w.address)
      .map(w => {
        const wallet = new Wallet(w.privateKey);
        
        // Aggiungi tutte le proprietà aggiuntive al wallet
        if (w.entropy) {
          Object.defineProperty(wallet, "entropy", {
            value: w.entropy,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }
        
        // Aggiungi il timestamp
        if (w.timestamp) {
          Object.defineProperty(wallet, "timestamp", {
            value: w.timestamp,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }

        // Assicurati che la privateKey sia accessibile
        Object.defineProperty(wallet, "privateKey", {
          value: w.privateKey,
          writable: true,
          enumerable: true,
          configurable: true,
        });

        return wallet;
      });

    // Ordina per timestamp (dal più vecchio al più recente)
    return wallets.sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  /**
   * Recupera il wallet principale (derivato dalla chiave Gun)
   */
  public async getWallet(): Promise<Wallet> {
    const user = await this.gunAuthManager.getUser();
    const pair = user.pair();
    const walletPK = this.convertToEthPk(pair.priv);
    const wallet = new Wallet(walletPK);
    return wallet;
  }

  /**
   * Salva un nuovo wallet
   */
  public async saveWallet(wallet: Wallet, publicKey: string): Promise<void> {
    const user = await this.gunAuthManager.getUser();

    if (!validateEthereumAddress(wallet.address)) {
      throw new ValidationError("Indirizzo Ethereum non valido");
    }
    if (!validatePrivateKey(wallet.privateKey)) {
      throw new ValidationError("Chiave privata non valida");
    }

    if (!user.is) {
      throw new Error("User not authenticated");
    }

    // Recupera i wallet esistenti
    const existingWallets = await this.gunAuthManager.getPrivateData(`wallets/${publicKey}`);
    
    const walletData = {
      address: wallet.address,
      privateKey: wallet.privateKey, // Aggiungo la privateKey che mancava
      entropy: (wallet as any).entropy,
      timestamp: Date.now(),
    };

    // Se non ci sono wallet esistenti, crea un nuovo array
    const updatedWallets = Array.isArray(existingWallets)
      ? [...existingWallets, walletData]
      : [walletData];

    await this.gunAuthManager.savePrivateData(
      updatedWallets,
      `wallets/${publicKey}`
    );
    
    await this.gunAuthManager.savePublicData(
      { address: wallet.address },
      `wallets/${publicKey}`
    );
  }

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
