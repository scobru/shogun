import { IGunInstance, ISEAPair } from "gun";
import type { ActivityPubKeys } from "../interfaces/ActivityPubKeys";
import { BaseManager } from "./BaseManager";
import { GunAuthManager } from "./GunAuthManager";

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
  protected authManager: GunAuthManager;

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
    
    try {
      // Salva i dati privati con retry
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log("Tentativo di salvataggio chiavi private...");
          await this.savePrivateData(keys, this.storagePrefix);
          
          console.log("Tentativo di salvataggio chiave pubblica...");
          await this.savePublicData({ publicKey: keys.publicKey }, this.storagePrefix);
          
          // Aggiungi un delay per permettere a Gun di sincronizzare
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verifica il salvataggio
          console.log("Verifica del salvataggio...");
          const savedKeys = await this.getPrivateData(this.storagePrefix);
          console.log("Chiavi salvate:", savedKeys ? "presenti" : "assenti");
          
          if (savedKeys) {
            const keysMatch = savedKeys.publicKey === keys.publicKey && 
                            savedKeys.privateKey === keys.privateKey;
            console.log("Corrispondenza chiavi:", keysMatch ? "OK" : "Non corrispondenti");
            
            if (keysMatch) {
              console.log("Salvataggio completato con successo");
              return;
            }
          }
          
          console.log(`Retry ${retryCount + 1}: Verifica fallita, riprovo...`);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Retry ${retryCount + 1} fallito:`, error);
          retryCount++;
          if (retryCount === maxRetries) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      throw new Error("Impossibile verificare il salvataggio delle chiavi dopo " + maxRetries + " tentativi");
    } catch (error) {
      console.error("Errore nel salvataggio delle chiavi:", error);
      throw error;
    }
  }

  /**
   * Recupera le chiavi ActivityPub
   */
  public async getKeys(): Promise<ActivityPubKeys> {
    this.checkAuthentication();
    const keys = await this.getPrivateData(this.storagePrefix);

    // Rimuovi i metadati di Gun
    const cleanKeys: ActivityPubKeys = {
      publicKey: keys?.publicKey || "",
      privateKey: keys?.privateKey || "",
      createdAt: keys?.createdAt || Date.now()
    };

    return cleanKeys;
  }

  /**
   * Recupera la chiave pubblica ActivityPub
   */
  public async getPub(): Promise<string> {
    this.checkAuthentication();
    const publicKey = this.getCurrentPublicKey();
    const data = await this.getPublicData(publicKey, this.storagePrefix);
    return data?.publicKey;
  }

  /**
   * Elimina le chiavi ActivityPub
   */
  public async deleteKeys(): Promise<void> {
    this.checkAuthentication();
    
    try {
      const publicKey = this.getCurrentPublicKey();
      
      // Prima eliminiamo i dati pubblici
      await this.deletePublicData(this.storagePrefix);
      
      // Poi eliminiamo i dati privati
      await this.deletePrivateData(this.storagePrefix);
      
      // Attendi un po' prima di iniziare la verifica
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const verifyDeletion = async (): Promise<boolean> => {
        try {
          // Verifica dati privati
          const privateData = await this.getPrivateData(this.storagePrefix);
          if (privateData && Object.keys(privateData).length > 0) {
            return false;
          }
          
          // Verifica dati pubblici
          const publicData = await this.getPublicData(publicKey, this.storagePrefix);
          if (publicData && Object.keys(publicData).length > 0) {
            return false;
          }
          
          return true;
        } catch (error) {
          // Se otteniamo un errore "Keys not found", consideriamo la cancellazione riuscita
          if (error.message === "Keys not found") {
            return true;
          }
          return false;
        }
      };

      // Verifica con timeout più lungo
      const startTime = Date.now();
      const timeout = 60000; // 60 secondi
      const interval = 2000; // 2 secondi tra i tentativi

      while (Date.now() - startTime < timeout) {
        if (await verifyDeletion()) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      
      throw new Error("Failed to verify keys deletion");
    } catch (error) {
      console.error("Error deleting keys:", error);
      throw error;
    }
  }

  /**
   * Retrieves the private key for a given username.
   * @param {string} username - The username to retrieve the private key for.
   * @returns {Promise<string>}
   * @throws {Error} - If the username format is invalid or the private key is not found.
   */
  public async getPk(username: string): Promise<string> {
    try {
      // Aggiungi controllo più rigoroso
      if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        throw new Error(`Username "${username}" non valido`);
      }

      const privateData = await this.getPrivateData(`activitypub/keys`); // Path specifico per utente
      if (!privateData || !privateData.privateKey) {
        throw new Error("Private key not found for user " + username);
      }

      if (!this.validateKey(privateData.privateKey)) {
        throw new Error("Invalid key format for user " + username);
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
    if (!key || typeof key !== "string") {
      return false;
    }

    // Per le chiavi private
    if (key.includes("PRIVATE KEY")) {
      return key.includes("-----BEGIN PRIVATE KEY-----") &&
             key.includes("-----END PRIVATE KEY-----") &&
             key.length > 500;  // Una chiave RSA 2048 dovrebbe essere più lunga di questo
    }

    // Per le chiavi pubbliche
    if (key.includes("PUBLIC KEY")) {
      return key.includes("-----BEGIN PUBLIC KEY-----") &&
             key.includes("-----END PUBLIC KEY-----") &&
             key.length > 200;  // Una chiave pubblica RSA 2048 dovrebbe essere più lunga di questo
    }

    return false;
  }

  /**
   * Imports a private key from a PEM string.
   * @param {string} pem - The PEM string to import.
   * @returns {Promise<CryptoKey>}
   */
  public async importPk(pem: string): Promise<CryptoKey | string> {
    // Se siamo in Node.js, non serve importare la chiave
    if (typeof window === "undefined") {
      return pem;
    }

    // Se siamo nel browser
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
  public async sign(stringToSign: string, username: string): Promise<{ signature: string; signatureHeader: string }> {
    try {
      // Verifica formato username
      if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        throw new Error(`Username "${username}" non valido`);
      }

      // Verifichiamo solo che l'utente sia autenticato
      this.checkAuthentication();
      
      // Recuperiamo le chiavi direttamente
      const keys = await this.getKeys();
      if (!keys || !keys.privateKey) {
        throw new Error(`Username "${username}" non valido`);
      }

      let signature: string;

      // Se siamo in Node.js
      if (typeof window === "undefined" && cryptoModule) {
        const signer = cryptoModule.createSign("RSA-SHA256");
        signer.update(stringToSign);
        signature = signer.sign(keys.privateKey, "base64");
      } else {
        // Se siamo nel browser
        const privateKeyObject = await this.importPk(keys.privateKey);
        const encoder = new TextEncoder();
        const data = encoder.encode(stringToSign);
        const signatureBuffer = await window.crypto.subtle.sign(
          {
            name: "RSASSA-PKCS1-v1_5",
            hash: { name: "SHA-256" },
          },
          privateKeyObject as CryptoKey,
          data
        );
        signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
      }

      const signatureHeader = `keyId="${username}",algorithm="rsa-sha256",signature="${signature}"`;
      
      return {
        signature,
        signatureHeader,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Error signing data: " + error);
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
    // Se siamo in Node.js
    if (typeof window === "undefined" && cryptoModule) {
      try {
        const { generateKeyPairSync } = cryptoModule;
        const keys = generateKeyPairSync("rsa", {
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

        // Verifica il formato delle chiavi
        if (!this.validateKey(keys.privateKey)) {
          throw new Error("Generated private key has invalid format");
        }

        return {
          publicKey: keys.publicKey,
          privateKey: keys.privateKey,
        };
      } catch (error) {
        console.error("Node.js key generation error:", error);
        throw new Error(`Key generation failed in Node.js: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }

    // Se siamo nel browser
    if (typeof window !== "undefined" && window.crypto?.subtle) {
      try {
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

        const publicKey = `-----BEGIN PUBLIC KEY-----\n${this.arrayBufferToBase64(publicKeyBuffer)}\n-----END PUBLIC KEY-----`;
        const privateKey = `-----BEGIN PRIVATE KEY-----\n${this.arrayBufferToBase64(privateKeyBuffer)}\n-----END PRIVATE KEY-----`;

        // Verifica il formato delle chiavi
        if (!this.validateKey(privateKey)) {
          throw new Error("Generated private key has invalid format");
        }

        return { publicKey, privateKey };
      } catch (error) {
        console.error("Browser key generation error:", error);
        throw new Error(`Key generation failed in browser: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }

    throw new Error("No cryptographic implementation available");
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    // Formatta il base64 in linee di 64 caratteri
    return base64.match(/.{1,64}/g)?.join("\n") || base64;
  }
}
