/**
 * The GunDB class provides an interface to interact with the Gun decentralized database.
 * It handles user authentication, data storage, and retrieval operations.
 */
import Gun from "gun";
import "gun/sea";
import { IGunInstance, IGunUserInstance } from "gun/types";

interface WalletPathsData {
  paths?: string[] | Record<string, string>;
  [key: string]: any;
}

class GunDB {
  public gun: IGunInstance<any>;

  /**
   * Initializes the GunDB instance.
   * @constructor
   */
  constructor(peers: string[] = ["http://localhost:8765/gun"]) {
    console.log("Initializing GunDB...");
    // Initialize GUN
    this.gun = new Gun({
      peers: peers, // You can modify this with your peers
      localStorage: false,
      radisk: false,
    });
    console.log("GunDB initialized");
  }


  async createGunUser(username: string, password: string) {
    console.log("Creating Gun user:", username);
    return new Promise((resolve, reject) => {
      this.gun.user().create(username, password, (ack) => {
        console.log("Response to Gun user creation:", ack);
        if ("err" in ack) {
          console.error("Error creating Gun user:", ack.err);
          reject(new Error(ack.err));
        } else {
          console.log("Gun user created, proceeding with authentication");
          // After creation, perform login
          this.gun.user().auth(username, password, (ack) => {
            console.log("Response to Gun user authentication:", ack);
            if ("err" in ack) {
              console.error("Error authenticating Gun user:", ack.err);
              reject(new Error(ack.err));
            } else {
              console.log("Gun user created and authenticated successfully");
              resolve(ack);
            }
          });
        }
      });
    });
  }

