import { ethers } from "ethers";
import type {
  WalletResult,
  StealthAddressResult,
} from "./interfaces/WalletResult";
import Gun from "gun";
import "gun/sea";
import { WalletManager } from "./WalletManager";
const SEA = Gun.SEA;

interface KeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}

interface StealthKeyPairWrapper {
  stealthKeyPair: KeyPair;
}

/**
 * Converts a Gun private key (in base64Url) to Ethereum-compatible hex format
 * @param {string} gunPrivateKey - Gun private key in base64Url format
 * @returns {Promise<string>} Private key in hex format
 */
function convertToEthPk(gunPrivateKey: string): string {
  const base64UrlToHex = (base64url: string): string => {
    try {
      const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
      const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
      const binary = atob(base64);
      const hex = Array.from(binary, (char) =>
        char.charCodeAt(0).toString(16).padStart(2, "0")
      ).join("");

      if (hex.length !== 64) {
        throw new Error(
          "Impossibile convertire la chiave privata: lunghezza non valida"
        );
      }
      return hex;
    } catch (error) {
      throw new Error(
        "Impossibile convertire la chiave privata: formato non valido"
      );
    }
  };

  if (!gunPrivateKey || typeof gunPrivateKey !== "string") {
    throw new Error(
      "Impossibile convertire la chiave privata: input non valido"
    );
  }

  try {
    const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
    return hexPrivateKey;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Impossibile convertire la chiave privata: ${error.message}`
      );
    }
    throw new Error(
      "Impossibile convertire la chiave privata: errore sconosciuto"
    );
  }
}

export class StealthChain {
  private gun: any;

  constructor(gun: any) {
    this.gun = gun;
  }

  private formatPublicKey(publicKey: string): string {
    // Rimuovi il tilde iniziale se presente
    const cleanKey = publicKey.startsWith("~") ? publicKey.slice(1) : publicKey;
    // Sostituisci i punti con +
    return cleanKey.replace(/[.]/g, "+");
  }

  async generateStealthKeys(): Promise<StealthKeyPairWrapper> {
    const user = this.gun.user();

    return new Promise((resolve, reject) => {
      let isResolved = false;

      const checkExistingKeys = () => {
        user.get("stealthKeys").on((data: any) => {
          if (data && !isResolved) {
            isResolved = true;
            console.log("Stealth Keys Already Created!", data);
            resolve(data as StealthKeyPairWrapper);
            return;
          }
        });

        // Se non ci sono chiavi esistenti, ne generiamo di nuove dopo un breve delay
        setTimeout(() => {
          if (!isResolved) {
            generateNewKeys();
          }
        }, 100);
      };

      const generateNewKeys = async () => {
        try {
          const pair = await SEA.pair();
          if (!pair || !pair.pub || !pair.priv || !pair.epub || !pair.epriv) {
            if (!isResolved) {
              isResolved = true;
              reject(new Error("Chiavi non valide: generazione fallita"));
            }
            return;
          }

          const stealthKeyPair: StealthKeyPairWrapper = {
            stealthKeyPair: pair,
          };

          // Salva le chiavi e attendi la conferma
          user.get("stealthKeys").put(stealthKeyPair);

          // Verifica che le chiavi siano state salvate correttamente
          user.get("stealthKeys").on((savedData: any) => {
            if (savedData && !isResolved) {
              isResolved = true;
              resolve(stealthKeyPair);
            }
          });
        } catch (error) {
          if (!isResolved) {
            isResolved = true;
            reject(new Error("Chiavi non valide: " + (error as Error).message));
          }
        }
      };

      // Imposta un timeout più lungo per Gun
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error("Chiavi non valide: timeout nella generazione"));
        }
      }, 20000);

      // Avvia il processo
      checkExistingKeys();
    });
  }

  private async deriveStealthPrivateKey(sharedSecret: string): Promise<string> {
    // Usa il segreto condiviso come entropia per generare la chiave privata
    const hash = ethers.keccak256(ethers.toUtf8Bytes(sharedSecret));
    return hash;
  }

  async generateStealthAddress(
    recipientPublicKey: string
  ): Promise<StealthAddressResult> {
    if (!recipientPublicKey) {
      throw new Error("Chiavi non valide: parametri mancanti");
    }

    return new Promise((resolve, reject) => {
      let isResolved = false;

      // Recupera le chiavi del destinatario
      this.gun
        .get(recipientPublicKey)
        .get("stealthKeys")
        .on(async (data: any) => {
          if (!isResolved && data) {
            try {
              const ephemeralKeyPair = await SEA.pair();
              if (!ephemeralKeyPair?.epub || !ephemeralKeyPair?.epriv) {
                throw new Error(
                  "Chiavi non valide: generazione chiavi effimere fallita"
                );
              }

              const sharedSecret = await SEA.secret(data, ephemeralKeyPair);
              if (!sharedSecret) {
                throw new Error(
                  "Chiavi non valide: generazione segreto condiviso fallita"
                );
              }

              const stealthPrivateKey = await this.deriveStealthPrivateKey(
                sharedSecret
              );
              const stealthWallet = new ethers.Wallet(stealthPrivateKey);
              const stealthAddress = stealthWallet.address;

              isResolved = true;
              resolve({
                stealthAddress: stealthAddress,
                ephemeralPublicKey: ephemeralKeyPair.epub,
                recipientPublicKey,
              });
            } catch (error) {
              if (!isResolved) {
                isResolved = true;
                reject(
                  new Error("Chiavi non valide: " + (error as Error).message)
                );
              }
            }
          }
        });

      // Timeout di sicurezza
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(
            new Error(
              "Chiavi non valide: timeout nella generazione dell'indirizzo"
            )
          );
        }
      }, 20000);
    });
  }

  async openStealthAddress(
    stealthAddress: string,
    ephemeralPublicKey: string
  ): Promise<WalletResult> {
    try {
      // Recupera le chiavi stealth dell'utente
      const user = this.gun.user();
      const keys = await user.get("stealthKeys");

      if (!keys?.stealthKeyPair?.epriv || !keys?.stealthKeyPair?.priv) {
        throw new Error("Chiavi stealth non trovate o incomplete");
      }

      console.log("🔐 Decifratura con chiave di visualizzazione...");
      console.log("📝 Chiavi utente:", keys.stealthKeyPair);
      console.log("🔑 Chiave effimera:", ephemeralPublicKey);

      // Prepara le chiavi nel formato corretto per SEA.secret
      const viewingKeyPair = {
        epriv: keys.stealthKeyPair.epriv,
        epub: keys.stealthKeyPair.epub,
      };

      // Genera il segreto condiviso usando la chiave privata di visualizzazione
      const sharedSecret = await SEA.secret(ephemeralPublicKey, viewingKeyPair);

      if (!sharedSecret) {
        throw new Error(
          "Impossibile generare il segreto condiviso per la decifratura"
        );
      }

      console.log("🔑 Tentativo di decifratura del wallet...");

      // Decifra il wallet
      const stealthPrivateKey = await this.deriveStealthPrivateKey(
        sharedSecret
      );
      const stealthWallet = new ethers.Wallet(stealthPrivateKey);

      console.log("📦 Wallet decifrato:", stealthWallet);

      if (!stealthWallet || typeof stealthWallet !== "object") {
        throw new Error("Impossibile decifrare il wallet");
      }

      if (!stealthWallet.address || !stealthWallet.privateKey) {
        throw new Error("Dati del wallet mancanti dopo la decifratura");
      }

      // Verifica che l'indirizzo decrittato corrisponda all'indirizzo stealth
      if (
        stealthWallet.address.toLowerCase() !== stealthAddress.toLowerCase()
      ) {
        throw new Error(
          "L'indirizzo decrittato non corrisponde all'indirizzo stealth"
        );
      }

      return stealthWallet;
    } catch (error: any) {
      console.error("❌ Errore nel recupero dell'indirizzo stealth:", error);
      throw new Error(
        error.message || "Errore nel recupero dell'indirizzo stealth"
      );
    }
  }

  async retrieveStealthKeysFromRegistry(userPub: string): Promise<string | null> {
    try {
      const stealthPubKey = await this.gun.get('stealthKeys').get(userPub);
      
      if (!stealthPubKey) {
        console.log("❌ Impossibile trovare le chiavi dell'utente nel nodo pubblico");
        return null;
      }

      return stealthPubKey;
    } catch (error) {
      console.error("❌ Errore nel recupero delle chiavi dal registro:", error);
      return null;
    }
  }

  async retrieveStealthKeysFromUser(): Promise<StealthKeyPairWrapper | null> {
    const user = this.gun.user();
    if (!user.is) {
      return null;
    }

    let isResolved = false;
    let result: StealthKeyPairWrapper | null = null;
    let timeoutId: NodeJS.Timeout;

    try {
      const data: any = await new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Chiavi non valide: timeout nel recupero"));
        }, 20000);

        user.get("stealthKeys").once((d: any) => {
          clearTimeout(timeoutId);
          resolve(d);
        });
      });

      if (!data) {
        return null;
      }

      return {
        stealthKeyPair: {
          pub: data.stealthKeyPair.pub,
          priv: data.stealthKeyPair.priv,
          epub: data.stealthKeyPair.epub,
          epriv: data.stealthKeyPair.epriv,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async saveStealthKeys(stealthKeyPair: KeyPair): Promise<void> {
    if (!this.gun.user().is) {
      throw new Error("Chiavi non valide: utente non autenticato");
    }

    // Save stealth KeyPair into user node
    const saveWrappedKeyPair = await this.gun
      .user()
      .get("stealthKeys")
      .put(stealthKeyPair);
    if (saveWrappedKeyPair.err) {
      throw new Error("Chiavi non valide: " + saveWrappedKeyPair.err);
    }

    const publicKey = this.gun.user()._.sea.pub;

    // Save only ephemeral pub key in a public node.
    const saveEphemeralKey = await this.gun
      .get("stealthKeys")
      .get(publicKey)
      .put(stealthKeyPair.epub);
    if (saveEphemeralKey.err) {
      throw new Error("Chiavi non valide: " + saveEphemeralKey.err);
    }
  }
}
