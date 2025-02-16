/**
 * @fileoverview Manages wallet functionality, including authentication and key management
 * @module Shogun
 */

import Gun, { IGunInstance, IGunUserInstance } from "gun";
import "gun/sea";
import { JsonRpcConnector } from "./blockchain/connectors/JsonRpcConnector";
import { StealthChain } from "./protocol/stealth/StealthChain";
import type { GunKeyPair } from "./types/GunKeyPair";
import { GunAuth } from "./core/auth/GunAuth";
import { ActivityPub } from "./protocol/activitypub/ActivityPub";
import { WebauthnAuth } from "./core/auth/WebauthnAuth";
import { EthereumHDKeyVault } from "./blockchain/wallets/EthereumHDKeyVault";
import { UserKeys } from "./types/UserKeys";
import { Wallet } from "ethers";

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
  private gunAuth: GunAuth;
  private ethereumConnector: JsonRpcConnector;
  private stealthChain: StealthChain;
  private activityPub: ActivityPub;
  private ethereumWalletGenerator: EthereumHDKeyVault;
  private webAuthnManager: WebauthnAuth;
  private gun: IGunInstance;
  private user: IGunUserInstance

  constructor(gun: IGunInstance, APP_KEY_PAIR: any) {
    this.gunAuth = new GunAuth(gun, APP_KEY_PAIR);
    this.ethereumConnector = new JsonRpcConnector(gun, APP_KEY_PAIR);
    this.stealthChain = new StealthChain(gun, APP_KEY_PAIR);
    this.ethereumWalletGenerator = new EthereumHDKeyVault(gun, APP_KEY_PAIR);
    this.webAuthnManager = new WebauthnAuth(gun, APP_KEY_PAIR);
    this.activityPub = new ActivityPub(gun, APP_KEY_PAIR);
    this.gun = gun;
    this.user = gun.user().recall({ sessionStorage: true })
  }

  /**
   * Returns the EthereumManager instance

   * @returns {EthereumManager} The EthereumManager instance
   */
  public getEthereumConnector(): JsonRpcConnector {
    return this.ethereumConnector;
  }

  /**
   * Returns the StealthManager instance
   * @returns {StealthManager} The StealthManager instance
   */
  public getStealthChain(): StealthChain {
    return this.stealthChain;
  }

  /**
   * Returns the GunAuthManager instance
   * @returns {GunAuthManager} The GunAuthManager instance
   */
  public getGunAuth(): GunAuth {
    return this.gunAuth;
  }

  /**
   * Returns the WebAthnManager instance
   * @returns {WebAuthnManager} The WebAuthnManager instance
   */
  public getWebAuthnManager(): WebauthnAuth {
    return this.webAuthnManager;
  }

  /**
   * Returns the ActivityPubManager instance
   * @returns {ActivityPubManager} The ActivityPubManager instance
   */
  public getActivityPub(): ActivityPub {
    return this.activityPub;
  }

  /**
   * Returns the WalletManager instance
   * @returns {WalletManager} The WalletManager instance
   */
  public getEthereumWalletGenerator(): EthereumHDKeyVault {
    return this.ethereumWalletGenerator;
  }

  /**
   * Returns the legacy wallet instance
   * @returns {Promise<Wallet>} The legacy wallet instance
   */
  public async getLegacyWallet(): Promise<Wallet> {
    return this.ethereumWalletGenerator.getLegacyWallet();
  }

  /**
   * Returns the wallet instance
   * @returns {Promise<Wallet>} The wallet instance
   */
  public async getWallet(): Promise<Wallet> {
    return this.ethereumWalletGenerator.getWallet();
  }

  /**
   * Returns the wallet instance by address
   * @param {string} address - The address of the wallet
   * @returns {Promise<Wallet>} The wallet instance
   */
  public async getWalletByAddress(address: string): Promise<Wallet | null> {
    return this.ethereumWalletGenerator.getWalletByAddress(address);
  }

  /**
   * Returns the wallet instance by index
   * @param {number} index - The index of the wallet
   * @returns {Promise<Wallet>} The wallet instance
   */
  public async getWalletByIndex(index: number): Promise<Wallet> {
    return this.ethereumWalletGenerator.getWalletByIndex(index);
  }

  /**
   * Creates a user with a Gun account, wallet, stealth key, and ActivityPub key
   * @param {string} alias - The alias for the user
   * @param {string} password - The password for the user
   * @returns {Promise<UserKeys>} The created user keys
   */
  public async createUser(alias: string, password: string): Promise<UserKeys> {
    const pair = await this.gunAuth.createAccount(alias, password);
    const wallet = await this.ethereumWalletGenerator.getWallet();
    const stealthKey = await this.stealthChain.createAccount();
    const activityPubKey = await this.activityPub.createAccount();

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
    const user = await this.gunAuth.getUser();
    const pair = user._.sea;
    const wallet = await this.ethereumWalletGenerator.getWallet();
    const stealthKey = await this.stealthChain.getPair();
    const activityPubKey = await this.activityPub.getKeys();

    return {
      pair,
      wallet,
      stealthKey,
      activityPubKey,
    };
  }

  /**
   * Returns the Gun user instance
   * @returns {IGunUserInstance} The Gun user instance
   */
  public async getGunUser(): Promise<IGunUserInstance> {
    return this.user;
  }

  /**
   * Returns the Gun instance
   * @returns {IGunInstance} The Gun instance
   */
  public async getGun(): Promise<IGunInstance> {
    return this.gun;
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