  async authenticateGunUser(username: string, password: string) {
    console.log("Authenticating Gun user:", username);
    return Promise.race([
      new Promise((resolve, reject) => {
        // Verifica preliminare dello stato dell'utente
        const user = this.gun.user();
        if (user.is) {
          console.log("Utente già autenticato, effettuo logout...");
          user.leave();
        }

        this.gun.user().auth(username, password, (ack) => {
          console.log("Response to Gun user authentication:", ack);
          if ("err" in ack) {
            console.error("Error authenticating Gun user:", ack.err);
            reject(new Error(ack.err));
          } else {
            console.log("Gun user authenticated successfully");
            // Verifica che l'utente sia effettivamente autenticato
            const user = this.gun.user() as any;
            const pair = user._.sea;
            console.log("Gun user status after authentication:", {
              is: user.is,
              pair: pair ? "present" : "missing",
            });
            
            if (!user.is) {
              reject(new Error('Autenticazione fallita: utente non autenticato'));
              return;
            }
            
            if (!pair) {
              reject(new Error('Autenticazione fallita: chiavi mancanti'));
              return;
            }

            resolve(ack);
          }
        });
      }),
      // Timeout dopo 5 secondi
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout durante l\'autenticazione')), 5000)
      )
    ]);
  }

  /**
   * Creates a Gun user with a key pair for MetaMask or WebAuthn.
   * @param {string} username - The username for the new user.
   * @returns {Promise<{pair: any, ack: GunAck}>} A promise that resolves with the key pair and authentication acknowledgment.
   */
  async createGunUserWithPair(
    username: string
  ): Promise<{ pair: any; ack: any }> {
    console.log("Creating Gun user with key pair for:", username);
    return new Promise(async (resolve, reject) => {
      // Generate a random key pair for Gun
      const pair = await Gun.SEA.pair();
      console.log("Generated key pair:", pair);

      this.gun.user().auth(pair, (ack: any) => {
        console.log("Response to authentication with key pair:", ack);
        if (ack.err) {
          console.error("Error authenticating with key pair:", ack.err);
          reject(new Error(ack.err));
        } else {
          console.log("Gun user created with key pair");
          const user = this.gun.user() as any;
          console.log("Gun user status after authentication with key pair:", {
            is: user.is,
            pair: user._.sea,
          });
          resolve({ pair, ack });
        }
      });
    });
  }

  /**
   * Authenticates a Gun user with an existing key pair.
   * @param {Object} pair - The key pair to use for authentication.
   * @returns {Promise<GunAck>} A promise that resolves with the authentication acknowledgment.
   */
  async authenticateGunUserWithPair(pair: any): Promise<any> {
    console.log("Authenticating Gun user with key pair");
    return new Promise<any>((resolve, reject) => {
      this.gun.user().auth(pair, (ack: any) => {
        console.log("Response to authentication with key pair:", ack);
        if (ack.err) {
          console.error("Error authenticating with key pair:", ack.err);
          reject(new Error(ack.err));
        } else {
          console.log("Gun user authenticated with key pair");
          // Verify that the user is actually authenticated
          const user = this.gun.user() as any;
          console.log("Gun user status after authentication with key pair:", {
            is: user.is,
            pair: user._.sea,
          });
          resolve(ack);
        }
      });
    });
  }

  /**
   * Logs out the current Gun user.
   */
  logout(): void {
    console.log("Logging out Gun user");
    this.gun.user().leave();
    console.log("Gun logout completed");
  }

  /**
   * Writes data to Gun under a specified table and primary key.
   * @param {string} tableName - The name of the table to write to.
   * @param {string} primaryKey - The primary key for the data.
   * @param {Object} data - The data to be written.
   * @returns {Promise<any>} A promise that resolves with the written data including a timestamp.
   */
  async writeToGun(
    tableName: string,
    primaryKey: string,
    data: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!primaryKey) {
        reject(new Error("Invalid primary key"));
        return;
      }

      // Add a timestamp to avoid conflicts
      const dataWithTimestamp = {
        ...data,
        _timestamp: Date.now(),
      };

      this.gun
        .get(tableName)
        .get(primaryKey)
        .put(dataWithTimestamp, (ack: any) => {
          if (ack.err) {
            reject(ack.err);
          } else {
            console.log("Document written successfully!");
            resolve(dataWithTimestamp);
          }
        });
    });
  }

  /**
   * Creates a document in Gun if it does not already exist.
   * @param {string} tableName - The name of the table to write to.
   * @param {string} primaryKey - The primary key for the data.
   * @param {Object} data - The data to be written.
   * @returns {Promise<any>} A promise that resolves with the written data.
   * @throws {Error} If the document already exists or if the primary key is invalid.
   */
  async createIfNotExists(
    tableName: string,
    primaryKey: string,
    data: any
  ): Promise<any> {
    if (!primaryKey) {
      throw new Error("Invalid primary key");
    }

    try {
      // First check if the document exists
      const existing = await new Promise<any>((resolve) => {
        this.gun
          .get(tableName)
          .get(primaryKey)
          .once((data: any) => {
            resolve(data);
          });
      });

      // If the document exists and has valid data
      if (
        existing &&
        Object.keys(existing).filter((k) => k !== "_" && k !== "#").length > 0
      ) {
        console.log("Existing document:", existing);
        throw new Error(`Document already exists for key ${primaryKey}`);
      }

      // If the document does not exist or has no valid data, proceed with writing
      return this.writeToGun(tableName, primaryKey, data);
    } catch (e) {
      if (e instanceof Error && e.message.includes("already exists")) {
        throw e;
      }
      // If the error is not due to the document's existence, try to write
      return this.writeToGun(tableName, primaryKey, data);
    }
  }

  /**
   * Reads a record from Gun using a lookup key.
   * @param {string} tableName - The name of the table to read from.
   * @param {Object} obj - An object containing the lookup key.
   * @param {string} obj.lookupKey - The key to look up the record.
   * @returns {Promise<any>} A promise that resolves with the found data.
   * @throws {Error} If the lookup key is invalid or the document is not found.
   */
  async readRecordFromGun(
    tableName: string,
    obj: { lookupKey: string }
  ): Promise<any> {
    if (!obj || !obj.lookupKey) {
      throw new Error("Invalid lookup key");
    }

    return new Promise((resolve, reject) => {
      this.gun
        .get(tableName)
        .get(obj.lookupKey)
        .once((data: any) => {
          // Check if the document exists and has valid data
          if (
            data &&
            Object.keys(data).filter((k) => k !== "_" && k !== "#").length > 0
          ) {
            resolve(data);
          } else {
            reject(new Error("Document not found"));
          }
        });
    });
  }

  /**
   * Saves wallet paths for a user.
   * @param {string} userpub - The user's public key to save the paths for.
   * @param {Array} paths - The wallet paths to save.
   * @returns {Promise<void>} A promise that resolves when the paths are saved.
   * @throws {Error} If the userpub is invalid or if there's an error saving the paths.
   */
  async saveWalletPaths(userpub: string, paths: any): Promise<void> {
    try {
      // Verify that userpub is a valid non-empty string
      if (!userpub || typeof userpub !== "string" || userpub.trim() === "") {
        throw new Error("Invalid user public key");
      }

      await this.writeToGun("WalletPaths", userpub.trim(), paths);
      console.log("Wallet paths saved successfully!");
    } catch (e) {
      console.error("Error saving paths:", e);
      throw e;
    }
  }

  /**
   * Retrieves wallet paths for a user.
   * @param {string} userpub - The user's public key to retrieve the paths for.
   * @returns {Promise<Array>} A promise that resolves with an array of wallet paths.
   * @throws {Error} If the userpub is invalid.
   */
  async getWalletPaths(userpub: string): Promise<string[]> {
    try {
      // Verify that userpub is a valid non-empty string
      if (!userpub || typeof userpub !== "string" || userpub.trim() === "") {
        throw new Error("Invalid user public key");
      }

      const data = await new Promise<WalletPathsData>((resolve, reject) => {
        this.gun
          .get("WalletPaths")
          .get(userpub.trim())
          .once((data: any) => {
            if (!data) {
              reject(new Error("No paths found for this user"));
              return;
            }
            resolve(data);
          });
      });

      // Check if data.paths exists before processing it
      if (!data || !data.paths) {
        console.log("No wallet paths found for the user");
        return [];
      }

      // Ensure paths are in a valid format
      const paths = Array.isArray(data.paths)
        ? data.paths
        : Object.values(data.paths);
      return paths.length ? (paths as string[]) : [];
    } catch (e) {
      console.error("Error retrieving paths:", e);
      return [];
    }
  }

  /**
   * Saves wallet addresses for a user.
   * @param {string} userpub - The user's public key to save the addresses for.
   * @param {Array} addresses - The wallet addresses to save.
   * @returns {Promise<void>} A promise that resolves when the addresses are saved.
   * @throws {Error} If the userpub is invalid or if there's an error saving the addresses.
   */
  async saveWalletAddresses(
    userpub: string,
    addresses: string[]
  ): Promise<void> {
    try {
      await this.writeToGun("WalletAddresses", userpub, { addresses });
    } catch (e) {
      console.error("Error saving wallet addresses:", e);
      throw e;
    }
  }

  /**
   * Retrieves wallet addresses for a user.
   * @param {string} userpub - The user's public key to retrieve the addresses for.
   * @returns {Promise<Array>} A promise that resolves with an array of wallet addresses.
   * @throws {Error} If the userpub is invalid or if there's an error retrieving the addresses.
   */
  async getWalletAddresses(userpub: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      this.gun
        .get("WalletAddresses")
        .get(userpub)
        .once((data: any) => {
          if (!data) {
            reject(new Error("No wallet addresses found for this user"));
            return;
          }
          resolve(data.addresses || []);
        });
    });
  }
}

declare global {
  interface Window {
    GunDB: typeof GunDB;
  }
  namespace NodeJS {
    interface Global {
      GunDB: typeof GunDB;
    }
  }
}

if (typeof window !== "undefined") {
  window.GunDB = GunDB;
} else if (typeof global !== "undefined") {
  (global as any).GunDB = GunDB;
}

export { GunDB };
export default GunDB;
