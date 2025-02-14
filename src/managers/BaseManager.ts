import {
  GunCallbackPut,
  GunMessagePut,
  IGunChain,
  IGunInstance,
  IGunUserInstance,
  ISEAPair,
} from "gun";
import { IGunChainReference } from "../utils/gun/types/chain";
import Firegun from "../db/Firegun2";
import { Ack, FiregunUser } from "../db/common";

/**
 * Interfaccia per le chiavi pubbliche
 */
export interface PublicKeys {
  // Gun public keys
  gun?: {
    pub: string;
    epub: string;
    alias?: string;
    lastSeen?: number;
  };

  // ActivityPub public key
  activityPub?: {
    publicKey: string;
    createdAt: number;
  };

  // Ethereum public data
  ethereum?: {
    address: string;
    timestamp: number;
  };

  // Stealth public key
  stealth?: {
    pub: string;
    epub: string;
  };

  // WebAuthn public data
  webAuthn?: {
    credentialId: string;
    lastUsed: number;
    deviceInfo?: {
      name: string;
      platform: string;
    };
  };
}

/**
 * Interfaccia che raccoglie tutti i tipi di chiavi private supportate
 */
export interface Keys {
  // Gun keys
  gun?: {
    pub: string;
    priv: string;
    epub: string;
    epriv: string;
  };

  // ActivityPub keys
  activityPub?: {
    publicKey: string;
    privateKey: string;
    createdAt: number;
  };

  // Ethereum keys
  ethereum?: {
    address: string;
    privateKey: string;
    entropy?: string;
    timestamp?: number;
  };

  // Stealth keys
  stealth?: {
    pub: string;
    priv: string;
    epub: string;
    epriv: string;
  };

  // WebAuthn keys
  webAuthn?: {
    credentialId: string;
    publicKey: string;
    privateKey: string;
    timestamp: number;
  };
}

/**
 * Classe base astratta per i manager che utilizzano Gun
 */
export abstract class BaseManager<T> {
  protected gun: IGunInstance;
  protected user: IGunUserInstance;
  protected storagePrefix: string;
  protected APP_KEY_PAIR: ISEAPair;
  protected nodesPath: { private: string; public: string } = {
    private: "",
    public: "",
  };
  protected keys: Keys = {};
  protected publicKeys: PublicKeys = {};

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    this.gun = gun;
    this.user = this.gun.user();
    this.APP_KEY_PAIR = APP_KEY_PAIR;
    this.storagePrefix = APP_KEY_PAIR.pub;

    // Inizializza le strutture dati
    this.keys = {};
    this.publicKeys = {};

