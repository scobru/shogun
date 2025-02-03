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
  public static async createWalletObj(
    gunKeyPair: GunKeyPair
  ): Promise<WalletResult> {
    try {
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
   * Salva il wallet
   */
  public async saveWallet(wallet: Wallet): Promise<void> {
    if (!validateEthereumAddress(wallet.address)) {
      throw new ValidationError("Indirizzo Ethereum non valido");
    }
    if (!validatePrivateKey(wallet.privateKey)) {
      throw new ValidationError("Chiave privata non valida");
    }
    await this.gunAuthManager.saveWallet(wallet);
  }

  /**
   * Recupera il wallet
   */
  public async getWallet(): Promise<Wallet | null> {
    return this.gunAuthManager.getWallet();
  }
}
