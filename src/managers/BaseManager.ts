import { IGunInstance, IGunUserInstance, ISEAPair } from "gun";

/**
 * Classe base astratta per i manager che utilizzano Gun
 */
export abstract class BaseManager<T> {
  protected gun: IGunInstance;
  protected user: IGunUserInstance;
  protected storagePrefix: string;
  protected APP_KEY_PAIR: ISEAPair;

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    this.gun = gun;
    this.user = this.gun.user();
    this.storagePrefix = APP_KEY_PAIR.pub;
    this.APP_KEY_PAIR = APP_KEY_PAIR;
  }

  /**
   * Crea un nuovo account/coppia di chiavi
   */
  public abstract createAccount(...args: any[]): Promise<T>;

  /**
   * Salva i dati in modo privato
   */
  protected async savePrivateData(data: T, path: string = ""): Promise<void> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    return new Promise((resolve, reject) => {
      this.user
        .get("private")
        .get(path)
        .put(data, (ack: any) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
    });
  }

  /**
   * Salva i dati in modo pubblico
   */
  protected async savePublicData(data: any, path: string = ""): Promise<void> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    return new Promise((resolve, reject) => {
      this.gun
        .get(`~${this.storagePrefix}`)
        .get("public")
        .get(path)
        .put(data, (ack: any) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
    });
  }

  /**
   * Recupera i dati privati
   */
  protected async getPrivateData(path: string = ""): Promise<T | null> {
    if (!this.user._.sea) {
      throw new Error("User not authenticated");
    }

    return new Promise((resolve) => {
      this.user
        .get("private")
        .get(path)
        .once((data: any) => {
          resolve(data);
        });
    });
  }

  /**
   * Recupera i dati pubblici
   */
  protected async getPublicData(publicKey: string, path: string = ""): Promise<any> {
    return new Promise((resolve) => {
      this.gun
        .get(`~${this.storagePrefix}`)
        .get("public")
        .get(path)
        .once((data: any) => {
          resolve(data);
        });
    });
  }

  /**
   * Elimina i dati privati
   */
  protected async deletePrivateData(path: string = ""): Promise<void> {
    await this.savePrivateData(null as any, path);
  }

  /**
   * Elimina i dati pubblici
   */
  protected async deletePublicData(path: string = ""): Promise<void> {
    await this.savePublicData(null, path);
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

  /**
   * Pulisce le risorse
   */
  public cleanup(): void {
    if (this.user) {
      this.user.leave();
    }
  }
}
