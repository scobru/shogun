/**
 * @fileoverview Manages wallet functionality, including authentication and key management
 * @module WalletManager
 */

import Gun from "gun";
import "gun/sea";
import "gun/lib/webrtc"; // Abilita WebRTC in GunDB
import "gun/lib/radisk";
import "gun/lib/axe";


import { Wallet } from "./interfaces/Wallet";
import { EthereumManager } from "./EthereumManager";
import { StealthChain } from "./StealthChain";
import type { GunKeyPair } from "./interfaces/GunKeyPair";
import { PasskeyManager } from "./PasskeyManager";


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
  protected gun: any; // Temporaneamente usando any per far funzionare i test
  private user: any;
  private ethereumManager: EthereumManager;
  private stealthChain: StealthChain;
  private passkeyManager: PasskeyManager | null = null;
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

    try {
      this.passkeyManager = new PasskeyManager();
    } catch (error) {
      console.warn("Passkey non supportate in questo browser:", error);
    }
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
          const error = new Error("Timeout durante la creazione dell'account");
          if (callback) callback(error);
          reject(error);
        }, 30000); // Aumentato a 30 secondi

        this.user.create(alias, passphrase, async (ack: any) => {
          try {
            if (ack.err) {
              this.isAuthenticating = false;
              if (
                ack.err.includes("already created") ||
                ack.err.includes("being created")
              ) {
                console.log(
                  "Account già esistente o in fase di creazione, attendo..."
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
                `Errore durante la creazione dell'account: ${ack.err}`
              );
              if (callback) callback(error);
              reject(error);
              return;
            }

            console.log("Account creato con successo, effettuo login");
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
        }, 30000); // Aumentato a 30 secondi

        this.user.auth(alias, passphrase, (ack: any) => {
          try {
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

  /**
   * Retrieves wallet from local storage
   * @param {string} alias - Username associated with wallet
   * @returns {Promise<Wallet | null>} Retrieved wallet or null if not found
   */
  public async retrieveWalletLocally(alias: string): Promise<Wallet | null> {
    const walletData = localStorage.getItem(`wallet_${alias}`);
    if (!walletData) {
      return null;
    }
    try {
      const parsed = JSON.parse(walletData);
      return new Wallet(parsed.publicKey, parsed.entropy);
    } catch (error) {
      console.error("Errore nel recupero del wallet locale:", error);
      return null;
    }
  }

  /**
   * Exports the current Gun key pair
   * @returns {Promise<string>} Exported key pair as JSON string
   * @throws {Error} If user is not authenticated
   */
  public async exportGunKeyPair(): Promise<string> {
    if (!this.user._.sea) {
      throw new Error("Utente non autenticato");
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
        throw new Error("Coppia di chiavi non valida");
      }

      return new Promise((resolve, reject) => {
        this.user.auth(keyPair, (ack: any) => {
          if (ack.err) {
            reject(new Error(`Errore nell'autenticazione: ${ack.err}`));
            return;
          }
          if (!this.user.is?.pub) {
            reject(new Error("Autenticazione fallita: chiave pubblica non trovata"));
            return;
          }
          resolve(this.user.is.pub);
        });
      });
    } catch (error) {
      throw new Error(`Errore nell'importazione della coppia di chiavi: ${error instanceof Error ? error.message : 'errore sconosciuto'}`);
    }
  }

  /**
   * Checks if there are locally saved data for a user
   * @param {string} alias - Username to check
   * @returns {Promise<{hasWallet: boolean, hasStealthKeys: boolean, hasPasskey: boolean}>} Object indicating what data exists
   */
  public async checkLocalData(alias: string): Promise<{
    hasWallet: boolean,
    hasStealthKeys: boolean,
    hasPasskey: boolean
  }> {
    const walletData = localStorage.getItem(`wallet_${alias}`);
    const stealthData = localStorage.getItem(`stealthKeys_${alias}`);
    const passkeyData = localStorage.getItem(`passkey_${alias}`);
    
    return {
      hasWallet: walletData !== null,
      hasStealthKeys: stealthData !== null,
      hasPasskey: passkeyData !== null
    };
  }

  /**
   * Clears all local data for a user
   * @param {string} alias - Username whose data should be cleared
   * @returns {Promise<void>}
   */
  public async clearLocalData(alias: string): Promise<void> {
    localStorage.removeItem(`wallet_${alias}`);
    localStorage.removeItem(`stealthKeys_${alias}`);
    localStorage.removeItem(`passkey_${alias}`);
  }

  /**
   * Exports all user data (wallet, stealth keys, and Gun pair) as a single JSON
   * @param {string} alias - Username whose data should be exported
   * @returns {Promise<string>} JSON string containing all user data
   */
  public async exportAllData(alias: string): Promise<string> {
    if (!this.user._.sea) {
      throw new Error("Utente non autenticato");
    }

    const wallet = await this.retrieveWalletLocally(alias);
    const stealthKeys = await this.stealthChain.retrieveStealthKeysLocally(alias).catch(() => null);
    const gunPair = this.user._.sea;

    const exportData = {
      wallet: wallet,
      stealthKeys: stealthKeys,
      gunPair: gunPair,
      timestamp: Date.now(),
      version: "1.0"
    };

    return JSON.stringify(exportData);
  }

  /**
   * Imports all user data from a JSON export
   * @param {string} jsonData - JSON string containing user data
   * @param {string} alias - Username to associate with the imported data
   * @returns {Promise<void>}
   */
  public async importAllData(jsonData: string, alias: string): Promise<void> {
    try {
      const importData = JSON.parse(jsonData);
      
      // Verifica versione e struttura
      if (!importData.version || !importData.timestamp) {
        throw new Error("Formato dati non valido");
      }

      // Importa Gun pair e autentica
      if (importData.gunPair) {
        await this.importGunKeyPair(JSON.stringify(importData.gunPair));
      }

      // Salva wallet se presente
      if (importData.wallet) {
        await this.saveWalletLocally(importData.wallet, alias);
      }

      // Salva stealth keys se presenti
      if (importData.stealthKeys) {
        await this.stealthChain.saveStealthKeysLocally(alias, importData.stealthKeys);
      }
    } catch (error) {
      throw new Error(`Errore nell'importazione dei dati: ${error instanceof Error ? error.message : 'errore sconosciuto'}`);
    }
  }

  /**
   * Crea un account usando Passkey
   * @param {string} alias - Username per l'account
   * @returns {Promise<void>}
   */
  public async createAccountWithPasskey(alias: string): Promise<void> {
    if (!this.passkeyManager) {
      throw new Error("Passkey non supportate in questo browser");
    }

    try {
      // 1. Registra la Passkey
      const passkeyData = await this.passkeyManager.registerPasskey(alias);

      // 2. Crea l'account Gun
      await new Promise<void>((resolve, reject) => {
        // Genera una password casuale sicura
        const passphrase = crypto.randomUUID();
        
        this.user.create(alias, passphrase, async (ack: any) => {
          if (ack.err) {
            reject(new Error(`Errore nella creazione dell'account: ${ack.err}`));
            return;
          }

          // Login con la password generata
          try {
            await this.login(alias, passphrase);
            
            // Salva le chiavi Gun criptate con la Passkey
            const manager = this.passkeyManager;
            if (manager && this.user._.sea) {
              await manager.encryptAndSaveGunKeys(
                alias,
                this.user._.sea
              );
            }

            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      throw new Error(`Errore nella creazione dell'account con Passkey: ${error}`);
    }
  }

  /**
   * Login usando Passkey
   * @param {string} alias - Username dell'account
   * @returns {Promise<string>} Public key
   */
  public async loginWithPasskey(alias: string): Promise<string> {
    if (!this.passkeyManager) {
      throw new Error("Passkey non supportate in questo browser");
    }

    try {
      // 1. Verifica la Passkey e ottieni le chiavi Gun
      const gunKeys = await this.passkeyManager.verifyAndGetKeys(alias);

      // 2. Login con le chiavi Gun
      return new Promise((resolve, reject) => {
        this.user.auth(gunKeys, (ack: any) => {
          if (ack.err) {
            reject(new Error(`Errore nel login: ${ack.err}`));
            return;
          }
          if (!this.user.is?.pub) {
            reject(new Error("Login fallito: chiave pubblica non trovata"));
            return;
          }
          resolve(this.user.is.pub);
        });
      });
    } catch (error) {
      throw new Error(`Errore nel login con Passkey: ${error}`);
    }
  }

  /**
   * Verifica se le Passkey sono supportate
   * @returns {boolean} true se le Passkey sono supportate
   */
  public isPasskeySupported(): boolean {
    return !!this.passkeyManager;
  }
}
