import Gun from "gun";
import "gun/sea";
import { createHash } from "crypto";

import { Wallet } from "./interfaces/Wallet";
import type { GunKeyPair } from "./interfaces/GunKeyPair";
import type { WalletResult } from "./interfaces/WalletResult";

// Extend Gun type definitions
declare module "gun" {
  interface _GunRoot {
    sea: GunKeyPair;
  }
}

const SEA = Gun.SEA;

export class WalletManager {
  private gun: any;
  private user: any;

  constructor() {
    // Initialize Gun with correct options for testing
    this.gun = new Gun({
      peers: ['https://gun-relay.scobrudot.dev/gun'],
      localStorage: true,
      radisk: true
    });
    this.user = this.gun.user();
  }

  /**
   * Gets the current user's keyPair
   */
  public getCurrentUserKeyPair(): GunKeyPair {
    return this.user._.sea;
  }

  /**
   * Creates a GunDB account using an alias (username) and passphrase
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
   * Logs into GunDB with alias and passphrase.
   * Returns Gun public key if login successful, otherwise null.
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
   * Logs out current GunDB user
   */
  public logout(): void {
    this.user.leave();
  }

  /**
   * Returns logged in GunDB user's public key
   */
  public getPublicKey(): string | null {
    return this.user.is?.pub || null;
  }

  /**
   * Converts a Gun private key (in base64Url) to Ethereum-compatible 
   * hexadecimal format (64 hex, prefix "0x")
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
          throw new Error("Lunghezza chiave privata non valida");
        }
        return hex;
      } catch (error) {
        console.error("Errore nella conversione base64Url to hex:", error);
        throw new Error("Impossibile convertire la chiave privata: formato non valido");
      }
    };

    if (!gunPrivateKey || typeof gunPrivateKey !== 'string') {
      throw new Error("Impossibile convertire la chiave privata: input non valido");
    }

    const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
    return hexPrivateKey;
  }

  /**
   * Saves wallet to GunDB
   */
  public async saveWalletToGun(wallet: Wallet, alias: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Save wallet using a simpler path
        this.gun.get('wallets').get(alias).set({
          publicKey: wallet.publicKey,
          entropy: wallet.entropy,
          alias: alias,
          timestamp: Date.now()
        }, (ack: any) => {
          if (ack.err) {
            console.error("Error saving:", ack.err);
            reject(new Error(ack.err));
            return;
          }
          resolve();
        });
      } catch (error) {
        console.error("Error saving:", error);
        reject(error);
      }
    });
  }

  /**
   * Saves wallet. Uses only Gun, no longer localStorage.
   */
  public async saveWalletLocally(wallet: Wallet, alias: string): Promise<void> {
    return this.saveWalletToGun(wallet, alias);
  }

  /**
   * Saves receiver's viewing and spending keys to localStorage
   */
  public async saveStealthKeysLocally(
    alias: string,
    stealthKeys: { spendingKey: string; viewingKey: string }
  ): Promise<void> {
    localStorage.setItem(`stealthKeys_${alias}`, JSON.stringify(stealthKeys));
  }

  /**
   * Retrieves receiver's viewing and spending keys from localStorage
   */
  public async retrieveStealthKeysLocally(
    alias: string
  ): Promise<{ spendingKey: string; viewingKey: string }> {
    const stealthKeys = localStorage.getItem(`stealthKeys_${alias}`);
    return stealthKeys ? JSON.parse(stealthKeys) : null;
  }

  /**
   * Saves receiver's viewing and spending keys
   */
  public async saveStealthKeys(
    alias: string,
    stealthKeys: { spendingKey: string; viewingKey: string }
  ): Promise<void> {
    this.gun.get(`stealthKeys/${alias}`).put(stealthKeys);
  }

  /**
   * Retrieves receiver's viewing and spending keys
   */
  public async retrieveStealthKeys(
    alias: string
  ): Promise<{ spendingKey: string; viewingKey: string }> {
    if (!alias || typeof alias !== 'string') {
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
    });
  }

  /**
   * Retrieves all user wallets from Gun
   */
  public async retrieveWallets(alias: string): Promise<Wallet[]> {
    return new Promise<Wallet[]>((resolve) => {
      const wallets: Wallet[] = [];
      
      this.gun.get('wallets').get(alias).map().once((data: any) => {
        if (!data || !data.publicKey) return;
        try {
          wallets.push(new Wallet(data.publicKey, data.entropy));
        } catch (error) {
          console.error("Error parsing wallet:", error);
        }
      });
      
      // Resolve after short timeout to allow Gun to fetch data
      setTimeout(() => resolve(wallets), 500);
    });
  }

  /**
   * Retrieves specific wallet given its public address
   */
  public async retrieveWalletByAddress(
    alias: string,
    publicKey: string
  ): Promise<Wallet | null> {
    const wallets = await this.retrieveWallets(alias);
    return wallets.find((w) => w.publicKey === publicKey) || null;
  }

  /**
   * Creates a new wallet from Gun public key,
   * generating "entropy" that we'll use to create an Ethereum-style address
   */
  public static async createWalletObj(
    gunKeyPair: GunKeyPair
  ): Promise<WalletResult> {
    try {
      if (!gunKeyPair.pub) {
        throw new Error("Missing public key");
      }

      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 15);
      const salt = `${gunKeyPair.pub}_${timestamp}_${random}`;

      const wallet = await this.createWalletFromSalt(gunKeyPair, salt);
      // Save entropy directly in Wallet
      wallet.entropy = salt;

      return {
        walletObj: wallet,
        entropy: salt,
      };
    } catch (error: any) {
      throw new Error(`Error creating wallet: ${error.message}`);
    }
  }

  /**
   * Given a `salt` and Gun keyPair, generates a derived key and hashes it with
   * SHA-256 to obtain an address to use as "public key"
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
      const hash = createHash("sha256")
        .update(Buffer.from(derivedKey as string, "utf8"))
        .digest("hex");

      return new Wallet("0x" + hash);
    } catch (error: any) {
      throw new Error(`Error recreating wallet: ${error.message}`);
    }
  }

  /**
   * Generates spending key and viewing key for receiver
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
