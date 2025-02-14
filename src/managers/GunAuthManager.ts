import { IGunInstance, ISEAPair } from "gun";
import type { FiregunUser, GunKeyPair } from "../db/common";
import { BaseManager } from "./BaseManager";
import { log } from "../utils/log";
import Firegun from "../db/Firegun2";

/**
 * Main authentication manager handling GUN.js user operations and SEA (Security, Encryption, Authorization)
 * @class
 * @classdesc Manages decentralized user authentication, data encryption, and secure operations using GUN.js and SEA
 */
export class GunAuthManager extends BaseManager<Record<string, any>> {
  private isAuthenticating = false;
  protected storagePrefix = "auth";
  private currentPub: string = "";

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
  }

  private async resetGunState(): Promise<void> {
    this.isAuthenticating = false;
    await this.logout();
    await new Promise((r) => setTimeout(r, 2000));
    this.user = this.firegun.user;
  }

  /**
   * Effettua il login di un utente
   */
  public async login(username: string, password: string): Promise<string> {
    try {
      const result = await this.firegun.userLogin(username, password);
      if ('err' in result) {
        throw new Error(result.err);
      }
      this.user = result;
      return result.pair.pub;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Verifica se esiste un alias
   */
  public async checkAlias(alias: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.firegun.Get(`~@${alias}`).then((data: any) => {
        resolve(!!data);
      });
    });
  }

  /**
   * Effettua il login con una coppia di chiavi
   */
  public async loginWithKeys(keyPair: GunKeyPair): Promise<string> {
    const result = await this.firegun.loginPair(keyPair);
    if ('err' in result) {
      throw new Error(result.err);
    }
    this.user = result;
    return result.pair.pub;
  }

  /**
   * Effettua il logout
   */
  public async logout(): Promise<void> {
    try {
      await this.firegun.userLogout();
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }

  /**
   * Ottiene le chiavi dell'utente corrente
   */
  public getKeys(): GunKeyPair {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }
    return this.user.pair;
  }

  /**
   * Verifica se l'utente è autenticato
   */
  public isAuthenticated(): boolean {
    return !!(this.user && this.user.pair && this.user.pair.pub);
  }

  /**
   * Ottiene il public key dell'utente corrente
   */
  public getCurrentPub(): string {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }
    return this.user.pair.pub;
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

    const attemptUserCreation = async (): Promise<string> => {
      // Reset dello stato prima di ogni tentativo
      await this.resetGunState();

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.isAuthenticating = false;
          log("User creation timeout");
          reject(new Error("User creation timeout"));
        }, 20000);

        this.firegun.userNew(username, password).then((user: FiregunUser) => {
          resolve(user.pair.pub);
        }).catch(reject);
      });
    };

    return attemptUserCreation();
  }

  private async getPubFromAlias(alias: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.firegun.Get(`~@${alias}`).then((data: any) => {
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
  public async createAccount(alias: string, passphrase: string): Promise<GunKeyPair> {
    try {
      const result = await this.firegun.userNew(alias, passphrase);
      if ('err' in result) {
        throw new Error(result.err);
      }
      return result.pair;
    } catch (error) {
      if (error.message === "Username already taken") {
        throw error;
      }
      throw new Error("Account creation failed");
    }
  }

  /**
   * Gets current user's public key.
   * @returns User's public key.
   * @throws Error if user is not authenticated.
   */
  public getPublicKey(): string {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }
    return this.user.pair.pub;
  }

  /**
   * Gets current user's SEA key pair.
   */
  public getPair(): GunKeyPair {
    return (this.keys.gun as GunKeyPair) || this.user.pair;
  }

  /**
   * Gets the GUN instance reference.
   */
  public getGun(): Firegun {
    return this.firegun;
  }

  /**
   * Gets the user instance.
   */
  public getUser(): FiregunUser {
    return this.user;
  }

  /**
   * Exports the current user's key pair as JSON.
   * @returns Stringified key pair.
   * @throws Error if user is not authenticated.
   */
  public async exportGunKeyPair(): Promise<string> {
    this.checkAuthentication();
    return JSON.stringify(this.user.pair);
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
    if (this.user.pair.pub && this.user.alias === alias) {
      log("User is already authenticated with this alias");
      return true;
    }
    return new Promise((resolve) => {
      this.firegun.Get(`~@${alias}`).then((data: any) => {
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
      this.firegun.On("auth", (pub: any) => {
        this.currentPub = pub;
        log("Authentication listener ready");
        resolve();
      });
      setTimeout(() => {
        log("Auth listener timeout, continuing anyway");
        resolve();
      }, 2000);
    });
  }
}
