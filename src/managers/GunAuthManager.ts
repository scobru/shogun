import Gun, { IGunInstance, ISEAPair } from "gun";
import type { GunKeyPair } from "../interfaces/GunKeyPair";
import { BaseManager } from "./BaseManager";
import { log } from "../utils/log";

/**
 * Main authentication manager handling GUN.js user operations and SEA (Security, Encryption, Authorization)
 * @class
 * @classdesc Manages decentralized user authentication, data encryption, and secure operations using GUN.js and SEA
 */
export class GunAuthManager extends BaseManager<GunKeyPair> {
  private isAuthenticating = false;
  private pub: string = "";
  protected storagePrefix = "auth";

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
    this.pub = "";
    this.user = this.gun.user();
  }

  private async resetGunState(): Promise<void> {
    // Reset completo dello stato di Gun
    this.isAuthenticating = false;
    this.pub = "";
    this.user.leave();
    await new Promise((r) => setTimeout(r, 2000));

    // Creiamo una nuova istanza di Gun.user()
    this.user = this.gun.user();
    await new Promise((r) => setTimeout(r, 1000));

    // Verifichiamo che lo stato sia effettivamente resettato
    if (this.user.is) {
      log("User still authenticated after reset, retrying...");
      await new Promise((r) => setTimeout(r, 2000));
      this.user = this.gun.user();
      await new Promise((r) => setTimeout(r, 1000));
    }
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

        const handleError = async (error: any) => {
          clearTimeout(timeoutId);
          this.isAuthenticating = false;

          if (
            error.message?.includes(
              "User is already being created or authenticated"
            )
          ) {
            log("User creation in progress, waiting...");

            try {
              // Reset dello stato prima di verificare
              await this.resetGunState();

              // Verifichiamo se l'utente esiste dopo l'attesa
              const userExists = await this.exists(username);
              if (userExists) {
                const pub = await this.getPubFromAlias(username);
                if (pub) {
                  log("User was created successfully, got pub:", pub);
                  return resolve(pub);
                }
              }

              // Se siamo qui e abbiamo ancora tentativi, ritentiamo
              if (retryCount < maxRetries) {
                retryCount++;
                log(`Retry attempt ${retryCount}/${maxRetries}`);
                return resolve(await attemptUserCreation());
              }

              log("User creation failed after all retries");
              return reject(new Error("User creation failed"));
            } catch (retryError) {
              log("Error during retry:", retryError);
              return reject(retryError);
            }
          }
          return reject(error);
        };

        this.user.create(username, password, async (ack: any) => {
          try {
            clearTimeout(timeoutId);
            log("User creation callback received:", ack);

            if (ack.err) {
              return handleError(new Error(ack.err));
            }

            if (ack.ok === 0 && ack.pub) {
              log("User created successfully with pub:", ack.pub);
              this.pub = ack.pub;
              this.isAuthenticating = false;
              return resolve(ack.pub);
            }

            // Attendiamo brevemente per assicurarci che la creazione sia completata
            log("Waiting for user creation to complete...");

            if (this.user.is?.pub) {
              log("Public key found in user.is:", this.user.is.pub);
              this.pub = this.user.is.pub;
              this.isAuthenticating = false;
              return resolve(this.user.is.pub);
            }

            // Verifica se l'utente esiste dopo la creazione
            log("Checking if user exists after creation...");
            const userExists = await this.exists(username);
            if (userExists) {
              log("User found after creation, getting public key...");
              const pub = await this.getPubFromAlias(username);
              if (pub) {
                log("Public key retrieved:", pub);
                this.pub = pub;
                this.isAuthenticating = false;
                return resolve(pub);
              }
              log("Could not retrieve public key");
            } else {
              log("User not found after creation");
            }

            // Se siamo qui e abbiamo ancora tentativi, ritentiamo
            if (retryCount < maxRetries) {
              retryCount++;
              log(`Retry attempt ${retryCount}/${maxRetries}`);
              return resolve(await attemptUserCreation());
            }

            this.isAuthenticating = false;
            log("User creation failed");
            return reject(new Error("User creation failed"));
          } catch (error) {
            return handleError(error);
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
  public async createAccount(
    alias: string,
    passphrase: string
  ): Promise<GunKeyPair> {
    try {
      // Reset completo dello stato prima di ogni tentativo
      await this._hardReset();

      // Verifica esistenza utente con timeout
      const userExists = await Promise.race([
        this.exists(alias),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout verifica utente")), 5000)
        ),
      ]);

      if (userExists) {
        // Se l'utente esiste, non ritentiamo - è un errore legittimo
        throw new Error("Username already taken");
      }

      // Creazione account con timeout
      const result = await Promise.race([
        new Promise<GunKeyPair>((resolve, reject) => {
          this.user.create(alias, passphrase, (ack: any) => {
            if (ack.err) {
              // Se l'errore indica che l'utente esiste, non ritentiamo
              if (
                ack.err.includes("already created") ||
                ack.err.includes("already taken")
              ) {
                return reject(new Error("Username already taken"));
              }
              return reject(new Error(ack.err));
            }
            resolve(this.user._.sea);
          });
        }),
      ]);

      return result;
    } catch (error) {
      // Se l'errore è "Username already taken", non ritentiamo
      if (
        error instanceof Error &&
        error.message === "Username already taken"
      ) {
        throw error;
      }
    }

    throw new Error(`Creazione account fallita`);
  }

  private async _hardReset(): Promise<void> {
    try {
      // Modifica qui: usa l'istanza originale invece di gun.back
      const peers = ["http://localhost:8765/gun"];

      await this._safeLogout();
      this.user.leave();

      // Ricarica l'istanza GUN con i peer originali
      this.gun = Gun({
        peers: peers, // Usa la lista peers salvata
        localStorage: false,
        radisk: false,
      });

      this.user = this.gun.user();
    } catch (error) {
      console.error("Errore durante l'hard reset:", error);
    }
  }

  /**
   * Authenticates user with provided credentials.
   * @param alias User's username.
   * @param passphrase User's password.
   * @param attempt (Optional) Current attempt number (for retry).
   * @returns User's public key.
   * @throws Error on authentication failure or timeout.
   */
  public async login(
    alias: string,
    passphrase: string
  ): Promise<string | null> {
    console.info("*** Login...");

    if (this.user.is?.pub) {
      console.log(" --- User already authenticated, logging out...");
      this.logout();
    }

    console.info("*** Authenticating...");

    try {
      const result = await new Promise<string | null>((resolve, reject) => {
        this.user.auth(alias, passphrase, (ack: any) => {
          if (ack.err) {
            if (ack.err.includes("Wrong user or password")) {
              console.info("*** Wrong user or password.");
              reject(new Error(ack.err));
            } else if (
              ack.err.includes("User is already being created or authenticated")
            ) {
              console.info(
                "*** User is already being created or authenticated."
              );
              resolve(this.user.is?.pub || null);
            } else {
              reject(new Error(ack.err));
            }
          } else if (ack.sea) {
            console.info("*** User authenticated:", this.user.is);
            resolve(this.user.is?.pub || null);
          } else {
            reject(new Error("Unknown authentication response"));
          }
        });
      });

      console.info("*** Login result:", result);
      return result;
    } catch (error) {
      console.error("*** Login error:", error);
      throw error;
    }
  }

  /**
   * Terminates the current user session.
   */
  public logout(): void {
    console.log("*** Logout...");
    this.user.leave();
    this.isAuthenticating = false;
  }

  /**
   * Gets current user's public key.
   * @returns User's public key.
   * @throws Error if user is not authenticated.
   */
  public getPublicKey(): string {
    if (this.pub) return this.pub;
    if (this.user.is?.pub) {
      this.pub = this.user.is.pub;
      return this.pub;
    }
    throw new Error("Utente non autenticato");
  }

  /**
   * Gets current user's SEA key pair.
   */
  public getPair(): GunKeyPair {
    return this.user._.sea as GunKeyPair;
  }

  /**
   * Gets the GUN instance reference.
   */
  public getGun(): any {
    return this.gun;
  }

  public getUser(): any {
    return this.gun.user();
  }

  /**
   * Exports the current user's key pair as JSON.
   * @returns Stringified key pair.
   * @throws Error if user is not authenticated.
   */
  public async exportGunKeyPair(): Promise<string> {
    if (!this.user._.sea) {
      throw new Error("User not authenticated");
    }
    return JSON.stringify(this.user._.sea);
  }

  /**
   * Imports and authenticates with a key pair.
   * @param keyPairJson Stringified key pair.
   * @returns Public key of authenticated user.
   * @throws Error if key pair is invalid or authentication fails.
   */
  public async importGunKeyPair(keyPairJson: string): Promise<string> {
    let keyPair: any;
    try {
      keyPair = JSON.parse(keyPairJson);
    } catch (error) {
      throw new Error("Error parsing key pair JSON");
    }

    if (!keyPair.pub || !keyPair.priv || !keyPair.epub || !keyPair.epriv) {
      throw new Error("Invalid key pair");
    }

    try {
      const pub = await this.user.auth(keyPair);
      return pub;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Unknown error during key pair import"
      );
    }
  }

  /**
   * Saves private user data.
   * @param data Data to store.
   * @param path Storage path.
   * @returns True if data was saved successfully, false otherwise.
   * @throws Error if user is not authenticated.
   */
  public async savePrivateData(data: any, path: string): Promise<boolean> {
    if (!this.user.is) throw new Error("Utente non autenticato");
    return await super.savePrivateData(data, path);
  }

  /**
   * Retrieves private user data.
   * @param path Storage path.
   * @returns Stored data.
   * @throws Error if user is not authenticated.
   */
  public async getPrivateData(path: string): Promise<any> {
    if (!this.user._.sea) throw new Error("Utente non autenticato");
    const user = this.gun.user();
    return new Promise((resolve, reject) => {
      user
        .get("private")
        .get(this.storagePrefix)
        .get(path)
        .once((data: any) => {
          if (data === undefined || data === null) {
            resolve(null);
          } else {
            // Rimuoviamo i metadati di Gun
            const cleanedData = this.cleanGunMetadata(data);
            
            // Se i dati sono un oggetto, convertiamoli in stringa JSON
            if (typeof cleanedData === 'object') {
              resolve(JSON.stringify(cleanedData));
            } else if (typeof cleanedData === 'string') {
              resolve(cleanedData);
            } else {
              resolve(JSON.stringify(cleanedData));
            }
          }
        });
    });
  }

  /**
   * Saves public user data for the authenticated user.
   * @param data Data to store.
   * @param path Storage path.
   * @throws Error if user is not authenticated.
   */
  public async savePublicData(data: any, path: string): Promise<boolean> {
    if (!this.user.is) throw new Error("Utente non autenticato");
    return await super.savePublicData(data, path);
  }

  /**
   * Retrieves public user data of a given user.
   * @param publicKey Public key of the user whose data to retrieve.
   * @param path Storage path.
   * @returns Stored data.
   */
  public async getPublicData(publicKey: string, path: string): Promise<any> {
    if (!this.user.is) throw new Error("Utente non autenticato");
    return await this.getPublicData(publicKey, path);
  }

  /**
   * Elimina i dati privati
   */
  public async deletePrivateData(path: string): Promise<void> {
    await super.deletePrivateData(path);
  }

  /**
   * Elimina i dati pubblici
   */
  public async deletePublicData(path: string): Promise<void> {
    await super.deletePublicData(path);
  }

  /**
   * Checks if a user with the specified alias exists.
   * @param alias Username to check.
   * @returns True if the user exists, false otherwise.
   */
  public async exists(alias: string): Promise<boolean> {
    log(`Checking existence for alias: ${alias}`);
    if (this.user.is && this.user.is.alias === alias) {
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
      this.user.on("auth", (pub: any) => {
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

  /**
   * Safely logs out the user ensuring session termination.
   */
  private async _safeLogout(): Promise<void> {
    try {
      await this.resetGunState();
    } catch (error) {
      log("Logout error:", error);
      // Resettiamo comunque lo stato
      this.isAuthenticating = false;
      this.pub = "";
      this.user = this.gun.user();
    }
  }

  /**
   * Checks if the current user is authenticated.
   * @returns True if authenticated, false otherwise.
   */
  public isAuthenticated(): boolean {
    return !!this.user.is;
  }
}