    // Inizializza i percorsi di default
    this.nodesPath = {
      private: `${this.storagePrefix}/keys`,
      public: `${this.storagePrefix}/public`,
    };
  }

  /**
   * Crea un nuovo account/coppia di chiavi
   */
  public abstract createAccount(...args: any[]): Promise<T>;

  /**
   * Recupera tutte le chiavi pubbliche per un utente
   */
  public async getPublicKeys(pubKey: string): Promise<PublicKeys> {
    const publicKeys: PublicKeys = {};

    try {
      // Recuperiamo tutti i dati pubblici in un'unica query
      const publicData = await this.getPublicData(`~${pubKey}`);
      if (!publicData) return publicKeys;

      // Gun public keys
      if (publicData.gun) {
        publicKeys.gun = {
          pub: publicData.gun.pub,
          epub: publicData.gun.epub,
          alias: publicData.gun.alias,
          lastSeen: publicData.gun.lastSeen,
        };
      }

      // ActivityPub public key
      if (publicData.activityPub) {
        publicKeys.activityPub = {
          publicKey: publicData.activityPub.publicKey,
          createdAt: publicData.activityPub.createdAt,
        };
      }

      // Ethereum public data
      if (publicData.ethereum) {
        publicKeys.ethereum = {
          address: publicData.ethereum.address,
          timestamp: publicData.ethereum.timestamp,
        };
      }

      // Stealth public key
      if (publicData.stealth) {
        publicKeys.stealth = {
          pub: publicData.stealth.pub,
          epub: publicData.stealth.epub,
        };
      }

      // WebAuthn public data
      if (publicData.webAuthn) {
        publicKeys.webAuthn = {
          credentialId: publicData.webAuthn.credentialId,
          lastUsed: publicData.webAuthn.lastUsed,
          deviceInfo: publicData.webAuthn.deviceInfo,
        };
      }
    } catch (error) {
      console.error("Error retrieving public keys:", error);
    }

    return publicKeys;
  }

  /**
   * Salva le chiavi pubbliche dell'utente
   */
  protected async savePublicKeys(): Promise<void> {
    this.checkAuthentication();

    // Prepariamo l'oggetto con i dati pubblici
    const publicData = {
      gun: this.publicKeys.gun,
      activityPub: this.publicKeys.activityPub,
      ethereum: this.publicKeys.ethereum,
      stealth: this.publicKeys.stealth,
      webAuthn: this.publicKeys.webAuthn,
    };

    // Salviamo tutto in un unico nodo
    await this.savePublicData(publicData, `~${this.getCurrentPublicKey()}`);
  }

  /**
   * Aggiorna una specifica chiave pubblica
   */
  protected async updatePublicKey(
    type: keyof PublicKeys,
    data: PublicKeys[keyof PublicKeys]
  ): Promise<void> {
    this.checkAuthentication();

    // Aggiorniamo in memoria
    this.publicKeys[type] = data as any;

    // Salviamo nel database
    await this.savePublicData(
      { [type]: data },
      `~${this.getCurrentPublicKey()}`
    );
  }

  /**
   * Salva i dati in modo privato
   */
  protected async savePrivateData(
    data: T,
    path: string = ""
  ): Promise<IGunChain<any, any, any, string>> {
    this.checkAuthentication();

    try {
      if (!this.user.is) {
        throw new Error("User not properly initialized");
      }

      console.log("Saving private data at path:", path);
      if (typeof data === "object") {
        return new Promise((resolve) => {
          this.user.get(path).set(data as any, (ack: GunMessagePut | GunCallbackPut) => {
            resolve(ack as unknown as IGunChain<any, any, any, string>);
          });
        });
      } else {
        return new Promise((resolve) => {
          this.user.get(path).put(data as any, (ack: GunMessagePut | GunCallbackPut) => {
            resolve(ack as unknown as IGunChain<any, any, any, string>);
          });
        });
      }
    } catch (error) {
      console.error("Error saving private data:", error);
      throw error;
    }
  }

  /**
   * Salva i dati in modo pubblico
   */
  protected async savePublicData(
    data: any,
    path: string = ""
  ): Promise<IGunChain<any, any, any, string>> {
    this.checkAuthentication();

    try {
      console.log("Saving public data at path:", path);
      if (typeof data === "object") {
        return new Promise((resolve) => {
          this.gun.get(path).set(data, (ack) => {
            resolve(ack as unknown as IGunChain<any, any, any, string>);
          });
        });
      } else {
        return new Promise((resolve) => {
          this.gun.get(path).put(data, (ack) => {
            resolve(ack as unknown as IGunChain<any, any, any, string>);
          });
        });
      }
    } catch (error) {
      console.error("Error saving public data:", error);
      throw error;
    }
  }

  /**
   * Recupera i dati privati
   */
  protected async getPrivateData(path: string = ""): Promise<T | null> {
    this.checkAuthentication();

    try {
      console.log("Getting private data from path:", path);

      return new Promise((resolve, reject) => {
        this.user.get(path, (data: any) => {
          if (!data) {
            console.log("Data not found at path:", path);
            reject(null);
          } else {
            resolve(this.processRetrievedData(data));
          }
        });
      });
    } catch (error) {
      console.error("Error in getPrivateData:", error);
      return null;
    }
  }

  /**
   * Processa i dati recuperati convertendo il formato speciale degli array nel formato originale
   */
  protected processRetrievedData<T>(data: any): T {
    if (!data) return data as T;

    // Se i dati hanno il flag _isArray, convertiamo in array
    if (data._isArray) {
      const length = data.length;
      const array: any[] = [];
      for (let i = 0; i < length; i++) {
        if (data[i] !== undefined) {
          const item = this.cleanGunMetadata(data[i]);
          if (item && Object.keys(item).length > 0) {
            array.push(item);
          }
        }
      }
      return array as T;
    }

    // Se è un oggetto, processiamo ricorsivamente le sue proprietà
    if (typeof data === "object") {
      const processed = { ...data };
      for (const key in processed) {
        if (processed[key] && typeof processed[key] === "object") {
          processed[key] = this.processRetrievedData<any>(processed[key]);
        }
      }
      return processed as T;
    }

    return data as T;
  }

  protected cleanGunMetadata<T>(data: any): T {
    if (!data) return data;
    if (typeof data === "object") {
      const cleaned = { ...data };
      delete cleaned._;
      delete cleaned["#"];
      return cleaned;
    }
    return data;
  }

  /**
   * Recupera i dati pubblici
   */
  protected async getPublicData(path: string = ""): Promise<any> {
    const getResult = this.gun.get(path);

    if (getResult === undefined) {
      return null;
    }

    return this.processRetrievedData(getResult);
  }

  /**
   * Elimina i dati privati
   */
  protected async deletePrivateData(path?: string): Promise<IGunChain<any, any, any, string>> {
    this.checkAuthentication();
    return this.user.get(path || "").put(null);
  }

  /**
   * Elimina i dati pubblici
   */
  protected async deletePublicData(path?: string): Promise<IGunChain<any, any, any, string>> {
    this.checkAuthentication();
    return this.gun.get(path || "").put(null);
  }

  protected isNullOrEmpty(data: any): boolean {
    if (data === null || data === undefined) return true;
    if (
      typeof data === "object" &&
      Object.keys(data).filter((k) => k !== "_").length === 0
    )
      return true;
    return false;
  }

  /**
   * Verifica se l'utente è autenticato
   */
  protected isAuthenticated(): boolean {
    return !!(this.user && this.user.is && this.user.is.pub);
  }

  /**
   * Ottiene il public key dell'utente corrente
   */
  protected getCurrentPublicKey(): string {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }
    return this.user.is?.pub || "";
  }

  /**
   * Verifica che l'utente sia autenticato, altrimenti lancia un'eccezione
   */
  protected checkAuthentication(): void {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }
  }

  public cleanup(): void {
    if (this.isAuthenticated()) {
      this.user.leave();
    }
  }

  /**
   * Salva sia le chiavi private che pubbliche
   */
  protected async saveKeys(type: keyof Keys, data: any): Promise<void> {
    this.checkAuthentication();

    try {
      // Aggiorniamo le chiavi private in memoria
      if (!this.keys) {
        this.keys = {};
      }
      this.keys[type] = data;

      // Salviamo le chiavi private
      const privateData = { [type]: data };
      await this.savePrivateData(privateData as T, "keys");

      // Estraiamo e salviamo i dati pubblici
      const publicData = this.extractPublicData(type, data);
      if (publicData) {
        const publicPath = `~${this.getCurrentPublicKey()}`;
        await this.savePublicData({ [type]: publicData }, publicPath);
      }
    } catch (error) {
      console.error("Error in saveKeys:", error);
      throw error;
    }
  }

  /**
   * Estrae i dati pubblici dalle chiavi
   */
  private extractPublicData(type: keyof Keys, data: any): any {
    switch (type) {
      case "activityPub":
        return {
          publicKey: data.publicKey,
          createdAt: data.createdAt,
        };
      // ... altri casi per altri tipi di chiavi
      default:
        return null;
    }
  }
}
