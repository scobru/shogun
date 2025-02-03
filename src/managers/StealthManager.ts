import { ethers } from "ethers";
import Gun from "gun";
import "gun/sea";
import { GunAuthManager } from "./GunAuthManager";
import type { StealthKeyPair } from "../interfaces/StealthKeyPair";
// If you have Gun and SEA type definitions, you can import them here.
// For now, we use `any` to simplify.
const SEA = Gun.SEA;

/**
 * Main class for handling stealth logic using Gun and SEA
 */
export class StealthManager {
  private gunAuthManager: GunAuthManager;

  constructor(gunAuthManager: GunAuthManager) {
    this.gunAuthManager = gunAuthManager;
  }

  /**
   * Removes leading tilde (~) from public key if present
   */
  private formatPublicKey(publicKey: string): string {
    if (!publicKey) {
      throw new Error("Invalid public key: missing parameter");
    }
    return publicKey.startsWith("~") ? publicKey.slice(1) : publicKey;
  }

  /**
   * Genera le chiavi stealth se non esistono, altrimenti le restituisce
   */
  public async generateStealthKeys(): Promise<StealthKeyPair> {
    const existingKeys = await this.getStealthKeys();
    if (existingKeys) {
      return existingKeys;
    }

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

        this.saveStealthKeys(stealthKeyPair)
          .then(() => resolve(stealthKeyPair))
          .catch(reject);
      });
    });
  }

  /**
   * Genera un indirizzo stealth per la chiave pubblica del destinatario
   */
  public async generateStealthAddress(recipientPublicKey: string): Promise<{
    stealthAddress: string;
    ephemeralPublicKey: string;
    recipientPublicKey: string;
  }> {
    if (!recipientPublicKey) {
      throw new Error("Invalid keys: missing or invalid parameters");
    }

    const recipientEpub = await this.getPublicStealthKey(recipientPublicKey);
    if (!recipientEpub) {
      throw new Error("Ephemeral public key not found");
    }

    return new Promise((resolve, reject) => {
      SEA.pair((ephemeralKeyPair: any) => {
        if (!ephemeralKeyPair?.epub || !ephemeralKeyPair?.epriv) {
          reject(new Error("Invalid ephemeral keys"));
          return;
        }

        SEA.secret(
          recipientEpub,
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
   * Apre un indirizzo stealth derivando la chiave privata
   */
  public async openStealthAddress(
    stealthAddress: string,
    ephemeralPublicKey: string
  ): Promise<ethers.Wallet> {
    if (!stealthAddress || !ephemeralPublicKey) {
      throw new Error(
        "Missing parameters: stealthAddress or ephemeralPublicKey"
      );
    }

    const keys = await this.getStealthKeys();
    if (!keys) {
      throw new Error("Stealth keys not found");
    }

    return new Promise((resolve, reject) => {
      SEA.secret(
        ephemeralPublicKey,
        { epriv: keys.epriv, epub: keys.epub },
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

  /**
   * Retrieves stealth keys (epub) from public registry if present
   */
  public async retrieveStealthKeysFromRegistry(
    publicKey: string
  ): Promise<string | null> {
    if (!publicKey) {
      throw new Error("Invalid public key");
    }
    const formattedPubKey = this.formatPublicKey(publicKey);
    const data = await this.gunAuthManager.getPublicData(
      formattedPubKey,
      "stealthKeys"
    );
    return data?.epub || null;
  }

  /**
   * Retrieves stealth keys for a specific user
   */
  public async retrieveStealthKeysFromUser(
    publicKey: string
  ): Promise<StealthKeyPair | null> {
    if (!publicKey) {
      throw new Error("Invalid public key: missing parameter");
    }

    const formattedPubKey = this.formatPublicKey(publicKey);
    console.log("Retrieving stealth keys for:", formattedPubKey);

    try {
      const privateData = await this.gunAuthManager.getPrivateData(
        "stealthKeys"
      );
      if (!privateData) {
        console.log("No stealth keys found");
        return null;
      }

      const keys = privateData.stealthKeyPair || privateData;
      if (!keys?.pub || !keys?.priv || !keys?.epub || !keys?.epriv) {
        console.error("Invalid stealth keys format:", keys);
        return null;
      }

      return {
        pub: keys.pub,
        priv: keys.priv,
        epub: keys.epub,
        epriv: keys.epriv,
      };
    } catch (error) {
      console.error("Error retrieving stealth keys:", error);
      return null;
    }
  }

  /**
   * Salva le chiavi stealth nel profilo dell'utente
   */
  public async saveStealthKeys(stealthKeyPair: StealthKeyPair): Promise<void> {
    if (!stealthKeyPair || !stealthKeyPair.pub || !stealthKeyPair.epub) {
      throw new Error("Invalid or incomplete stealth keys");
    }

    // Salva le chiavi private nel profilo privato
    await this.gunAuthManager.savePrivateData(
      {
        pub: stealthKeyPair.pub,
        priv: stealthKeyPair.priv,
        epub: stealthKeyPair.epub,
        epriv: stealthKeyPair.epriv,
      },
      "stealthKeys"
    );

    // Salva la chiave pubblica nel profilo pubblico
    await this.gunAuthManager.savePublicData(
      {
        epub: stealthKeyPair.epub,
      },
      "stealthKeys"
    );
  }

  /**
   * Recupera le chiavi stealth dal profilo dell'utente
   */
  public async getStealthKeys(): Promise<StealthKeyPair> {
    const privateData = await this.gunAuthManager.getPrivateData("stealthKeys");
    if (
      !privateData ||
      !privateData.pub ||
      !privateData.priv ||
      !privateData.epub ||
      !privateData.epriv
    ) {
      throw new Error("Invalid stealth keys");
    }

    return {
      pub: privateData.pub,
      priv: privateData.priv,
      epub: privateData.epub,
      epriv: privateData.epriv,
    };
  }

  /**
   * Recupera la chiave pubblica stealth di un utente
   */
  public async getPublicStealthKey(publicKey: string): Promise<string | null> {
    const publicData = await this.gunAuthManager.getPublicData(
      publicKey,
      "stealthKeys"
    );
    return publicData?.epub || null;
  }
}
