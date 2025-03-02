/**
 * Gestisce la logica stealth usando Gun e SEA
 */
import { ethers } from 'ethers';
import { IGunInstance, IGunUserInstance } from 'gun/types';
import { GunDB } from '../gun/Gun';

// Estendere l'interfaccia Window per includere StealthChain
declare global {
  interface Window {
    Stealth?: typeof Stealth;
  }
}

declare global {
  namespace NodeJS {
    interface Global {
      Stealth?: typeof Stealth;
    }
  }
}

interface StealthKeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}

interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}


class Stealth {
  private gun: IGunInstance<any>;
  private user: IGunUserInstance | null;
  private readonly STEALTH_DATA_TABLE: string;

  constructor(gundb: GunDB) {
    this.gun = gundb.gun;
    this.user = null;
    this.STEALTH_DATA_TABLE = "Stealth";
  }

  /**
   * Rimuove il tilde (~) iniziale dalla chiave pubblica se presente
   */
  formatPublicKey(publicKey: string | null): string | null {
    if (!publicKey) {
      return null;
    }

    const trimmedKey = publicKey.trim();

    if (!trimmedKey) {
      return null;
    }

    if (!/^[~]?[\w+/=\-_.]+$/.test(trimmedKey)) {
      return null;
    }

    return trimmedKey.startsWith("~") ? trimmedKey.slice(1) : trimmedKey;
  }

