import { ethers } from "ethers";
import Gun from "gun";
import type { StealthKeyPair } from "../interfaces/StealthKeyPair";

const SEA = Gun.SEA;

/**
 * Gestisce la logica stealth usando Gun e SEA
 */
export class StealthManager {
  /**
   * Rimuove il tilde (~) iniziale dalla chiave pubblica se presente
   * @param {string} publicKey - The public key to format
   * @returns {string} - The formatted public key
   * @throws {Error} - If the public key is invalid
   */
  private formatPublicKey(publicKey: string): string {
    if (!publicKey) {
      throw new Error("Invalid public key: missing parameter");
    }
    return publicKey.startsWith("~") ? publicKey.slice(1) : publicKey;
  }

  /**
   * Genera le chiavi stealth se non esistono, altrimenti restituisce quelle esistenti
   * @returns {Promise<StealthKeyPair>} - The generated or existing stealth key pair
   * @throws {Error} - If the generated keys are invalid
   */
  public async createPair(): Promise<StealthKeyPair> {
    try {
      return new Promise((resolve, reject) => {
        SEA.pair((pair: any) => {
          if (!pair?.pub || !pair?.priv || !pair?.epub || !pair?.epriv) {
            reject(new Error("Generated keys are invalid"));
            return;
          }

          const stealthKeyPair: StealthKeyPair = {
            pub: pair.pub,
            priv: pair.priv,
            epub: pair.epub,
            epriv: pair.epriv,
          };

          resolve(stealthKeyPair);
        });
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generates a stealth address for the recipient's public key
   * @param {string} recipientPublicKey - The recipient's public key
   * @returns {Promise<{stealthAddress: string, ephemeralPublicKey: string, recipientPublicKey: string}>} - The generated stealth address and keys
   * @throws {Error} - If the keys are invalid or missing
   */
  public async generateStAdd(recipientPublicKey: string): Promise<{
    stealthAddress: string;
    ephemeralPublicKey: string;
    recipientPublicKey: string;
  }> {
    if (!recipientPublicKey || typeof recipientPublicKey !== "string") {
      throw new Error("Chiave pubblica del destinatario non valida o mancante");
    }

    // Prima creiamo le chiavi stealth se non esistono
    const stealthKeys = await this.createPair();
    if (!stealthKeys?.epub || !stealthKeys?.epriv) {
      throw new Error("Impossibile creare le chiavi stealth");
    }

    return new Promise((resolve, reject) => {
      SEA.pair((ephemeralKeyPair: any) => {
        if (!ephemeralKeyPair?.epub || !ephemeralKeyPair?.epriv) {
          reject(new Error("Invalid ephemeral keys"));
          return;
        }

        SEA.secret(
          stealthKeys.epub,
          ephemeralKeyPair,
          (sharedSecret: string | undefined) => {
            if (!sharedSecret) {
              reject(new Error("Shared secret generation failed"));
              return;
            }

            try {
              const stealthPrivateKey = ethers.keccak256(
                ethers.toUtf8Bytes(sharedSecret)
              );
              const stealthWallet = new ethers.Wallet(stealthPrivateKey);
              resolve({
                stealthAddress: stealthWallet.address,
                ephemeralPublicKey: ephemeralKeyPair.epub,
                recipientPublicKey,
              });
            } catch (error) {
              reject(
                new Error(
                  `Error creating stealth address: ${
                    error instanceof Error ? error.message : "unknown error"
                  }`
                )
              );
            }
          }
        );
      });
    });
  }

  /**
   * Opens a stealth address by deriving the private key
   * @param {string} stealthAddress - The stealth address to open
   * @param {string} ephemeralPublicKey - The ephemeral public key
   * @returns {Promise<ethers.Wallet>} - The derived wallet
   * @throws {Error} - If the parameters are missing or the keys are invalid
   */
  public async openStAdd(
    stealthAddress: string,
    ephemeralPublicKey: string,
    stealthPair: StealthKeyPair
  ): Promise<ethers.Wallet> {
    if (!stealthAddress || !ephemeralPublicKey) {
      throw new Error("Missing parameters: stealthAddress or ephemeralPublicKey");
    }

    return new Promise((resolve, reject) => {
      SEA.secret(
        ephemeralPublicKey,
        { epriv: stealthPair.epriv, epub: stealthPair.epub },
        (sharedSecret: string | undefined) => {
          if (!sharedSecret) {
            reject(new Error("Unable to generate shared secret"));
            return;
          }

          try {
            const stealthPrivateKey = ethers.keccak256(
              ethers.toUtf8Bytes(sharedSecret)
            );
            const stealthWallet = new ethers.Wallet(stealthPrivateKey);

            if (
              stealthWallet.address.toLowerCase() !==
              stealthAddress.toLowerCase()
            ) {
              reject(
                new Error(
                  "Derived address doesn't match provided stealth address"
                )
              );
              return;
            }

            resolve(stealthWallet);
          } catch (error) {
            reject(
              new Error(
                `Error deriving stealth wallet: ${
                  error instanceof Error ? error.message : "unknown error"
                }`
              )
            );
          }
        }
      );
    });
  }
}
