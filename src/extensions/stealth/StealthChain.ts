import { ethers } from "ethers";
import Gun from "gun";
import { GunStorage } from "../../core/storage/GunStorage";
import type { StealthKeyPair } from "../../types/StealthKeyPair";
import { IGunInstance, ISEAPair } from "gun";

const SEA = Gun.SEA;

/**
 * Gestisce la logica stealth usando Gun e SEA
 */
export class StealthChain extends GunStorage<StealthKeyPair> {
  protected storagePrefix = "stealth";

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
  }

  /**
   * Rimuove il tilde (~) iniziale dalla chiave pubblica se presente
   * @param {string} publicKey - The public key to format
   * @returns {string | null} - The formatted public key or null if the key is invalid
   * @throws {Error} - If the public key is invalid
   */
  private formatPublicKey(publicKey: string): string | null {
    if (!publicKey) {
      return null;
    }
    
    // Rimuovi spazi bianchi
    const trimmedKey = publicKey.trim();
    
    // Verifica che la chiave non sia vuota dopo il trim
    if (!trimmedKey) {
      return null;
    }
    
    // Verifica il formato base della chiave
    // Modifichiamo il pattern per accettare il formato corretto delle chiavi Gun
    if (!/^[~]?[\w+/=\-_.]+$/.test(trimmedKey)) {
      return null;
    }
    
    // Rimuovi il tilde se presente
    return trimmedKey.startsWith("~") ? trimmedKey.slice(1) : trimmedKey;
  }

  private isTestKey(key: string): boolean {
    // Verifica se la chiave ha il formato specifico usato nei test
    return /^test.*key.*$/.test(key.toLowerCase());
  }

  /**
   * Genera le chiavi stealth se non esistono, altrimenti restituisce quelle esistenti
   * @returns {Promise<StealthKeyPair>} - The generated or existing stealth key pair
   * @throws {Error} - If the generated keys are invalid
   */
  public async createAccount(): Promise<StealthKeyPair> {
    try {
      const existingKeys = await this.getPair();
      if (existingKeys) {
        return existingKeys;
      }
    } catch (error) {
      // Se non troviamo chiavi esistenti, ne creiamo di nuove
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

        this.save(stealthKeyPair)
          .then(() => resolve(stealthKeyPair))
          .catch(reject);
      });
    });
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
    if (!recipientPublicKey) {
      throw new Error("Invalid keys: missing or invalid parameters");
    }

    // Prima creiamo le chiavi stealth se non esistono
    const stealthKeys = await this.createAccount();
    if (!stealthKeys) {
      throw new Error("Failed to create stealth keys");
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
    ephemeralPublicKey: string
  ): Promise<ethers.Wallet> {
    if (!stealthAddress || !ephemeralPublicKey) {
      throw new Error(
        "Missing parameters: stealthAddress or ephemeralPublicKey"
      );
    }

    const keys = await this.getPair();
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
   * @param {string} publicKey - The public key to retrieve stealth keys for
   * @returns {Promise<string | null>} - The retrieved stealth keys or null if not found
   * @throws {Error} - If the public key is invalid
   */
  public async retrieveKeys(publicKey: string): Promise<any> {
    try {
      // Aggiungiamo una pulizia più aggressiva della chiave
      const cleanedKey = publicKey.replace(/[^a-zA-Z0-9]/g, '');
      if (!cleanedKey) return null;

      // Aumentiamo il timeout per la verifica
      const data = await this.getPublicData(cleanedKey, this.storagePrefix);
      
      // Verifica aggiuntiva per dati vuoti
      if (!data || Object.keys(data).length === 0) {
        return null;
      }
      
      return data;
    } catch (error) {
      console.error("Error retrieving keys:", error);
      return null;
    }
  }

  /**
   * Retrieves stealth keys for a specific user
   * @param {string} publicKey - The public key to retrieve stealth keys for
   * @returns {Promise<StealthKeyPair | null>} - The retrieved stealth key pair or null if not found
   * @throws {Error} - If the public key is invalid
   */
  public async retrievePair(publicKey: string): Promise<StealthKeyPair | null> {
    if (!publicKey) {
      throw new Error("Invalid public key: missing parameter");
    }

    try {
      const rawData = await this.getPrivateData(this.storagePrefix);
      if (!rawData) {
        console.log("No stealth keys found");
        return null;
      }

      // Verifica e pulisci i dati
      if (!rawData.pub || !rawData.priv || !rawData.epub || !rawData.epriv) {
        console.error("Invalid stealth keys format:", rawData);
        return null;
      }

      // Crea un nuovo oggetto pulito
      const cleanKeys: StealthKeyPair = {
        pub: rawData.pub,
        priv: rawData.priv,
        epub: rawData.epub,
        epriv: rawData.epriv
      };

      return cleanKeys;
    } catch (error) {
      console.error("Error retrieving stealth keys:", error);
      return null;
    }
  }

  /**
   * Salva le chiavi stealth nel profilo utente
   * @param {StealthKeyPair} stealthKeyPair - The stealth key pair to save
   * @returns {Promise<void>} - A promise that resolves when the keys are saved
   * @throws {Error} - If the stealth keys are invalid or incomplete
   */
  public async save(stealthKeyPair: StealthKeyPair): Promise<void> {
    if (!stealthKeyPair?.pub || !stealthKeyPair?.priv || !stealthKeyPair?.epub || !stealthKeyPair?.epriv) {
      throw new Error("Invalid stealth keys: missing or incomplete parameters");
    }

    await this.savePrivateData(stealthKeyPair, this.storagePrefix);
    await this.savePublicData({ epub: stealthKeyPair.epub }, this.storagePrefix);
  }

  /**
   * Recupera le chiavi stealth dell'utente corrente
   * @returns {Promise<StealthKeyPair>} - The stealth key pair
   * @throws {Error} - If the keys are not found
   */
  public async getPair(): Promise<StealthKeyPair> {
    const keys = await this.getPrivateData(this.storagePrefix);
    if (!keys || !keys.pub || !keys.priv || !keys.epub || !keys.epriv) {
      throw new Error("Stealth keys not found");
    }

    // Rimuovi i metadati di Gun e crea un nuovo oggetto pulito
    const cleanKeys: StealthKeyPair = {
      pub: keys.pub,
      priv: keys.priv,
      epub: keys.epub,
      epriv: keys.epriv
    };

    return cleanKeys;
  }


  /**
   * Recupera la chiave pubblica stealth di un utente
   * @param {string} publicKey - The public key to get the stealth key for
   * @returns {Promise<string | null>} - The stealth public key or null if not found
   */
  public async getPub(publicKey: string): Promise<string | null> {
    const formattedPubKey = this.formatPublicKey(publicKey);
    if (!formattedPubKey) {
      return null;
    }
    const data = await this.getPublicData(formattedPubKey, this.storagePrefix);
    return data?.epub || null;
  }
}
