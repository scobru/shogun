import Gun from "gun";
import "gun/sea";
import { ethers } from "ethers";

const SEA = Gun.SEA;

export interface KeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}

export interface StealthKeys {
  stealthKeyPair: KeyPair;
  ephemeralPublicKey: string;
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

  public async generateStealthKeys(): Promise<StealthKeys> {
    try {
      // Genera nuove chiavi usando SEA
      const stealthKeyPair = await SEA.pair();
      
      // Validazione completa delle chiavi
      if (!stealthKeyPair?.pub || !stealthKeyPair?.priv || !stealthKeyPair?.epub || !stealthKeyPair?.epriv) {
        throw new Error("Generazione chiavi stealth fallita: chiavi mancanti");
      }

      // Verifica che le chiavi siano stringhe valide
      if (typeof stealthKeyPair.pub !== 'string' || 
          typeof stealthKeyPair.priv !== 'string' ||
          typeof stealthKeyPair.epub !== 'string' ||
          typeof stealthKeyPair.epriv !== 'string') {
        throw new Error("Generazione chiavi stealth fallita: formato non valido");
      }

      // Verifica che le chiavi siano nel formato corretto per SEA
      try {
        const testSecret = await SEA.secret(stealthKeyPair.epub, stealthKeyPair);
        if (!testSecret) {
          throw new Error("Generazione chiavi stealth fallita: chiavi non valide per ECDH");
        }
      } catch (error) {
        throw new Error("Generazione chiavi stealth fallita: chiavi non valide per ECDH");
      }

      return {
        stealthKeyPair: {
          pub: stealthKeyPair.pub,
          priv: stealthKeyPair.priv,
          epub: stealthKeyPair.epub,
          epriv: stealthKeyPair.epriv,
        },
        ephemeralPublicKey: stealthKeyPair.epub
      };
    } catch (error) {
      console.error("❌ Errore nella generazione delle chiavi stealth:", error);
      throw error;
    }
  }

  public async generateStealthAddress(
    recipientStealthPub: string,
  ): Promise<{
    stealthAddress: string;
    encryptedWallet: string;
    ephemeralPublicKey: string;
  }> {
    try {
      // Genera una coppia di chiavi effimere
      const ephemeralPair = await SEA.pair();

      // Verifica che le chiavi siano valide
      if (!ephemeralPair || !ephemeralPair.epriv || !ephemeralPair.epub) {
        throw new Error("Impossibile generare le chiavi effimere");
      }

      // Converti la chiave privata in formato Ethereum
      const privateKey = convertToEthPk(ephemeralPair.epriv);
      const wallet = new ethers.Wallet(privateKey);

      // Genera il segreto condiviso usando le chiavi di visualizzazione
      const secret = await SEA.secret(recipientStealthPub, ephemeralPair);
      if (!secret) {
        throw new Error("Impossibile generare il segreto condiviso");
      }

      // Cifra il wallet
      const enc_wallet = await SEA.encrypt(
        JSON.stringify({
          address: wallet.address,
          privateKey: wallet.privateKey
        }), 
        secret
      );

      return {
        stealthAddress: wallet.address,
        encryptedWallet: enc_wallet,
        ephemeralPublicKey: ephemeralPair.epub
      };

    } catch (error: unknown) {
      console.error("❌ Errore nella generazione dell'indirizzo stealth:", error);
      if (error instanceof Error) {
        throw new Error("Impossibile generare l'indirizzo stealth: " + error.message);
      }
      throw new Error("Impossibile generare l'indirizzo stealth: errore sconosciuto");
    }
  }