  /**
   * Genera le chiavi stealth se non esistono, altrimenti restituisce quelle esistenti
   */
  async createAccount(): Promise<StealthKeyPair> {
    try {
      const existingKeys = await this.getPair();
      if (existingKeys) {
        return existingKeys;
      }
    } catch (error) {
      // Se non troviamo chiavi esistenti, ne creiamo di nuove
    }

    return new Promise((resolve, reject) => {
      (Gun as any).SEA.pair((pair: any) => {
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
   * Genera un indirizzo stealth per la chiave pubblica del destinatario
   */
  async generateStealthAddress(recipientPublicKey: string): Promise<StealthAddressResult> {
    if (!recipientPublicKey) {
      throw new Error("Invalid keys: missing or invalid parameters");
    }

    // Prima creiamo le chiavi stealth se non esistono
    const stealthKeys = await this.createAccount();
    if (!stealthKeys) {
      throw new Error("Failed to create stealth keys");
    }

    console.log("Generazione indirizzo stealth con chiavi:", {
      userPub: stealthKeys.pub,
      userEpub: stealthKeys.epub,
      recipientPub: recipientPublicKey
    });

    return new Promise((resolve, reject) => {
      // Genera una coppia di chiavi effimere
      (Gun as any).SEA.pair((ephemeralKeyPair: any) => {
        if (!ephemeralKeyPair?.epub || !ephemeralKeyPair?.epriv) {
          reject(new Error("Invalid ephemeral keys"));
          return;
        }

        console.log("Chiavi effimere generate:", ephemeralKeyPair);

        // Genera il segreto condiviso usando la nostra chiave epub e le chiavi effimere
        (Gun as any).SEA.secret(stealthKeys.epub, ephemeralKeyPair, async (sharedSecret: string) => {
          if (!sharedSecret) {
            reject(new Error("Shared secret generation failed"));
            return;
          }

          console.log("Segreto condiviso generato:", sharedSecret);
          console.log("Chiavi utilizzate per la generazione:", {
            userEpub: stealthKeys.epub,
            ephemeralKeyPair
          });

          try {
            // Genera l'indirizzo stealth usando il segreto condiviso
            const stealthPrivateKey = ethers.keccak256(
              ethers.toUtf8Bytes(sharedSecret)
            );
            const stealthWallet = new ethers.Wallet(stealthPrivateKey);

            console.log("Indirizzo stealth generato:", {
              address: stealthWallet.address,
              ephemeralPubKey: ephemeralKeyPair.epub,
              sharedSecret
            });

            resolve({
              stealthAddress: stealthWallet.address,
              ephemeralPublicKey: ephemeralKeyPair.epub,
              recipientPublicKey
            });
          } catch (error) {
            reject(
              new Error(
                `Error creating stealth address: ${error instanceof Error ? error.message : "unknown error"
                }`
              )
            );
          }
        });
      });
    });
  }

  /**
   * Apre un indirizzo stealth derivando la chiave privata
   */
  async openStealthAddress(stealthAddress: string, ephemeralPublicKey: string): Promise<ethers.Wallet> {
    if (!stealthAddress || !ephemeralPublicKey) {
      throw new Error(
        "Missing parameters: stealthAddress or ephemeralPublicKey"
      );
    }

    // Recupera le chiavi stealth dell'utente
    const keys = await this.getPair();
    if (!keys) {
      throw new Error("Stealth keys not found");
    }

    console.log("Apertura indirizzo stealth con:", {
      stealthAddress,
      ephemeralPublicKey,
      userKeys: keys
    });

    return new Promise((resolve, reject) => {
      // Genera il segreto condiviso usando la chiave pubblica effimera e le nostre chiavi
      (Gun as any).SEA.secret(ephemeralPublicKey, { epriv: keys.epriv, epub: keys.epub }, async (sharedSecret: string) => {
        if (!sharedSecret) {
          reject(new Error("Unable to generate shared secret"));
          return;
        }

        console.log("Segreto condiviso generato per l'apertura:", sharedSecret);
        console.log("Chiavi utilizzate per la derivazione:", {
          ephemeralPublicKey,
          userKeys: keys
        });

        try {
          const stealthPrivateKey = ethers.keccak256(
            ethers.toUtf8Bytes(sharedSecret)
          );
          const stealthWallet = new ethers.Wallet(stealthPrivateKey);

          console.log("Indirizzo derivato:", stealthWallet.address);
          console.log("Indirizzo atteso:", stealthAddress);
          console.log("Segreti:", {
            generazione: sharedSecret,
            stealthPrivateKey
          });

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
              `Error deriving stealth wallet: ${error instanceof Error ? error.message : "unknown error"
              }`
            )
          );
        }
      });
    });
  }

  /**
   * Salva le chiavi stealth nel profilo utente
   */
  async save(stealthKeyPair: StealthKeyPair): Promise<any> {
    if (!stealthKeyPair?.pub || !stealthKeyPair?.priv || !stealthKeyPair?.epub || !stealthKeyPair?.epriv) {
      throw new Error("Invalid stealth keys: missing or incomplete parameters");
    }

    console.log("User:", this.user);
    this.user = this.gun.user().recall({ sessionStorage: true });
    const appKeyPair = (this.user as any)._.sea;
    console.log("AppKeyPair:", appKeyPair);

    return new Promise(async (resolve, reject) => {
      try {
        // Prima crittografa i dati sensibili
        const encryptedPriv = await (Gun as any).SEA.encrypt(stealthKeyPair.priv, appKeyPair);
        const encryptedEpriv = await (Gun as any).SEA.encrypt(stealthKeyPair.epriv, appKeyPair);

        // Poi salva i dati crittografati
        this.gun.get(this.STEALTH_DATA_TABLE).get(appKeyPair.pub).put({
          pub: stealthKeyPair.pub,
          priv: encryptedPriv,
          epub: stealthKeyPair.epub,
          epriv: encryptedEpriv,
          timestamp: Date.now()
        }, (ack: any) => {
          if (ack.err) {
            reject(new Error(ack.err));
          } else {
            resolve(ack);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Recupera le chiavi stealth dell'utente corrente
   */
  async getPair(): Promise<StealthKeyPair | null> {
    this.user = this.gun.user().recall({ sessionStorage: true });
    const appKeyPair = (this.user as any)._.sea;

    return new Promise((resolve, reject) => {
      this.gun.get(this.STEALTH_DATA_TABLE).get(appKeyPair.pub).once(async (data: any) => {
        if (!data) {
          resolve(null);
          return;
        }

        try {
          const priv = await (Gun as any).SEA.decrypt(data.priv, appKeyPair);
          const epriv = await (Gun as any).SEA.decrypt(data.epriv, appKeyPair);

          resolve({
            pub: data.pub,
            priv,
            epub: data.epub,
            epriv
          });
        } catch (error) {
          reject(new Error("Failed to decrypt stealth keys"));
        }
      });
    });
  }

  /**
   * Recupera la chiave pubblica stealth di un utente
   */
  async getPublicKey(publicKey: string): Promise<string | null> {
    const formattedPubKey = this.formatPublicKey(publicKey);
    if (!formattedPubKey) {
      return null;
    }

    return new Promise((resolve) => {
      this.gun.get(this.STEALTH_DATA_TABLE).get(formattedPubKey).once((data: any) => {
        resolve(data?.epub || null);
      });
    });
  }
}

// Rendi disponibile globalmente
if (typeof window !== 'undefined') {
  window.Stealth = Stealth;
} else if (typeof global !== 'undefined') {
  (global as any).Stealth = Stealth;
}

export { Stealth };
export default Stealth;