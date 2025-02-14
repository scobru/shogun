import { IGunInstance, ISEAPair } from "gun";
import type { ActivityPubKeys } from "../interfaces/ActivityPubKeys";

let cryptoModule: any;

try {
  if (typeof window === "undefined") {
    // We're in Node.js
    cryptoModule = require("crypto");
  }
} catch {
  cryptoModule = null;
}

export class ActivityPubManager {
  /**
   * Generates a new RSA key pair for ActivityPub.
   * @returns {Promise<ActivityPubKeys>} - The generated key pair.
   * @throws {Error} - If key generation fails.
   */
  public async createPair(): Promise<ActivityPubKeys> {
    try {
      const { privateKey, publicKey } = await this.generateRSAKeyPair();
      
      return {
        publicKey,
        privateKey,
        createdAt: Date.now()
      };
    } catch (error) {
      console.error("Error generating ActivityPub keys:", error);
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
    privateKey: string,
  ): Promise<{ signature: string; signatureHeader: string }> {
    try {
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

      const randomKeyId = `${Math.random().toString(36).substring(2, 15)}`;

      // Generate signature header
      const signatureHeader = `keyId="${randomKeyId}",algorithm="rsa-sha256",signature="${signature}"`;

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
        try {
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
        } catch (error) {
          throw new Error(`Node.js key generation failed: ${error instanceof Error ? error.message : "unknown error"}`);
        }
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
