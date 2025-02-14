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
export abstract class BaseManager<T extends Record<string, any>> {
  protected gun: IGunInstance;
  protected firegun: Firegun;
  protected user: FiregunUser;
  protected storagePrefix: string;
  protected APP_KEY_PAIR: ISEAPair;
  protected nodesPath: { private: string; public: string };
  protected keys: Keys;
  protected publicKeys: PublicKeys;

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    this.gun = gun;
    this.firegun = new Firegun({ gunInstance: gun });
    this.user = this.firegun.user;
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

    // Ascolta gli eventi di autenticazione
    this.firegun.On("auth", () => {
      this.user = this.firegun.user;
    });
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
  protected async savePrivateData(data: T, path: string = ""): Promise<any> {
    this.checkAuthentication();

    try {
      if (!this.user.alias) {
        throw new Error("User not properly initialized");
      }

      console.log("Saving private data at path:", path);
      
      return await this.firegun.userSet(path, data);
    } catch (error) {
      console.error("Error saving private data:", error);
      throw error;
    }
  }

  /**
   * Salva i dati in modo pubblico
   */
  protected async savePublicData(data: any, path: string = ""): Promise<any> {
    this.checkAuthentication();

    try {
      console.log("Saving public data at path:", path);
      if (typeof data === "object") {
        return await this.firegun.Set(path, data);
      } else {
        return await this.firegun.Put(path, data);
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
      const data = await this.firegun.Get(path);
      if (!data) {
        console.log("Data not found at path:", path);
        return null;
      }
      return this.processRetrievedData(data);
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
    const data = await this.firegun.Get(path);
    if (!data) return null;
    return this.processRetrievedData(data);
  }

  /**
   * Elimina i dati privati
   */
  protected async deletePrivateData(path?: string): Promise<void> {
    this.checkAuthentication();
    
    try {
      // Prima otteniamo i dati per verificare che esistano
      const existingData = await this.getPrivateData(path || "");
      if (!existingData) {
        console.log("No data to delete");
        return;
      }

      // Eliminiamo i dati
      await this.firegun.userDel(path || "");
      console.log("Data deletion command sent");

      // Aspettiamo un po' per la propagazione
      await this.waitForOperation(2000);

      // Verifichiamo che i dati siano stati eliminati
      try {
        const checkData = await this.getPrivateData(path || "");
        if (checkData) {
          throw new Error("Data was not properly deleted");
        }
        console.log("Data deletion verified");
      } catch (error) {
        // Se getPrivateData lancia un errore, significa che i dati non esistono più
        console.log("Data deletion completed");
      }
    } catch (error) {
      if (error.message === "Data was not properly deleted") {
        throw error;
      }
      // Ignoriamo gli errori di "notfound" perché significano che i dati sono stati eliminati
      if (error?.err === "notfound") {
        console.log("Data deletion completed (not found)");
        return;
      }
      throw error;
    }
  }

  protected async waitForOperation(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Elimina i dati pubblici
   */
  protected async deletePublicData(path?: string): Promise<void> {
    this.checkAuthentication();
    
    try {
      // Prima verifichiamo che i dati esistano
      const existingData = await this.getPublicData(path || "");
      if (!existingData) {
        console.log("No public data to delete");
        return;
      }

      // Eliminiamo i dati
      await this.firegun.Del(path || "");
      console.log("Public data deletion command sent");

      // Aspettiamo un po' per la propagazione
      await this.waitForOperation(2000);

      // Verifichiamo che i dati siano stati eliminati
      try {
        const checkData = await this.getPublicData(path || "");
        if (checkData) {
          throw new Error("Public data was not properly deleted");
        }
        console.log("Public data deletion verified");
      } catch (error) {
        // Se getPublicData lancia un errore, significa che i dati non esistono più
        console.log("Public data deletion completed");
      }
    } catch (error) {
      if (error.message === "Public data was not properly deleted") {
        throw error;
      }
      // Ignoriamo gli errori di "notfound" perché significano che i dati sono stati eliminati
      if (error?.err === "notfound") {
        console.log("Public data deletion completed (not found)");
        return;
      }
      throw error;
    }
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
  public isAuthenticated(): boolean {
    return !!(this.user && this.user.alias && this.user.pair && this.user.pair.pub);
  }

  /**
   * Ottiene il public key dell'utente corrente
   */
  protected getCurrentPublicKey(): string {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }
    return this.user.alias || "";
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
      this.firegun.userLogout();
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

      console.log("Saving keys:", privateData);

      // Estraiamo e salviamo i dati pubblici
      const publicData = await this.extractPublicData(type, data);

      console.log("Saving public keys:", publicData);

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
      case "gun":
        return {
          pub: data.pub,
          epub: data.epub,
          alias: data.alias,
          lastSeen: data.lastSeen,
        };
      case "ethereum":
        return {
          address: data.address,
          timestamp: data.timestamp,
        };
      case "stealth":
        return {
          pub: data.pub,
          epub: data.epub,
        };
      case "webAuthn":
        return {
          credentialId: data.credentialId,
          lastUsed: data.lastUsed,
          deviceInfo: data.deviceInfo,
        };
      default:
        return null;
    }
  }

  protected setUser(user: FiregunUser): void {
    this.user = user;
    this.firegun.user = user;
  }
}