  public async openStealthAddress(
    stealthAddress: string,
    encryptedWallet: string,
    ephemeralPublicKey: string
  ): Promise<ethers.Wallet> {
    try {
      if (!encryptedWallet || !ephemeralPublicKey) {
        throw new Error("Parametri non validi per il recupero dell'indirizzo stealth");
      }

      const publicKey = this.gun.user()._.sea.pub;
      console.log("🔑 Recupero chiavi stealth per:", publicKey);

      // Recupera le chiavi stealth
      const stealthKeys = await this.retrieveStealthKeys(publicKey);
      if (!stealthKeys) {
        console.error("❌ Chiavi stealth non trovate per:", publicKey);
        throw new Error("Impossibile recuperare le chiavi stealth. Verifica di aver generato e salvato le chiavi correttamente.");
      }

      if (!stealthKeys.stealthKeyPair || !stealthKeys.stealthKeyPair.epub || !stealthKeys.stealthKeyPair.epriv) {
        console.error("❌ Chiavi stealth incomplete:", stealthKeys);
        throw new Error("Le chiavi stealth recuperate sono incomplete o in un formato non valido.");
      }

      console.log("🔐 Decifratura con chiave di visualizzazione...");
      // Decifratura con la chiave di visualizzazione
      const secret = await SEA.secret(
        ephemeralPublicKey,
        {
          epub: stealthKeys.stealthKeyPair.epub,
          epriv: stealthKeys.stealthKeyPair.epriv
        }
      );

      if (!secret) {
        throw new Error("Impossibile generare il segreto condiviso per la visualizzazione");
      }

      const dec_wallet = await SEA.decrypt(encryptedWallet, secret);
      const walletData = JSON.parse(dec_wallet);
      const wallet = new ethers.Wallet(walletData.privateKey);

      // Verifica che l'indirizzo corrisponda
      if (wallet.address.toLowerCase() !== stealthAddress.toLowerCase()) {
        console.error("❌ Indirizzo non corrispondente:");
        console.error("Atteso:", stealthAddress);
        console.error("Ottenuto:", wallet.address);
        throw new Error("L'indirizzo stealth recuperato non corrisponde");
      }

      console.log("✅ Indirizzo stealth recuperato:", wallet.address);
      return wallet;

    } catch (error) {
      console.error("❌ Errore nel recupero dell'indirizzo stealth:", error);
      throw error;
    }
  }

  async saveStealthKeys(keys: StealthKeys): Promise<void> {
    if (!keys?.stealthKeyPair?.pub || !keys?.stealthKeyPair?.epub) {
      throw new Error("Chiavi stealth non valide per il salvataggio");
    }

    try {
      console.log("🔄 Inizio salvataggio chiavi stealth...");
      const user = this.gun.user();
      if (!user.is) {
        throw new Error("Utente non autenticato");
      }

      console.log("👤 Utente autenticato, procedo con il salvataggio...");
      const data = {
        pub: keys.stealthKeyPair.pub,
        priv: keys.stealthKeyPair.priv,
        epub: keys.stealthKeyPair.epub,
        epriv: keys.stealthKeyPair.epriv
      };

      // Salvataggio con timeout
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          console.log("💾 Salvataggio chiavi nel nodo utente...");
          user.get("stealthKeys").put(data);
          // Risolvi immediatamente dopo il put
          resolve();
        }),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error("Timeout durante il salvataggio")), 5000)
        )
      ]);

      console.log("✅ Richiesta di salvataggio inviata");

      // Breve attesa per permettere la sincronizzazione
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verifica rapida
      const saved = await new Promise<boolean>((resolve) => {
        user.get("stealthKeys").once((data: any) => {
          resolve(!!data && !!data.pub && !!data.epub);
        });
      });

      if (!saved) {
        console.warn("⚠️ Verifica immediata fallita, ma il salvataggio potrebbe essere ancora in corso");
      } else {
        console.log("✅ Verifica immediata completata con successo");
      }

    } catch (error: unknown) {
      console.error("❌ Errore nel salvataggio delle chiavi stealth:", error);
      throw error;
    }
  }

  async retrieveStealthKeys(publicKey: string): Promise<StealthKeys | null> {
    if (!publicKey) {
      throw new Error("Chiave pubblica non valida");
    }

    try {
      const user = this.gun.user();
      if (!user.is) {
        throw new Error("Utente non autenticato");
      }

      // Recupera le chiavi private
      const privateKeys = await new Promise<KeyPair>((resolve, reject) => {
        user.get("stealthKeys").once((data: any) => {
          if (!data) {
            reject(new Error("Nessuna chiave trovata"));
            return;
          }
          
          // Verifica che tutte le chiavi necessarie siano presenti
          const requiredKeys = ['pub', 'priv', 'epub', 'epriv'];
          for (const key of requiredKeys) {
            if (!data[key]) {
              reject(new Error(`Chiave ${key} mancante`));
              return;
            }
          }

          resolve({
            pub: data.pub,
            priv: data.priv,
            epub: data.epub,
            epriv: data.epriv
          });
        });
      });

      return {
        stealthKeyPair: privateKeys,
        ephemeralPublicKey: privateKeys.epub
      };

    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Nessuna chiave trovata") {
        return null;
      }
      console.error("❌ Errore nel recupero delle chiavi stealth:", error);
      throw error;
    }
  }
}
function reject(arg0: Error) {
  throw new Error("Function not implemented.");
}

