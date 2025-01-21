/**
 * @fileoverview Manages wallet functionality, including authentication and key management
 * @module WalletManager
 */

import Gun from "gun";
import "gun/sea";
import "gun/lib/webrtc"; // Abilita WebRTC in GunDB
import 'gun/lib/radisk';
import 'gun/lib/axe';


import { ethers } from "ethers";

import { Wallet } from "./interfaces/Wallet";
import type { GunKeyPair } from "./interfaces/GunKeyPair";
import type { WalletResult } from "./interfaces/WalletResult";
import { EthereumManager } from "./EthereumManager";
import { StealthChain } from "./StealthChain";

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
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

/**
 * Main class for managing wallet and related functionality
 */
export class WalletManager {
  protected gun: any;  // Temporaneamente usando any per far funzionare i test
  private user: any;
  private ethereumManager: EthereumManager;
  private stealthChain: StealthChain;
  private isAuthenticating = false;

  /**
   * Creates a WalletManager instance
   * Initializes Gun, user and managers for Ethereum and StealthChain
   */
  constructor() {
    // Initialize Gun with correct options for testing
    this.gun = new Gun({
      peers: ["https://gun-relay.scobrudot.dev/gun"],
      localStorage: false,
      radisk: false,
      rtc: {
        enable: true,
        trickle: true,
      },
      axe: true,
      web: false,      
    });

    this.user = this.gun.user();
    this.ethereumManager = new EthereumManager(this);
    this.stealthChain = new StealthChain(this.gun);
    
    this.gun.on("rtc:peer", (peer: any) => {
      console.log("Nuovo peer connesso:", peer);
    });

    this.gun.on("rtc:data", (msg: any) => {
      console.log("Dati ricevuti via WebRTC:", msg);
    });
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
    return new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Creates a GunDB account using alias and passphrase
   * @param {string} alias - Account username
   * @param {string} passphrase - Account password
   * @returns {Promise<void>}
   */
  public async createAccount(alias: string, passphrase: string): Promise<void> {
    try {
      // Se c'è un'autenticazione in corso, aspetta un po' e riprova
      if (this.isAuthenticating) {
        await this.waitForAuth();
        this.user.leave();
        await this.waitForAuth();
      }

      this.isAuthenticating = true;

      return new Promise((resolve, reject) => {
        console.log("Tentativo di creazione account per:", alias);

        const timeoutId = setTimeout(() => {
          this.isAuthenticating = false;
          this.user.leave();
          reject(new Error("Timeout durante la creazione dell'account"));
        }, 15000);

        this.user.create(alias, passphrase, async (ack: any) => {
          clearTimeout(timeoutId);
          
          if (ack.err) {
            this.isAuthenticating = false;
            if (ack.err.includes("already created") || ack.err.includes("being created")) {
              console.log("Account già esistente o in fase di creazione, attendo...");
              await this.waitForAuth();
              try {
                await this.login(alias, passphrase);
                resolve();
              } catch (loginError) {
                reject(loginError);
              }
              return;
            }
            reject(new Error(`Errore durante la creazione dell'account: ${ack.err}`));
            return;
          }

          try {
            console.log("Account creato con successo, effettuo login");
            await this.login(alias, passphrase);
            resolve();
          } catch (error) {
            reject(error);
          } finally {
            this.isAuthenticating = false;
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
   * Logs into GunDB with alias and passphrase
   * @param {string} alias - Account username
   * @param {string} passphrase - Account password
   * @returns {Promise<string>} Public key if login successful
   */
  public async login(alias: string, passphrase: string): Promise<string> {
    try {
      // Se c'è un'autenticazione in corso, aspetta un po' e riprova
      if (this.isAuthenticating) {
        await this.waitForAuth();
        this.user.leave();
        await this.waitForAuth();
      }

      this.isAuthenticating = true;
      console.log("Inizio processo di login per:", alias);

      return new Promise<string>((resolve, reject) => {
        // Se l'utente è già autenticato con le stesse credenziali, restituisci la chiave pubblica
        if (this.user.is?.alias === alias) {
          console.log("Utente già autenticato con le stesse credenziali");
          this.isAuthenticating = false;
          resolve(this.user.is.pub);
          return;
        }

        // Timeout di sicurezza
        const timeoutId = setTimeout(() => {
          this.isAuthenticating = false;
          this.user.leave();
          reject(new Error("Timeout durante l'autenticazione"));
        }, 15000);

        this.user.auth(alias, passphrase, (ack: any) => {
          clearTimeout(timeoutId);

          if (ack.err) {
            this.isAuthenticating = false;
            if (ack.err.includes("being created")) {
              // Se l'utente è in fase di creazione, aspetta e riprova
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
            reject(new Error("Login fallito: chiave pubblica non trovata"));
            return;
          }

          console.log("Login completato con successo");
          this.isAuthenticating = false;
          resolve(this.user.is.pub);
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
      throw new Error("Utente non autenticato");
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
          throw new Error(
            "Impossibile convertire la chiave privata: lunghezza non valida"
          );
        }
        return hex;
      } catch (error) {
        throw new Error(
          "Impossibile convertire la chiave privata: formato non valido"
        );
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
        throw new Error(
          `Impossibile convertire la chiave privata: ${error.message}`
        );
      }
      throw new Error(
        "Impossibile convertire la chiave privata: errore sconosciuto"
      );
    }
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
    console.log(`💾 Salvando wallet per ${publicKey}:`, wallet);

    return new Promise((resolve, reject) => {
      let hasResolved = false;

      const walletData = {
        publicKey: wallet.publicKey,
        entropy: wallet.entropy,
        timestamp: Date.now(),
      };

      console.log("📦 Dati wallet da salvare:", walletData);

      // Salva i dati direttamente
      const node = this.gun.get("wallets").get(publicKey);

      // Salva ogni campo separatamente
      node.get("publicKey").put(walletData.publicKey);
      node.get("entropy").put(walletData.entropy);
      node.get("timestamp").put(walletData.timestamp);

      // Ascolta per confermare il salvataggio
      node.on((data: any) => {
        console.log("📥 Dati ricevuti dopo il salvataggio:", data);
        if (
          data &&
          data.publicKey === wallet.publicKey &&
          data.entropy === wallet.entropy &&
          !hasResolved
        ) {
          console.log("✅ Wallet salvato con successo");
          hasResolved = true;
          resolve();
        }
      });

      setTimeout(() => {
        if (!hasResolved) {
          console.error("⌛ Timeout nel salvataggio del wallet");
          reject(new Error("Timeout nel salvataggio del wallet"));
        }
      }, 25000);
    });
  }

  /**
   * Saves wallet locally using only Gun
   * @param {Wallet} wallet - Wallet to save
   * @param {string} alias - Username associated with wallet
   * @returns {Promise<void>}
   */
  public async saveWalletLocally(wallet: Wallet, alias: string): Promise<void> {
    localStorage.setItem(`wallet_${alias}`, JSON.stringify(wallet));
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
    this.gun
      .get(`stealthKeys/${alias}`)
      .put(stealthKeys)
      .on((data: any) => {
        console.log("✅ Chiavi stealth salvate con successo:", data);
      });
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
   * @param {string} publicKey - User's public key
   * @returns {Promise<Wallet[]>} Array of wallets
   */
  public async retrieveWallets(publicKey: string): Promise<Wallet[]> {
    console.log(`🔄 Recupero wallet per ${publicKey}`);

    return new Promise((resolve, reject) => {
      const wallets: Wallet[] = [];
      let hasResolved = false;

      this.gun
        .get("wallets")
        .get(publicKey)
        .once((data: any) => {
          console.log(`📥 Dati ricevuti:`, data);

          if (!data) {
            console.log("❌ Nessun wallet trovato");
            hasResolved = true;
            resolve([]);
            return;
          }

          try {
            const wallet = new Wallet(data.publicKey, data.entropy);
            console.log("✅ Wallet creato:", wallet);
            wallets.push(wallet);
            hasResolved = true;
            resolve(wallets);
          } catch (error) {
            console.error("❌ Errore nel parsing del wallet:", error);
            reject(error);
          }
        });

      setTimeout(() => {
        if (!hasResolved) {
          console.error("⌛ Timeout nel recupero dei wallet");
          reject(new Error("Timeout nel recupero dei wallet"));
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

  async loginWithPrivateKey(privateKey: string): Promise<string> {
    try {
      // Prima impostiamo il wallet
      this.ethereumManager.setCustomProvider("", privateKey);
      // Poi facciamo il login
      const pubKey = await this.ethereumManager.loginWithEthereum();
      if (!pubKey) {
        throw new Error("Chiave privata non valida");
      }
      return pubKey;
    } catch (error) {
      throw new Error("Chiave privata non valida");
    }
  }
}
