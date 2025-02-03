import type { ActivityPubKeys } from "../interfaces/ActivityPubKeys";
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

export class ActivityPubManager {
  private gunAuthManager: GunAuthManager;

  constructor(gunAuthManager: GunAuthManager) {
    this.gunAuthManager = gunAuthManager;
  }

  public async generateActivityPubKeys(): Promise<ActivityPubKeys> {
    try {
      const { privateKey, publicKey } = await this.generateRSAKeyPair();

      if (
        !this.validateKeyFormat(privateKey) ||
        !this.validateKeyFormat(publicKey)
      ) {
        throw new Error("Formato chiavi generato non valido");
      }

      await this.saveActivityPubKeys({
        publicKey,
        privateKey,
        createdAt: Date.now(),
      });

      return {
        publicKey,
        privateKey,
        createdAt: Date.now(),
      };
    } catch (error) {
      console.error("Errore nella generazione delle chiavi:", error);
      throw new Error(
        `Generazione chiavi fallita: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }

  public async saveActivityPubKeys(keys: ActivityPubKeys): Promise<void> {
    if (!this.gunAuthManager.getCurrentUserKeyPair()) {
      throw new Error("Utente non autenticato");
    }
    await this.gunAuthManager.savePrivateData(keys, "activitypub/keys");
    await this.gunAuthManager.savePublicData(
      keys.publicKey,
      "activitypub/publicKey"
    );
  }

  public async getActivityPubKeys(): Promise<ActivityPubKeys> {
    if (!this.gunAuthManager.getCurrentUserKeyPair()) {
      throw new Error("Utente non autenticato");
    }
    return this.gunAuthManager.getPrivateData("activitypub/keys");
  }

  public async getActivityPubPublicKey(): Promise<string> {
    if (!this.gunAuthManager.getCurrentUserKeyPair()) {
      throw new Error("Utente non autenticato");
    }
    const publicKey = await this.gunAuthManager.getPublicKey();
    return this.gunAuthManager.getPublicData(
      "activitypub/publicKey",
      publicKey
    );
  }

  public async deleteActivityPubKeys(): Promise<void> {
    if (!this.gunAuthManager.getCurrentUserKeyPair()) {
      throw new Error("Utente non autenticato");
    }
    await this.gunAuthManager.deletePrivateData("activitypub/keys");
    await this.gunAuthManager.deletePublicData("activitypub/publicKey");
  }

  public async getPrivateKey(username: string): Promise<string> {
    try {
      // Verifica formato username
      if (!username || typeof username !== "string") {
        throw new Error("Formato username non valido");
      }

      const privateData = await this.gunAuthManager.getPrivateData(
        "activitypub/keys"
      );
      if (!privateData || !privateData.privateKey) {
        throw new Error("Chiave privata non trovata");
      }

      if (!this.validateKeyFormat(privateData.privateKey)) {
        throw new Error("Formato chiave non valido");
      }

      return privateData.privateKey;
    } catch (error) {
      console.error("Errore nel recupero della chiave:", error);
      throw error;
    }
  }

  private validateKeyFormat(key: string): boolean {
    const pemHeader = key.startsWith("-----BEGIN PRIVATE KEY-----");
    const pemFooter = key.includes("-----END PRIVATE KEY-----");
    const keyLength = key.length > 100;
    return pemHeader && pemFooter && keyLength;
  }

  public async importPrivateKey(pem: string) {
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

  public async signActivityPubData(
    stringToSign: string,
    username: string
  ): Promise<{ signature: string; signatureHeader: string }> {
    try {
      // Recupera la chiave privata
      const privateKey = await this.getPrivateKey(username);

      if (!privateKey) {
        throw new Error("Chiave privata non trovata per l'utente " + username);
      }

      // Converti la chiave PEM in formato utilizzabile
      const cryptoKey = await this.importPrivateKey(privateKey);

      // Codifica la stringa da firmare
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(stringToSign);

      // Firma i dati
      const signatureBuffer = await window.crypto.subtle.sign(
        {
          name: "RSASSA-PKCS1-v1_5",
          hash: { name: "SHA-256" },
        },
        cryptoKey,
        dataBuffer
      );

      // Converti la firma in base64
      const signature = btoa(
        String.fromCharCode(...new Uint8Array(signatureBuffer))
      );

      // Genera l'header della firma
      const signatureHeader = `keyId="${username}",algorithm="rsa-sha256",signature="${signature}"`;

      return { signature, signatureHeader };
    } catch (error) {
      console.error("Errore durante la firma ActivityPub:", error);
      throw new Error(
        `Firma ActivityPub fallita: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }

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

        // Funzione migliorata per convertire ArrayBuffer in PEM
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
        console.error("Errore WebCrypto:", error);
        throw new Error(
          `Generazione chiavi fallita: ${
            error instanceof Error ? error.message : "Errore sconosciuto"
          }`
        );
      }
    }

    // Se siamo in Node.js
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

    throw new Error("Nessuna implementazione crittografica disponibile");
  }
}
