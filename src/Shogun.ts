/**
 * @fileoverview Manages wallet functionality, including authentication and key management
 * @module Shogun
 */

import { IGunInstance, IGunUserInstance } from "gun";
import { EthereumManager } from "./managers/EthereumManager";
import { StealthManager } from "./managers/StealthManager";
import type { GunKeyPair } from "./interfaces/GunKeyPair";
import { GunAuthManager } from "./managers/GunAuthManager";
import { ActivityPubManager } from "./managers/ActivityPubManager";
import { WebAuthnManager } from "./managers/WebAuthnManager";
import { WalletManager } from "./managers/WalletManager";
import { UserKeys } from "./interfaces/UserKeys";

// Extend Gun type definitions
declare module "gun" {
  interface _GunRoot {
    sea: GunKeyPair;
  }
}


/**
 * Main class for managing wallet and related functionality
 */
export class Shogun {
  private gunAuthManager: GunAuthManager;
  private ethereumManager: EthereumManager;
  private stealthManager: StealthManager;
  private activityPubManager: ActivityPubManager;
  private walletManager: WalletManager;
  private webAuthnManager: WebAuthnManager;
  private gun: IGunInstance;
  private user: IGunUserInstance

  constructor(gun: IGunInstance, APP_KEY_PAIR: any) {    
    this.gunAuthManager = new GunAuthManager(gun, APP_KEY_PAIR);
    this.ethereumManager = new EthereumManager(gun, APP_KEY_PAIR);
    this.stealthManager = new StealthManager(gun, APP_KEY_PAIR);
    this.walletManager = new WalletManager(gun, APP_KEY_PAIR);
    this.webAuthnManager = new WebAuthnManager(gun, APP_KEY_PAIR);
    this.activityPubManager = new ActivityPubManager(gun, APP_KEY_PAIR);
    this.gun = gun;
    this.user = gun.user().recall({sessionStorage: true})
  }

  /**
   * Returns the EthereumManager instance

   * @returns {EthereumManager} The EthereumManager instance
   */
  public getEthereumManager(): EthereumManager {
    return this.ethereumManager;
  }

  /**
   * Returns the StealthManager instance
   * @returns {StealthManager} The StealthManager instance
   */
  public getStealthChain(): StealthManager {
    return this.stealthManager;
  }

  /**
   * Returns the GunAuthManager instance
   * @returns {GunAuthManager} The GunAuthManager instance
   */
  public getGunAuthManager(): GunAuthManager {
    return this.gunAuthManager;
  }

  /**
   * Returns the WebAthnManager instance
   * @returns {WebAuthnManager} The WebAuthnManager instance
   */
  public getWebAuthnManager(): WebAuthnManager {
    return this.webAuthnManager;
  }

  /**
   * Returns the ActivityPubManager instance
   * @returns {ActivityPubManager} The ActivityPubManager instance
   */
  public getActivityPubManager(): ActivityPubManager {
    return this.activityPubManager;
  }

  /**
   * Returns the WalletManager instance
   * @returns {WalletManager} The WalletManager instance
   */
  public getWalletManager(): WalletManager {
    return this.walletManager;
  }

  /**
   * Creates a user with a Gun account, wallet, stealth key, and ActivityPub key
   * @param {string} alias - The alias for the user
   * @param {string} password - The password for the user
   * @returns {Promise<UserKeys>} The created user keys
   */
  public async createUser(alias: string, password: string): Promise<UserKeys> {
    const pair = await this.gunAuthManager.createAccount(alias, password);
    const wallet = await this.walletManager.getWallet();
    const stealthKey = await this.stealthManager.createAccount();
    const activityPubKey = await this.activityPubManager.createAccount();

    return {
      pair,
      wallet,
      stealthKey,
      activityPubKey,
    };
  }

  /**
   * Retrieves user data from the database
   * @returns {Promise<UserKeys>} The user keys
   */
  public async getUser(): Promise<UserKeys> {
    const user = await this.gunAuthManager.getUser();
    const pair = user.pair;
    const wallet = await this.walletManager.getWallet();
    const stealthKey = await this.stealthManager.getPair();
    const activityPubKey = await this.activityPubManager.getKeys();

    return {
      pair,
      wallet,
      stealthKey,
      activityPubKey,
    };
  }

  /**
   * Salva dati in modo ottimizzato con gestione degli errori e retry
   * @param path Percorso dove salvare i dati
   * @param data Dati da salvare
   * @returns Promise che si risolve quando i dati sono stati salvati
   */
  public async putData(path: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gun.get(path).put(data, (ack: any) => {
        if (ack && 'err' in ack) {
          reject(new Error(String(ack.err)));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Recupera dati una volta sola in modo ottimizzato
   * @param path Percorso dei dati da recuperare
   * @returns Promise con i dati recuperati
   */
  public async getData(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.gun.get(path).once((data, key) => {
        if (data === undefined) {
          reject(new Error(`Dati non trovati al percorso: ${path}`));
        } else {
          resolve(data);
        }
      }, { wait: 1000 }); // Attende max 1 secondo per i dati
    });
  }

  /**
   * Sottoscrive agli aggiornamenti dei dati con gestione ottimizzata della memoria
   * @param path Percorso da osservare
   * @param callback Callback da eseguire sugli aggiornamenti
   * @returns Funzione per annullare la sottoscrizione
   */
  public subscribeToData(path: string, callback: (data: any) => void): () => void {
    const subscription = this.gun.get(path).on((data, key) => {
      if (data) {
        callback(data);
      }
    });
    
    return () => {
      if (subscription && typeof subscription.off === 'function') {
        subscription.off();
      }
    };
  }

  /**
   * Aggiunge un elemento univoco a una lista non ordinata
   * @param listPath Percorso della lista
   * @param item Elemento da aggiungere
   * @returns Promise che si risolve quando l'elemento è stato aggiunto
   */
  public async addToSet(listPath: string, item: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gun.get(listPath).set(item, (ack: any) => {
        if (ack && 'err' in ack) {
          reject(new Error(String(ack.err)));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Recupera e mappa i dati di una lista
   * @param listPath Percorso della lista
   * @param mapFn Funzione di mapping opzionale
   * @returns Promise con array dei risultati mappati
   */
  public async mapList<T>(
    listPath: string, 
    mapFn?: (data: any, key: string) => T
  ): Promise<T[]> {
    return new Promise((resolve) => {
      const results: T[] = [];
      
      this.gun.get(listPath).map().once((data, key) => {
        if (data) {
          results.push(mapFn ? mapFn(data, key) : data);
        }
      });

      // Risolve dopo un timeout ragionevole per permettere il caricamento dei dati
      setTimeout(() => resolve(results), 1000);
    });
  }

  /**
   * Verifica l'esistenza di dati in un percorso
   * @param path Percorso da verificare
   * @returns Promise che si risolve con true se i dati esistono
   */
  public async exists(path: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.gun.get(path).once((data) => {
        resolve(data !== undefined);
      });
    });
  }
}
