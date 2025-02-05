import { IGunInstance, ISEAPair } from "gun";
import type { ActivityPubKeys } from "../interfaces/ActivityPubKeys";
import { BaseManager } from "./BaseManager";

let cryptoModule: any;
try {
  if (typeof window === "undefined") {
    // Siamo in Node.js
    cryptoModule = require("crypto");
  }
} catch {
  cryptoModule = null;
}

export class ActivityPubManager extends BaseManager<ActivityPubKeys> {
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

      const keys: ActivityPubKeys = {
        publicKey,
        privateKey,
        createdAt: Date.now(),
      };

      await this.saveKeys(keys);

      return keys;
    } catch (error) {
      console.error("Error generating keys:", error);
      throw new Error(
        `Key generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Effettua il login con le credenziali fornite
   */
  public async login(username: string, password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.user.auth(username, password, (ack: any) => {
        if (ack.err) reject(new Error(ack.err));
        else resolve(this.getCurrentPublicKey());
      });
    });
  }

  /**
   * Salva le chiavi ActivityPub
   */
  public async saveKeys(keys: ActivityPubKeys): Promise<void> {
    this.checkAuthentication();
    await this.savePrivateData(keys, "keys");
    await this.savePublicData({ publicKey: keys.publicKey }, "publicKey");
  }

  /**
   * Recupera le chiavi ActivityPub
   */
  public async getKeys(): Promise<ActivityPubKeys> {
    this.checkAuthentication();
    const keys = await this.getPrivateData("keys");
    if (!keys) {
      throw new Error("Keys not found");
    }
    return keys;
  }

  /**
   * Recupera la chiave pubblica ActivityPub
   */
  public async getPub(): Promise<string> {
    this.checkAuthentication();
    const publicKey = this.getCurrentPublicKey();
    const data = await this.getPublicData(publicKey, "publicKey");
    return data?.publicKey;
  }

  /**
   * Elimina le chiavi ActivityPub
   */
  public async deleteKeys(): Promise<void> {
    this.checkAuthentication();
    await this.deletePrivateData("keys");
    await this.deletePublicData("publicKey");
  }

  /**
   * Retrieves the private key for a given username.
   * @param {string} username - The username to retrieve the private key for.
   * @returns {Promise<string>}
   * @throws {Error} - If the username format is invalid or the private key is not found.
   */
  public async getPk(username: string): Promise<string> {
    try {
      // Verify username format
      if (!username || typeof username !== "string") {
        throw new Error("Invalid username format");
      }

      const privateData = await this.getPrivateData("keys"); 
      if (!privateData || !privateData.privateKey) {
        throw new Error("Private key not found");
      }

      if (!this.validateKey(privateData.privateKey)) {
        throw new Error("Invalid key format");
      }

      return privateData.privateKey;
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
    const pemHeader = key.startsWith("-----BEGIN PRIVATE KEY-----");
    const pemFooter = key.includes("-----END PRIVATE KEY-----");
    const keyLength = key.length > 100;
    return pemHeader && pemFooter && keyLength;
  }

  /**
   * Imports a private key from a PEM string.
   * @param {string} pem - The PEM string to import.
   * @returns {Promise<CryptoKey>}
   */
  public async importPk(pem: string) {
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
      // Retrieve the private key
      const privateKey = await this.getPk(username);

      if (!privateKey) {
        throw new Error("Private key not found for user " + username);
      }

      // Convert the PEM key to a usable format
      const cryptoKey = await this.importPk(privateKey);

      // Encode the string to sign
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(stringToSign);

      // Sign the data
      const signatureBuffer = await window.crypto.subtle.sign(
        {
          name: "RSASSA-PKCS1-v1_5",
          hash: { name: "SHA-256" },
        },
        cryptoKey,
        dataBuffer
      );

      // Convert the signature to base64
      const signature = btoa(
        String.fromCharCode(...new Uint8Array(signatureBuffer))
      );

      // Generate the signature header
      const signatureHeader = `keyId="${username}",algorithm="rsa-sha256",signature="${signature}"`;

      return { signature, signatureHeader };
    } catch (error) {
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
    if (typeof window !== "undefined" && window.crypto?.subtle) {
      try {
        const keyPair = await window.crypto.subtle.generateKey(
          {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
            hash: "SHA-256",
          },
          true,
          ["sign", "verify"]
        );

        // Improved function to convert ArrayBuffer to PEM
        const exportKey = async (
          key: CryptoKey,
          type: "public" | "private"
        ) => {
          const format = type === "public" ? "spki" : "pkcs8";
          const exported = await window.crypto.subtle.exportKey(format, key);
          const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
          const wrapped = base64.match(/.{1,64}/g)?.join("\n") || "";
          return `-----BEGIN ${type.toUpperCase()} KEY-----\n${wrapped}\n-----END ${type.toUpperCase()} KEY-----`;
        };

        const [publicKey, privateKey] = await Promise.all([
          exportKey(keyPair.publicKey, "public"),
          exportKey(keyPair.privateKey, "private"),
        ]);

        return { publicKey, privateKey };
      } catch (error) {
        console.error("WebCrypto error:", error);
        throw new Error(
          `Key generation failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    // If we are in Node.js
    if (typeof window === "undefined" && cryptoModule) {
      const { generateKeyPairSync } = cryptoModule;
      return generateKeyPairSync("rsa", {
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
    }

    throw new Error("No cryptographic implementation available");
  }
}
