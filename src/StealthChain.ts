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
    if (!publicKey || typeof publicKey !== 'string') {
      throw new Error("Chiave pubblica non valida: parametro mancante o non valido");
    }
    
    // Rimuovi il tilde iniziale se presente
    const cleanKey = publicKey.startsWith("~") ? publicKey.slice(1) : publicKey;
    
    // Mantieni i punti e i caratteri speciali per le chiavi GunDB
    const formattedKey = cleanKey;
    
    // Verifica che la chiave formattata sia una stringa non vuota
    if (!formattedKey) {
      throw new Error("Chiave pubblica non valida: formato non corretto");
    }
    
    return formattedKey;
  }

  async generateStealthKeys(): Promise<StealthKeyPairWrapper> {
    const user = this.gun.user();
    console.log("🔑 Inizio generazione chiavi stealth...");

    return new Promise((resolve, reject) => {
      let isResolved = false;

      const checkExistingKeys = () => {
        console.log("🔍 Controllo chiavi esistenti...");
        user.get("stealthKeys").once((data: any) => {
          if (data && !isResolved) {
            console.log("✅ Chiavi stealth esistenti trovate");
            isResolved = true;
            resolve(data as StealthKeyPairWrapper);
            return;
          }
          
          console.log("⚠️ Nessuna chiave esistente trovata, genero nuove chiavi...");
          if (!isResolved) {
            generateNewKeys();
          }
        });
      };

      const generateNewKeys = async () => {
        try {
          console.log("🛠️ Generazione nuove chiavi stealth...");
          const pair = await SEA.pair();
          if (!pair || !pair.pub || !pair.priv || !pair.epub || !pair.epriv) {
            throw new Error("Chiavi non valide: generazione fallita");
          }

          console.log("✨ Chiavi generate con successo");
          console.log("📝 Chiave pubblica:", pair.pub);
          console.log("📝 Chiave pubblica effimera:", pair.epub);

          const stealthKeyPair: StealthKeyPairWrapper = {
            stealthKeyPair: pair,
          };

          console.log("💾 Salvataggio chiavi...");
          user.get("stealthKeys").put(stealthKeyPair);
          this.gun.get("stealthKeys").get(user.is.pub).put(pair.epub);

          user.get("stealthKeys").once((savedData: any) => {
            if (savedData && !isResolved) {
              console.log("✅ Chiavi salvate con successo");
              isResolved = true;
              resolve(stealthKeyPair);
            }
          });
        } catch (error) {
          console.error("❌ Errore nella generazione delle chiavi:", error);
          if (!isResolved) {
            isResolved = true;
            reject(new Error("Chiavi non valide: " + (error as Error).message));
          }
        }
      };

      setTimeout(() => {
        if (!isResolved) {
          console.error("⏰ Timeout nella generazione delle chiavi");
          isResolved = true;
          reject(new Error("Chiavi non valide: timeout nella generazione"));
        }
      }, 20000);

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
    console.log("🎯 Inizio generazione indirizzo stealth per:", recipientPublicKey);
    
    if (!recipientPublicKey || typeof recipientPublicKey !== 'string') {
      console.error("❌ Chiave pubblica del destinatario non valida");
      throw new Error("Chiavi non valide: parametri mancanti o non validi");
    }

    return new Promise((resolve, reject) => {
      let isResolved = false;

      console.log("🔍 Recupero chiave pubblica effimera dal registro...");
      this.gun
        .get("stealthKeys")
        .get(this.formatPublicKey(recipientPublicKey))
        .once(async (recipientEpub: any) => {
          if (!isResolved && recipientEpub) {
            try {
              console.log("📝 Chiave pubblica effimera trovata:", recipientEpub);
              
              console.log("🔐 Generazione coppia di chiavi effimere...");
              const ephemeralKeyPair = await SEA.pair();
              if (!ephemeralKeyPair?.epub || !ephemeralKeyPair?.epriv) {
                throw new Error("Chiavi non valide: generazione chiavi effimere fallita");
              }
              console.log("✅ Chiavi effimere generate");

              console.log("🤝 Generazione segreto condiviso...");
              const sharedSecret = await SEA.secret(recipientEpub, ephemeralKeyPair);
              if (!sharedSecret) {
                throw new Error("Chiavi non valide: generazione segreto condiviso fallita");
              }
              console.log("✅ Segreto condiviso generato");

              console.log("🔑 Derivazione chiave privata stealth...");
              const stealthPrivateKey = await this.deriveStealthPrivateKey(sharedSecret);
              const stealthWallet = new ethers.Wallet(stealthPrivateKey);
              const stealthAddress = stealthWallet.address;
              console.log("✅ Indirizzo stealth generato:", stealthAddress);

              isResolved = true;
              resolve({
                stealthAddress: stealthAddress,
                ephemeralPublicKey: ephemeralKeyPair.epub,
                recipientPublicKey,
              });
            } catch (error) {
              console.error("❌ Errore nella generazione dell'indirizzo stealth:", error);
              if (!isResolved) {
                isResolved = true;
                reject(new Error("Chiavi non valide: " + (error as Error).message));
              }
            }
          } else {
            console.log("⚠️ Chiave pubblica effimera non trovata nel registro");
          }
        });

      setTimeout(() => {
        if (!isResolved) {
          console.error("⏰ Timeout nella generazione dell'indirizzo stealth");
          isResolved = true;
          reject(new Error("Chiavi non valide: timeout nella generazione dell'indirizzo"));
        }
      }, 30000);
    });
  }

  async openStealthAddress(
    stealthAddress: string,
    ephemeralPublicKey: string
  ): Promise<WalletResult> {
    console.log("🔓 Inizio apertura indirizzo stealth...");
    console.log("📝 Indirizzo stealth:", stealthAddress);
    console.log("🔑 Chiave pubblica effimera:", ephemeralPublicKey);

    try {
      const user = this.gun.user();
      console.log("🔍 Recupero chiavi stealth dell'utente...");
      const keys = await new Promise((resolve) => {
        user.get("stealthKeys").once((data: any) => resolve(data));
      });

      if (!keys?.stealthKeyPair?.epriv || !keys?.stealthKeyPair?.priv) {
        console.error("❌ Chiavi stealth non trovate o incomplete");
        console.log("📝 Chiavi trovate:", keys);
        throw new Error("Chiavi stealth non trovate o incomplete");
      }

      console.log("✅ Chiavi stealth trovate");
      console.log("🔐 Preparazione chiavi per la decifratura...");

      const viewingKeyPair = {
        epriv: keys.stealthKeyPair.epriv,
        epub: keys.stealthKeyPair.epub,
      };

      console.log("🤝 Generazione segreto condiviso...");
      const sharedSecret = await SEA.secret(ephemeralPublicKey, viewingKeyPair);

      if (!sharedSecret) {
        console.error("❌ Impossibile generare il segreto condiviso");
        throw new Error("Impossibile generare il segreto condiviso per la decifratura");
      }
      console.log("✅ Segreto condiviso generato");

      console.log("🔑 Derivazione chiave privata stealth...");
      const stealthPrivateKey = await this.deriveStealthPrivateKey(sharedSecret);
      const stealthWallet = new ethers.Wallet(stealthPrivateKey);
      console.log("✅ Wallet stealth recuperato");

      if (!stealthWallet || typeof stealthWallet !== "object") {
        console.error("❌ Wallet non valido dopo la decifratura");
        throw new Error("Impossibile decifrare il wallet");
      }

      if (!stealthWallet.address || !stealthWallet.privateKey) {
        console.error("❌ Dati del wallet mancanti");
        throw new Error("Dati del wallet mancanti dopo la decifratura");
      }

      console.log("🔍 Verifica corrispondenza indirizzi...");
      console.log("📝 Indirizzo decrittato:", stealthWallet.address);
      console.log("📝 Indirizzo atteso:", stealthAddress);

      if (stealthWallet.address.toLowerCase() !== stealthAddress.toLowerCase()) {
        console.error("❌ Gli indirizzi non corrispondono");
        throw new Error("L'indirizzo decrittato non corrisponde all'indirizzo stealth");
      }

      console.log("✅ Indirizzo stealth aperto con successo");
      return stealthWallet;
    } catch (error: any) {
      console.error("❌ Errore nell'apertura dell'indirizzo stealth:", error);
      throw new Error(error.message || "Errore nel recupero dell'indirizzo stealth");
    }
  }

  async retrieveStealthKeysFromRegistry(userPub: string): Promise<string | null> {
    console.log("🔍 Recupero chiavi dal registro per:", userPub);
    
    try {
      return new Promise((resolve, reject) => {
        let timeoutId = setTimeout(() => {
          console.log("⏰ Timeout nel recupero delle chiavi dal registro");
          resolve(null);
        }, 10000);

        this.gun
          .get('stealthKeys')
          .get(userPub)
          .once((data: any) => {
            clearTimeout(timeoutId);
            if (!data) {
              console.log("⚠️ Chiavi non trovate nel registro");
              resolve(null);
              return;
            }
            console.log("✅ Chiavi recuperate dal registro");
            resolve(data);
          });
      });
    } catch (error) {
      console.error("❌ Errore nel recupero delle chiavi dal registro:", error);
      return null;
    }
  }

  async retrieveStealthKeysFromUser(): Promise<StealthKeyPairWrapper | null> {
    console.log("🔍 Recupero chiavi stealth dell'utente...");
    const user = this.gun.user();
    if (!user.is) {
      console.error("❌ Utente non autenticato");
      return null;
    }

    try {
      console.log("🔍 Ricerca chiavi nel profilo utente...");
      const data: any = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          console.error("⏰ Timeout nel recupero delle chiavi");
          reject(new Error("Chiavi non valide: timeout nel recupero"));
        }, 30000);

        user.get("stealthKeys").once((d: any) => {
          clearTimeout(timeoutId);
          console.log("📝 Chiavi trovate:", d ? "sì" : "no");
          resolve(d);
        });
      });

      if (!data) {
        console.log("⚠️ Nessuna chiave trovata");
        return null;
      }

      console.log("✅ Chiavi recuperate con successo");
      return data as StealthKeyPairWrapper;
    } catch (error) {
      console.error("❌ Errore nel recupero delle chiavi:", error);
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
