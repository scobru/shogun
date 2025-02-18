import Gun, { IGunInstance, ISEAPair } from "gun";
import type { GunKeyPair } from "../../types/Gun";
import { GunStorage } from "../storage/GunStorage";
import { log } from "../../utils/log";

/**
 * Gestore avanzato dell'autenticazione GunDB
 * 
 * Fornisce un layer sicuro per la gestione di utenti, sessioni e crittografia
 * integrato con il sistema SEA (Security, Encryption, Authorization) di GunDB.
 */
export class GunAuth extends GunStorage<GunKeyPair> {
  /** @internal Timer per il refresh delle credenziali */
  private refreshTimer?: NodeJS.Timeout;
  
  /** @internal Chiave pubblica dell'utente corrente */
  private pub: string = '';
  
  /** @internal Flag di stato dell'autenticazione */
  private isAuthenticating: boolean = false;

  /**
   * Inizializza il gestore di autenticazione
   * @param gun - Istanza GunDB
   * @param APP_KEY_PAIR - Coppia di chiavi SEA dell'applicazione
   */
  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
    this.pub = "";
    this.user = this.gun.user();
  }

  private async resetGunState(): Promise<void> {
    this.isAuthenticating = false;
    this.pub = "";
    this.user.leave();
    await new Promise((r) => setTimeout(r, 2000));

    this.user = this.gun.user();
    await new Promise((r) => setTimeout(r, 1000));

    if (this.user.is) {
      log("User still authenticated after reset, retrying...");
      await new Promise((r) => setTimeout(r, 2000));
      this.user = this.gun.user();
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

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
              await this.resetGunState();

              const userExists = await this.exists(username);
              if (userExists) {
                const pub = await this.getPubFromAlias(username);
                if (pub) {
                  log("User was created successfully, got pub:", pub);
                  return resolve(pub);
                }
              }

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

            log("Waiting for user creation to complete...");

            if (this.user.is?.pub) {
              log("Public key found in user.is:", this.user.is.pub);
              this.pub = this.user.is.pub;
              this.isAuthenticating = false;
              return resolve(this.user.is.pub);
            }

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

  
  public async createAccount(
    alias: string,
    passphrase: string
  ): Promise<GunKeyPair> {
    try {
      await this._hardReset();

      const userExists = await Promise.race([
        this.exists(alias),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout verifica utente")), 5000)
        ),
      ]);

      if (userExists) {
        throw new Error("Username already taken");
      }

      const result = await Promise.race([
        new Promise<GunKeyPair>((resolve, reject) => {
          this.user.create(alias, passphrase, (ack: any) => {
            if (ack.err) {
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
      const peers = ["http://localhost:8765/gun"];

      await this._safeLogout();
      this.user.leave();

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

 
  public logout(): void {
    console.log("*** Logout...");
    this.user.leave();
    this.isAuthenticating = false;
  }

  
  public getPublicKey(): string {
    if (this.pub) return this.pub;
    if (this.user.is?.pub) {
      this.pub = this.user.is.pub;
      return this.pub;
    }
    throw new Error("Utente non autenticato");
  }

  
  public getPair(): GunKeyPair {
    return this.user._.sea as GunKeyPair;
  }

  
  public getGun(): any {
    return this.gun;
  }

  public getUser(): any {
    return this.gun.user();
  }

  
  public async exportGunKeyPair(): Promise<string> {
    if (!this.user._.sea) {
      throw new Error("User not authenticated");
    }
    return JSON.stringify(this.user._.sea);
  }

 
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

  public async savePrivateData(data: any, path: string): Promise<boolean> {
    const maxAttempts = 5;
    let attempts = 0;
    let lastError: Error | null = null;
    
    const verifyAuthentication = async (): Promise<void> => {
      if (!this.user.is) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (!this.user.is) {
          throw new Error("User authentication lost during operation");
        }
      }
    };
    
    while (attempts < maxAttempts) {
      try {
        await verifyAuthentication();
        
        if (!this.user._.sea) {
          await this._hardReset();
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        const processedData = data === undefined || data === null ? {} : data;
        
        await super.savePrivateData(processedData, path);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const savedData = await this.getPrivateData(path);
        
        if (processedData && Object.keys(processedData).length === 0) {
          if (!savedData || Object.keys(savedData).length === 0) {
            return true;
          }
        } else if (this.compareData(savedData, processedData)) {
          return true;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
        }
      } catch (error) {
        lastError = error;
        attempts++;
        console.error(`Save attempt ${attempts} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, 3000 * attempts));
      }
    }
    
    throw lastError || new Error("Failed to save private data after multiple attempts");
  }

  private compareData(a: any, b: any): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      if (aKeys.length !== bKeys.length) return false;
      
      return aKeys.every(key => this.compareData(a[key], b[key]));
    }
    
    return false;
  }

  public async getPrivateData(path: string): Promise<any> {
    if (!this.user._.sea) throw new Error("Utente non autenticato");
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Timeout getting private data"));
      }, 15000);

      this.user
        .get("private")
        .get(this.storagePrefix)
        .get(path)
        .once((data: any) => {
          clearTimeout(timeoutId);
          
          if (data === undefined || data === null) {
            resolve(null);
            return;
          }

          try {
            const cleanedData = this.cleanGunMetadata(data);
            
            if (typeof cleanedData === 'object') {
              resolve(cleanedData);
            } else if (typeof cleanedData === 'string') {
              try {
                resolve(JSON.parse(cleanedData));
              } catch {
                resolve(cleanedData);
              }
            } else {
              resolve(cleanedData);
            }
          } catch (error) {
            console.error("Error processing private data:", error);
            resolve(null);
          }
        });
    });
  }

  protected cleanGunMetadata(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const cleaned = { ...data };
    delete cleaned._;
    
    Object.keys(cleaned).forEach(key => {
      if (cleaned[key] && typeof cleaned[key] === 'object') {
        cleaned[key] = this.cleanGunMetadata(cleaned[key]);
        if (Object.keys(cleaned[key]).length === 0) {
          delete cleaned[key];
        }
      }
    });
    
    return cleaned;
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
