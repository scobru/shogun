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

interface StealthKeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}

interface GunAck {
  err: string | null;
  ok: boolean;
}

interface GunData extends StealthKeyPairWrapper {
  [key: string]: any;
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
    if (!publicKey) {
      throw new Error("Chiave pubblica non valida: parametro mancante");
    }
    
    // Rimuovi il tilde iniziale se presente
    return publicKey.startsWith("~") ? publicKey.slice(1) : publicKey;
  }

  private async saveAndVerifyKeys(user: any, stealthKeyPair: StealthKeyPairWrapper): Promise<void> {
    console.log("💾 Salvataggio chiavi...");
    
    // Salva le chiavi nell'utente
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("Timeout salvataggio chiavi")), 5000);
      
      user.get("stealthKeys").put(stealthKeyPair, (ack: GunAck) => {
        clearTimeout(timeoutId);
        if (ack.err) {
          console.error("❌ Errore nel salvataggio chiavi:", ack.err);
          reject(new Error(ack.err));
        } else {
          console.log("✅ Chiavi salvate nell'utente");
          resolve();
        }
      });
    });

    // Verifica il salvataggio
    const savedKeys = await new Promise<StealthKeyPairWrapper>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("Timeout verifica chiavi")), 5000);
      
      user.get("stealthKeys").once((data: StealthKeyPairWrapper) => {
        clearTimeout(timeoutId);
        console.log("📝 Verifica chiavi salvate:", data);
        resolve(data);
      });
    });

    if (!savedKeys?.stealthKeyPair?.pub) {
      throw new Error("Chiavi non salvate correttamente nell'utente");
    }

    // Salva la chiave pubblica nel registro
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("Timeout salvataggio chiave pubblica")), 5000);
      
      this.gun.get("stealthKeys").get(user.is.pub).put(stealthKeyPair.stealthKeyPair.epub, (ack: GunAck) => {
        clearTimeout(timeoutId);
        if (ack.err) {
          console.error("❌ Errore nel salvataggio chiave pubblica:", ack.err);
          reject(new Error(ack.err));
        } else {
          console.log("✅ Chiave pubblica salvata nel registro");
          resolve();
        }
      });
    });

    // Verifica il salvataggio nel registro
    const savedPubKey = await new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("Timeout verifica chiave pubblica")), 5000);
      
      this.gun.get("stealthKeys").get(user.is.pub).once((data: string) => {
        clearTimeout(timeoutId);
        console.log("📝 Verifica chiave pubblica salvata:", data);
        resolve(data);
      });
    });

    if (!savedPubKey) {
      throw new Error("Chiave pubblica non salvata correttamente nel registro");
    }
  }

  generateStealthKeys(cb: (error?: Error, data?: StealthKeyPair) => void): void {
    const user = this.gun.user();
    console.log("🔑 Inizio generazione chiavi stealth...");

    // Verifica chiavi esistenti
    user.get("stealthKeys").once((data: GunData) => {
      console.log("📝 Dati chiavi esistenti:", data);
      
      if (data?.stealthKeyPair) {
        console.log("✅ Chiavi stealth esistenti trovate");
        cb(undefined, data.stealthKeyPair);
        return;
      }

      console.log("⚠️ Nessuna chiave esistente trovata, genero nuove chiavi...");
      SEA.pair((pair) => {
        if (!pair?.pub || !pair?.priv || !pair?.epub || !pair?.epriv) {
          cb(new Error("Chiavi non valide: generazione fallita"));
          return;
        }

        console.log("✨ Chiavi generate con successo");
        
        // Salva le chiavi
        this.saveStealthKeys(pair, (error) => {
          if (error) {
            cb(error);
            return;
          }
          cb(undefined, pair);
        });
      });
    });
  }

  private async deriveStealthPrivateKey(sharedSecret: string): Promise<string> {
    // Usa il segreto condiviso come entropia per generare la chiave privata
    const hash = ethers.keccak256(ethers.toUtf8Bytes(sharedSecret));
    return hash;
  }

  generateStealthAddress(
    recipientPublicKey: string,
    cb: (error?: Error, data?: StealthAddressResult) => void
  ): void {
    console.log("🎯 Inizio generazione indirizzo stealth per:", recipientPublicKey);
    
    if (!recipientPublicKey) {
      cb(new Error("Chiavi non valide: parametri mancanti o non validi"));
      return;
    }

    const formattedPubKey = this.formatPublicKey(recipientPublicKey);
    console.log("🔍 Recupero chiave pubblica effimera dal registro per:", formattedPubKey);
    
    this.gun.get("stealthKeys").get(formattedPubKey).once((recipientEpub: string) => {
      if (!recipientEpub) {
        cb(new Error("Chiave pubblica effimera non trovata"));
        return;
      }

      console.log("📝 Chiave pubblica effimera trovata:", recipientEpub);
      console.log("🔐 Generazione coppia di chiavi effimere...");
      
      SEA.pair((ephemeralKeyPair) => {
        if (!ephemeralKeyPair?.epub || !ephemeralKeyPair?.epriv) {
          cb(new Error("Chiavi non valide: generazione chiavi effimere fallita"));
          return;
        }
        console.log("✅ Chiavi effimere generate");

        console.log("🤝 Generazione segreto condiviso...");
        SEA.secret(recipientEpub, ephemeralKeyPair, (sharedSecret) => {
          if (!sharedSecret) {
            cb(new Error("Chiavi non valide: generazione segreto condiviso fallita"));
            return;
          }
          console.log("✅ Segreto condiviso generato");

          console.log("🔑 Derivazione chiave privata stealth...");
          const stealthPrivateKey = ethers.keccak256(ethers.toUtf8Bytes(sharedSecret));
          const stealthWallet = new ethers.Wallet(stealthPrivateKey);
          const stealthAddress = stealthWallet.address;
          console.log("✅ Indirizzo stealth generato:", stealthAddress);

          cb(undefined, {
            stealthAddress,
            ephemeralPublicKey: ephemeralKeyPair.epub,
            recipientPublicKey,
          });
        });
      });
    });
  }

  openStealthAddress(
    stealthAddress: string,
    ephemeralPublicKey: string,
    cb: (error?: Error, data?: WalletResult) => void
  ): void {
    console.log("🔓 Inizio apertura indirizzo stealth...");
    console.log("📝 Indirizzo stealth:", stealthAddress);
    console.log("🔑 Chiave pubblica effimera:", ephemeralPublicKey);

    const user = this.gun.user();
    console.log("🔍 Recupero chiavi stealth dell'utente...");
    
    user.get("stealthKeys").once((keys: StealthKeyPairWrapper) => {
      if (!keys?.stealthKeyPair?.epriv || !keys?.stealthKeyPair?.priv) {
        cb(new Error("Chiavi stealth non trovate o incomplete"));
        return;
      }

      console.log("✅ Chiavi stealth trovate");
      console.log("🔐 Preparazione chiavi per la decifratura...");

      const viewingKeyPair = {
        epriv: keys.stealthKeyPair.epriv,
        epub: keys.stealthKeyPair.epub,
      };

      console.log("🤝 Generazione segreto condiviso...");
      SEA.secret(ephemeralPublicKey, viewingKeyPair, (sharedSecret) => {
        if (!sharedSecret) {
          cb(new Error("Impossibile generare il segreto condiviso per la decifratura"));
          return;
        }
        console.log("✅ Segreto condiviso generato");

        console.log("🔑 Derivazione chiave privata stealth...");
        const stealthPrivateKey = ethers.keccak256(ethers.toUtf8Bytes(sharedSecret));
        const stealthWallet = new ethers.Wallet(stealthPrivateKey);
        console.log("✅ Wallet stealth recuperato");

        if (!stealthWallet.address || !stealthWallet.privateKey) {
          cb(new Error("Dati del wallet mancanti dopo la decifratura"));
          return;
        }

        console.log("🔍 Verifica corrispondenza indirizzi...");
        console.log("📝 Indirizzo decrittato:", stealthWallet.address);
        console.log("📝 Indirizzo atteso:", stealthAddress);

        if (stealthWallet.address.toLowerCase() !== stealthAddress.toLowerCase()) {
          cb(new Error("L'indirizzo decrittato non corrisponde all'indirizzo stealth"));
          return;
        }

        console.log("✅ Indirizzo stealth aperto con successo");
        cb(undefined, stealthWallet);
      });
    });
  }

  retrieveStealthKeysFromRegistry(publicKey: string, cb: (error?: Error, data?: string) => void): void {
    console.log("🔍 Recupero chiavi stealth dal registro per:", publicKey);
    
    if (!publicKey) {
      cb(new Error("Chiave pubblica non valida"));
      return;
    }

    const formattedPubKey = this.formatPublicKey(publicKey);
    this.gun.get("stealthKeys").get(formattedPubKey).once((data: string | null) => {
      if (!data) {
        cb(new Error("Chiavi non trovate nel registro"));
        return;
      }
      console.log("✅ Chiavi recuperate dal registro con successo");
      cb(undefined, data);
    });
  }

  retrieveStealthKeysFromUser(cb: (error?: Error, data?: StealthKeyPair) => void): void {
    console.log("🔍 Recupero chiavi stealth dall'utente");
    
    this.gun.user().get("stealthKeys").once((data: GunData) => {
      if (!data || !data.stealthKeyPair) {
        cb(new Error("Chiavi stealth non trovate"));
        return;
      }
      console.log("✅ Chiavi stealth recuperate con successo");
      cb(undefined, data.stealthKeyPair);
    });
  }

  saveStealthKeys(stealthKeyPair: StealthKeyPair, cb: (error?: Error) => void): void {
    console.log("💾 Inizio salvataggio chiavi stealth");
    
    if (!stealthKeyPair || !stealthKeyPair.pub || !stealthKeyPair.epub) {
      const err = new Error("Chiavi stealth non valide o incomplete");
      console.error("❌", err.message);
      cb(err);
      return;
    }

    const user = this.gun.user();
    if (!user.is) {
      const err = new Error("Utente non autenticato");
      console.error("❌", err.message);
      cb(err);
      return;
    }

    console.log("📝 Salvataggio chiavi nell'utente...");
    user.get("stealthKeys").put({ stealthKeyPair }, (ack: GunAck) => {
      if (ack.err) {
        const err = new Error(`Errore nel salvataggio delle chiavi: ${ack.err}`);
        console.error("❌", err.message);
        cb(err);
        return;
      }

      console.log("✅ Chiavi salvate nell'utente");
      console.log("📝 Salvataggio chiave pubblica nel registro...");
      
      this.gun.get("stealthKeys").get(user.is.pub).put(stealthKeyPair.epub, (regAck: GunAck) => {
        if (regAck.err) {
          const err = new Error(`Errore nel salvataggio nel registro: ${regAck.err}`);
          console.error("❌", err.message);
          cb(err);
          return;
        }
        
        console.log("✅ Chiave pubblica salvata nel registro");
        console.log("🎉 Salvataggio completato con successo");
        cb();
      });
    });
  }
}
