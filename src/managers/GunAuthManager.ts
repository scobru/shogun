import { IGunInstance, IGunUserInstance, ISEAPair } from "gun";
import type { GunKeyPair } from "../interfaces/GunKeyPair";
import { BaseManager } from "./BaseManager";
import { log } from "../utils/log";
import { FiregunUser } from "../db/common";
import { Keys } from "./BaseManager";

interface IGunUser extends IGunUserInstance {
  _: {
    sea: GunKeyPair;
    alias?: string;
    $: any;
    opt: any;
    on: any;
  };
  is?: {
    alias: string | ISEAPair;
    pub: string;
    epub: string;
  };
}

/**
 * Main authentication manager handling GUN.js user operations and SEA (Security, Encryption, Authorization)
 * @class
 * @classdesc Manages decentralized user authentication, data encryption, and secure operations using GUN.js and SEA
 */
export class GunAuthManager extends BaseManager<any> {
  private isAuthenticating = false;
  protected pub: string = "";
  protected alias: string = "";
  protected storagePrefix = "auth";
  declare protected user: IGunUser;

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
  }

  private async resetGunState(): Promise<void> {
    // Reset completo dello stato di Gun
    this.isAuthenticating = false;
    this.pub = "";
    await this.logout();
    await new Promise((r) => setTimeout(r, 2000));

    // Creiamo una nuova istanza di Gun.user()
    this.user = this.gun.user() as IGunUser;
    await new Promise((r) => setTimeout(r, 1000));

    // Verifichiamo che lo stato sia effettivamente resettato
    if (this.isAuthenticated()) {
      log("User still authenticated after reset, retrying...");
      await new Promise((r) => setTimeout(r, 2000));
      this.user = this.gun.user() as IGunUser;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  /**
   * Crea un nuovo utente
   */
  public async createUser(
    username: string,
    password: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.gun.user().create(username, password, (ack: any) => {
        if (ack.err) {
          reject(new Error(ack.err));
        } else {
          // Login dopo la creazione
          this.login(username, password)
            .then((pub) => resolve(pub))
            .catch(reject);
        }
      });
    });
  }

  /**
   * Effettua il login di un utente
   */
  public async login(username: string, password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.user.auth(username, password, (ack: any) => {
        if (ack.err) {
          reject(new Error(ack.err));
        } else {
          // Attendi che l'utente sia completamente autenticato
          let attempts = 0;
          const checkAuth = () => {
            if (this.user._.sea?.pub) {
              this.pub = this.user._.sea.pub;
              resolve(this.pub);
            } else if (attempts++ < 10) {
              setTimeout(checkAuth, 500);
            } else {
              reject(new Error("Authentication timeout"));
            }
          };
          checkAuth();
        }
      });
    });
  }

  /**
   * Verifica se esiste un alias
   */
  public async checkAlias(alias: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.gun.get(`~@${alias}`).once((data: any) => {
        resolve(!!data);
      });
    });
  }

  /**
   * Effettua il login con una coppia di chiavi
   */
  public async loginWithKeys(keyPair: GunKeyPair): Promise<string> {
    return new Promise((resolve, reject) => {
      this.user.auth(keyPair, (ack: any) => {
        if (ack.err) {
          reject(new Error(ack.err));
        } else {
          resolve(keyPair.pub);
        }
      });
    });
  }

  /**
   * Effettua il logout
   */
  public async logout(): Promise<void> {
    this.user.leave();
    this.pub = "";
    this.alias = "";
  }

  /**
   * Ottiene le chiavi dell'utente corrente
   */
  public getKeys(): GunKeyPair {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }
    return this.user._.sea;
  }

  /**
   * Verifica se l'utente è autenticato
   */
  public isAuthenticated(): boolean {
    return !!(this.user && this.user._.sea?.pub);
  }

  /**
   * Ottiene il public key dell'utente corrente
   */
  public getCurrentPub(): string {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }
    return this.user._.sea.pub;
  }


  /**
   * Checks username availability and creates user if available.
   * @param username Desired username.
   * @param password User password.
   * @returns Public key of created user.
   * @throws Error if username is already taken or user creation fails.
   */
  public async checkUser(username: string, password: string): Promise<string> {
    log("Check User...");

    // Reset completo dello stato
    await this.resetGunState();

    const exists = await this.exists(username);
    if (exists) {
      log("User already exists");
      throw new Error("Username already taken");
    }
    log("User does not exist, proceeding with creation...");

    let retryCount = 0;
    const maxRetries = 3;

    const attemptUserCreation = async (): Promise<string> => {
      // Reset dello stato prima di ogni tentativo
      await this.resetGunState();

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.isAuthenticating = false;
          log("User creation timeout");
          reject(new Error("User creation timeout"));
        }, 20000);

        this.gun.user().create(username, password, async (ack: any) => {
          clearTimeout(timeoutId);
          if (ack.err) {
            reject(new Error(ack.err));
            return;
          }

          try {
            await this.login(username, password);
            resolve(this.user._.sea.pub);
          } catch (error) {
            reject(error);
          }
        });
      });
    };

    return attemptUserCreation();
  }

  private async getPubFromAlias(alias: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.gun.get(`~@${alias}`).once((data: any) => {
        if (!data) return resolve(null);
        if ("_" in data) {
          delete data._;
        }
        const keys = Object.keys(data);
        if (keys.length > 0 && keys[0].startsWith("~")) {
          return resolve(keys[0].substring(1));
        }
        return resolve(null);
      });
    });
  }

  /**
   * Creates a new user account with GUN/SEA.
   * @param alias User's username.
   * @param passphrase User's password.
   * @returns Generated SEA key pair for the user.
   */
  public override async createAccount(alias: string, passphrase: string): Promise<GunKeyPair> {
    try {
      // Prima verifichiamo se l'utente esiste
      const exists = await this.exists(alias);
      if (exists) {
        throw new Error("Username already taken");
      }

      // Creiamo l'utente
      return new Promise((resolve, reject) => {
        this.gun.user().create(alias, passphrase, async (ack: any) => {
          if (ack.err) {
            reject(new Error(ack.err));
            return;
          }

          try {
            // Login dopo la creazione
            await this.login(alias, passphrase);
            
            const keys = this.user._.sea;
            await this.saveKeys('gun', {
              pub: keys.pub,
              priv: keys.priv,
              epub: keys.epub,
              epriv: keys.epriv,
              alias: alias,
              lastSeen: Date.now()
            });
            
            resolve(keys);
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      if (error.message === "Username already taken") {
        throw error;
      }
      throw new Error("Creazione account fallita");
    }
  }

  /**
   * Gets current user's public key.
   * @returns User's public key.
   * @throws Error if user is not authenticated.
   */
  public getPublicKey(): string {
    if (this.pub) return this.pub;
    if (this.keys.gun?.pub) {
      this.pub = this.keys.gun.pub;
      return this.pub;
    }
    if (this.user._.sea?.pub) {
      this.pub = this.user._.sea.pub;
      this.keys.gun = {
        pub: this.user._.sea.pub,
        priv: this.user._.sea.priv,
        epub: this.user._.sea.epub,
        epriv: this.user._.sea.epriv
      };
      return this.pub;
    }
    throw new Error("Utente non autenticato");
  }

  /**
   * Gets current user's SEA key pair.
   */
  public getPair(): GunKeyPair {
    return this.keys.gun as GunKeyPair || this.user._.sea;
  }

  /**
   * Gets the GUN instance reference.
   */
  public getGun(): IGunInstance {
    return this.gun;
  }

  /**
   * Gets the user instance.
   */
  public getUser(): IGunUser {
    return this.user;
  }

  /**
   * Exports the current user's key pair as JSON.
   * @returns Stringified key pair.
   * @throws Error if user is not authenticated.
   */
  public async exportGunKeyPair(): Promise<string> {
    this.checkAuthentication();
    return JSON.stringify(this.keys.gun || this.user._.sea);
  }

  /**
   * Imports and authenticates with a key pair.
   * @param keyPairJson Stringified key pair.
   * @returns Public key of authenticated user.
   * @throws Error if key pair is invalid or authentication fails.
   */
  public async importGunKeyPair(keyPairJson: string): Promise<string> {
    let keyPair: GunKeyPair;
    try {
      keyPair = JSON.parse(keyPairJson);
    } catch (error) {
      throw new Error("Error parsing key pair JSON");
    }

    if (!keyPair.pub || !keyPair.priv || !keyPair.epub || !keyPair.epriv) {
      throw new Error("Invalid key pair");
    }

    return this.loginWithKeys(keyPair);
  }

  /**
   * Checks if a user with the specified alias exists.
   */
  public async exists(alias: string): Promise<boolean> {
    log(`Checking existence for alias: ${alias}`);
    if (this.user._.sea?.pub && this.user.is?.alias === alias) {
      log("User is already authenticated with this alias");
      return true;
    }
    return new Promise((resolve) => {
      this.gun.get(`~@${alias}`).once((data: any) => {
        if (!data) {
          log("No data found for alias");
          return resolve(false);
        }
        if (data.put || data.next) {
          log("User exists (complex response)");
          return resolve(true);
        }
        if ("_" in data) {
          delete data._;
        }
        const keys = Object.keys(data);
        const exists =
          keys.length > 0 &&
          (keys[0].startsWith("~") ||
            (typeof data[keys[0]] === "object" && data[keys[0]]?.pub));
        log(`User exists: ${exists}`);
        return resolve(exists);
      });
    });
  }

  /**
   * Initializes the authentication listener.
   */
  public async authListener(): Promise<void> {
    return new Promise((resolve) => {
      log("Initializing authentication listener...");
      this.gun.on("auth", (pub: any) => {
        this.pub = pub;
        log("Authentication listener ready");
        resolve();
      });
      // Se non riceviamo l'evento auth, risolviamo dopo un timeout
      setTimeout(() => {
        log("Auth listener timeout, continuing anyway");
        resolve();
      }, 2000);
    });
  }
}
