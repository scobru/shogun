import { IGunInstance, IGunUserInstance, ISEAPair } from "gun";

/**
 * Classe base astratta per i manager che utilizzano Gun
 */
export abstract class BaseManager<T> {
  protected gun: IGunInstance;
  protected user: IGunUserInstance;
  protected abstract storagePrefix: string;
  protected APP_KEY_PAIR: ISEAPair;

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    this.gun = gun;
    this.user = this.gun.user();
    this.APP_KEY_PAIR = APP_KEY_PAIR;
  }

  /**
   * Crea un nuovo account/coppia di chiavi
   */
  public abstract createAccount(...args: any[]): Promise<T>;

  /**
   * Salva i dati in modo privato
   */
  protected async savePrivateData(data: T, path: string = ""): Promise<boolean> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }
    const processedData = Array.isArray(data)
      ? {
          _isArray: true,
          length: data.length,
          ...data.reduce((acc: any, item: any, index: number) => {
            acc[index] = item;
            return acc;
          }, {}),
        }
      : data;

    return new Promise<boolean>((resolve, reject) => {
      const node = this.user.get("private").get(this.storagePrefix).get(path);
      node.put(processedData, (ack: any) => {
        if (ack.err) {
          reject(new Error(ack.err));
        }
        resolve(true);
      });
    });
  }

  /**
   * Salva i dati in modo pubblico
   */
  protected async savePublicData(data: any, path: string = ""): Promise<boolean> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    const publicKey = this.user.is.pub;
    if (!publicKey) {
      throw new Error("Public key not found");
    }

    return new Promise((resolve, reject) => {
      this.gun
        .get(`~${publicKey}`)
        .get("public")
        .get(this.storagePrefix)
        .get(path)
        .put(data, (ack: any) => {
          if (ack.err) {
            reject(new Error(ack.err));
          } else {
            resolve(true);
          }
        });
    });
  }

  /**
   * Recupera i dati privati
   */
  protected async getPrivateData(path: string = ""): Promise<T | null> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    return new Promise((resolve, reject) => {
      this.user
        .get("private")
        .get(this.storagePrefix)
        .get(path)
        .once((data: any) => {
          resolve(this.cleanGunMetadata(data));
        });
    });
  }

  /**
   * Recupera i dati pubblici
   */
  protected async getPublicData(publicKey: string, path: string = ""): Promise<any> {
    return new Promise((resolve, reject) => {
      this.gun
        .get(`~${publicKey}`)
        .get("public")
        .get(this.storagePrefix)
        .get(path)
        .once((data: any) => {
          resolve(this.cleanGunMetadata(data));
        });
    });
  }

  /**
   * Elimina i dati privati
   */
  protected async deletePrivateData(path: string = ""): Promise<boolean> {
    return this.savePrivateData(null as any, path);
  }

  /**
   * Elimina i dati pubblici
   */
  protected async deletePublicData(path: string = ""): Promise<boolean> {
    return this.savePublicData(null, path);
  }

  
  protected cleanGunMetadata<T>(data: any): T {
    if (!data) return data;
    if (typeof data === "object") {
      const cleaned = { ...data };
      delete cleaned._;
      return cleaned;
    }
    return data;
  }

  protected isNullOrEmpty(data: any): boolean {
    if (data === null || data === undefined) return true;
    if (typeof data === "object" && Object.keys(data).filter(k => k !== "_").length === 0) return true;
    return false;
  }

  /**
   * Verifica se l'utente è autenticato
   */
  protected isAuthenticated(): boolean {
    return !!this.user.is;
  }

  /**
   * Ottiene il public key dell'utente corrente
   */
  protected getCurrentPublicKey(): string {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }
    return this.user.is.pub;
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
    if (this.user) {
      this.user.leave();
    }
  }
}
