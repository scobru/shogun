import { IGunInstance, ISEAPair } from "gun";
import type { ActivityPubKeys } from "../interfaces/ActivityPubKeys";
import { BaseManager } from "./BaseManager";
import { FiregunUser } from "../db/common";

let cryptoModule: any;
try {
  if (typeof window === "undefined") {
    // We're in Node.js
    cryptoModule = require("crypto");
  }
} catch {
  cryptoModule = null;
}

export class ActivityPubManager extends BaseManager<any> {
  protected storagePrefix = "activitypub";

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
  }

  /**
   * Generates a new RSA key pair for ActivityPub.
   * @returns {Promise<ActivityPubKeys>} - The generated key pair.
   * @throws {Error} - If key generation fails.
   */
  public async createAccount(): Promise<ActivityPubKeys> {
    try {
      const { privateKey, publicKey } = await this.generateRSAKeyPair();

      if (!this.validateKey(privateKey) || !this.validateKey(publicKey)) {
        throw new Error("Invalid generated key format");
      }

      const activityPubKeys: ActivityPubKeys = {
        publicKey,
        privateKey,
        createdAt: Date.now(),
      };

      // Salva le chiavi
      await this.saveKeys('activityPub', activityPubKeys);
      
      return activityPubKeys;
    } catch (error) {
      console.error("Error generating ActivityPub keys:", error);
      throw error;
    }
  }

  /**
   * Logs in with the provided credentials
   * @param {string} username - The username to login with
   * @param {string} password - The password to login with
   * @returns {Promise<FiregunUser>} - The authenticated user
   */
  public async login(username: string, password: string): Promise<string> {
    try {
      return new Promise((resolve, reject) => {
        this.user.auth(username, password, (ack: any) => {
          if (ack.err) {
            reject(ack.err);
          } else {
            // Attendi che l'utente sia completamente autenticato
            let attempts = 0;
            const checkAuth = () => {
              if (this.isAuthenticated()) {
                resolve(this.user._.sea.pub);
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
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Retrieves ActivityPub keys
   * @returns {Promise<ActivityPubKeys>} - The stored ActivityPub keys
   * @throws {Error} - If keys are not found
   */
  public async getKeys(): Promise<ActivityPubKeys> {
    this.checkAuthentication();
    
    try {
      // Prima controlliamo se abbiamo le chiavi in memoria
      if (this.keys.activityPub) {
        return this.keys.activityPub;
      }

      // Altrimenti le recuperiamo dal database
      const savedKeys = await this.getPrivateData("keys");
      if (savedKeys?.activityPub) {
        this.keys = savedKeys;
        return this.keys.activityPub as ActivityPubKeys;
      }

      throw new Error("ActivityPub keys not found");
    } catch (error) {
      console.error("Error retrieving ActivityPub keys:", error);
      throw error;
    }
  }

  /**
   * Retrieves the ActivityPub public key
   * @returns {Promise<string>} - The public key
   */
  public async getPub(): Promise<string> {
    this.checkAuthentication();
    
    // Prima controlliamo le chiavi in memoria
    if (this.keys.activityPub?.publicKey) {
      return this.keys.activityPub.publicKey;
    }

    // Altrimenti recuperiamo dal database
    const publicKey = await this.getPublicData("activitypub/publicKey");
    return publicKey?.publicKey;
  }

  /**
   * Deletes ActivityPub keys
   * @returns {Promise<void>}
   */
  public async deleteKeys(): Promise<void> {
    this.checkAuthentication();
    
    // Rimuoviamo le chiavi dalla memoria
    delete this.keys.activityPub;
    
    // Salviamo lo stato aggiornato
    await this.savePrivateData(this.keys, "keys");
    await this.deletePublicData("activitypub/publicKey");
  }

  /**
   * Retrieves the private key for a given username.
   * @param {string} username - The username to retrieve the private key for.
   * @returns {Promise<string>}
   * @throws {Error} - If the username format is invalid or the private key is not found.
   */
  public async getPk(username: string): Promise<string> {
    try {
      // Add stricter validation
      if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        throw new Error(`Invalid username "${username}"`);
      }

      // Modifica: usa il percorso corretto per recuperare le chiavi
      const keys = await this.getPrivateData("activitypub");
      if (!keys || !keys.privateKey) {
        throw new Error("Private key not found for user " + username);
      }

      if (!this.validateKey(keys.privateKey)) {
        throw new Error("Invalid key format for user " + username);
      }

      return keys.privateKey;
    } catch (error) {
      console.error("Error retrieving key:", error);
      throw error;
    }
  }

  /**
   * Validates the format of a given key.
   * @param {string} key - The key to validate.
   * @returns {boolean} - True if the key format is valid, false otherwise.
   */
  private validateKey(key: string): boolean {
    if (!key || typeof key !== "string") {
      return false;
    }

    // For private keys
    if (key.includes("PRIVATE KEY")) {
      return (
        key.includes("-----BEGIN PRIVATE KEY-----") &&
        key.includes("-----END PRIVATE KEY-----") &&
        key.length > 500
      ); // An RSA 2048 key should be longer than this
    }

    // For public keys
    if (key.includes("PUBLIC KEY")) {
      return (
        key.includes("-----BEGIN PUBLIC KEY-----") &&
        key.includes("-----END PUBLIC KEY-----") &&
        key.length > 200
      ); // A public RSA 2048 key should be longer than this
    }

    return false;
  }

  /**
   * Imports a private key from a PEM string.
   * @param {string} pem - The PEM string to import.
   * @returns {Promise<CryptoKey>}
   */
  public async importPk(pem: string): Promise<CryptoKey | string> {
    // If in Node.js, no need to import the key
    if (typeof window === "undefined") {
      return pem;
    }

    // If in browser
    const pemContents = pem
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\n/g, "");

    const binaryDer = Uint8Array.from(atob(pemContents), (c) =>
      c.charCodeAt(0)
    );

    return window.crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" },
      },
      false,
      ["sign"]
    );
  }

  /**
   * Signs ActivityPub data.
   * @param {string} stringToSign - The string to sign.
   * @param {string} username - The username associated with the private key.
   * @returns {Promise<{ signature: string; signatureHeader: string }>}
   * @throws {Error} - If the private key is not found or signing fails.
   */
  public async sign(
    stringToSign: string,
    username: string
  ): Promise<{ signature: string; signatureHeader: string }> {
    try {
      // Retrieve private key
      const privateKey = await this.getPk(username);

      if (!privateKey) {
        throw new Error("Private key not found for user " + username);
      }

      let signature: string;

      // If in Node.js
      if (typeof window === "undefined" && cryptoModule) {
        try {
          const signer = cryptoModule.createSign("RSA-SHA256");
          signer.update(stringToSign);
          signature = signer.sign(privateKey, "base64");
        } catch (error) {
          throw new Error(
            `Private key not found or invalid: ${
              error instanceof Error ? error.message : "unknown error"
            }`
          );
        }
      }
      // If in browser
      else if (typeof window !== "undefined" && window.crypto?.subtle) {
        try {
          // Convert PEM key to usable format
          const cryptoKey = await this.importPk(privateKey);

          if (typeof cryptoKey === "string") {
            throw new Error(
              "Private key not found or invalid format for browser environment"
            );
          }

          // Encode string to sign
          const encoder = new TextEncoder();
          const dataBuffer = encoder.encode(stringToSign);

          // Sign data
          const signatureBuffer = await window.crypto.subtle.sign(
            {
              name: "RSASSA-PKCS1-v1_5",
              hash: { name: "SHA-256" },
            },
            cryptoKey,
            dataBuffer
          );

          // Convert signature to base64
          signature = btoa(
            String.fromCharCode(...new Uint8Array(signatureBuffer))
          );
        } catch (error) {
          throw new Error(
            `Private key not found or invalid: ${
              error instanceof Error ? error.message : "unknown error"
            }`
          );
        }
      } else {
        throw new Error("No cryptographic implementation available");
      }

      // Generate signature header
      const signatureHeader = `keyId="${username}",algorithm="rsa-sha256",signature="${signature}"`;

      return { signature, signatureHeader };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Private key not found")
      ) {
        throw error; // Rethrow original error if about missing private key
      }
      console.error("Error signing ActivityPub data:", error);
      throw new Error(
        `ActivityPub signing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generates an RSA key pair.
   * @returns {Promise<{ publicKey: string; privateKey: string }>}
   * @throws {Error} - If key generation fails.
   */
  private async generateRSAKeyPair(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    try {
      if (typeof window !== "undefined" && window.crypto?.subtle) {
        // Browser implementation
        const keyPair = await window.crypto.subtle.generateKey(
          {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: { name: "SHA-256" },
          },
          true,
          ["sign", "verify"]
        );

        const [publicKeyBuffer, privateKeyBuffer] = await Promise.all([
          window.crypto.subtle.exportKey("spki", keyPair.publicKey),
          window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
        ]);

        return {
          publicKey: this.formatPEM(publicKeyBuffer, "PUBLIC"),
          privateKey: this.formatPEM(privateKeyBuffer, "PRIVATE")
        };
      } else if (cryptoModule) {
        // Node.js implementation
        const { generateKeyPairSync } = cryptoModule;
        const { publicKey, privateKey } = generateKeyPairSync("rsa", {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: "spki",
            format: "pem",
          },
          privateKeyEncoding: {
            type: "pkcs8",
            format: "pem",
          },
        });
        return { publicKey, privateKey };
      }
      throw new Error("No cryptographic implementation available");
    } catch (error) {
      console.error("Error generating RSA key pair:", error);
      throw error;
    }
  }

  /**
   * Converts an ArrayBuffer to a base64 string with line breaks
   * @param {ArrayBuffer} buffer - The buffer to convert
   * @returns {string} - The base64 string with line breaks every 64 characters
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    // Format base64 into 64-character lines
    return base64.match(/.{1,64}/g)?.join("\n") || base64;
  }

  private formatPEM(buffer: ArrayBuffer, type: string): string {
    const base64 = this.arrayBufferToBase64(buffer);
    return `-----BEGIN ${type} KEY-----\n${base64}\n-----END ${type} KEY-----`;
  }
}
