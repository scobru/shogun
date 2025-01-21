import { ethers } from "ethers";
import Gun from "gun";
import "gun/sea";

// Se hai definizioni di Gun e SEA, puoi importarle qui.
// Per ora, usiamo `any` per semplificare.
const SEA = (Gun as any).SEA;

/**
 * Interfaccia base per chiave stealth
 */
export interface StealthKeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}

/**
 * Interfaccia wrapper usata in Gun
 */
export interface StealthKeyPairWrapper {
  stealthKeyPair: StealthKeyPair;
  [key: string]: any;
}

/**
 * Risultato della generazione di un indirizzo stealth
 */
export interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}

/**
 * Callback di utilità generica: (error?: Error, data?: T) => void
 */
type Callback<T> = (error?: Error, data?: T) => void;

/**
 * Converte una privateKey in formato base64Url (Gun) a hex (Ethereum)
 */
function convertToEthPk(gunPrivateKey: string): string {
  const base64UrlToHex = (base64url: string): string => {
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
  };

  if (!gunPrivateKey || typeof gunPrivateKey !== "string") {
    throw new Error("Impossibile convertire la chiave privata: input non valido");
  }

  try {
    const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
    return hexPrivateKey;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(
        `Impossibile convertire la chiave privata: ${error.message}`
      );
    } else {
      throw new Error("Impossibile convertire la chiave privata: errore sconosciuto");
    }
  }
}

/**
 * Classe principale per gestire la stealth logic usando Gun e SEA
 */
export class StealthChain {
  // Se vuoi tipizzare correttamente Gun, sostituisci `any` con l'interfaccia corretta
  private gun: any;

  /**
   * Inietta l'istanza di Gun dall'esterno
   */
  constructor(gun: any) {
    this.gun = gun;
  }

  /**
   * Rimuove il tilde (~) iniziale da una chiave pubblica, se presente
   */
  private formatPublicKey(publicKey: string): string {
    if (!publicKey) {
      throw new Error("Chiave pubblica non valida: parametro mancante");
    }
    return publicKey.startsWith("~") ? publicKey.slice(1) : publicKey;
  }

  /**
   * Genera le chiavi stealth se non esistono, altrimenti le restituisce
   */
  public generateStealthKeys(cb: Callback<StealthKeyPair>): void {
    const user = this.gun.user();
    if (!user?.is) {
      console.error("Utente non autenticato");
      return cb(new Error("Utente non autenticato o user mancante"));
    }

    console.log("Generazione chiavi stealth per utente:", user.is.pub);

    // Prima controlliamo se esistono già le chiavi
    user.get("stealthKeys").once((data: any) => {
      console.log("Dati chiavi esistenti:", data);
      
      if (data?.stealthKeyPair) {
        console.log("Chiavi stealth esistenti trovate");
        return cb(undefined, data.stealthKeyPair);
      }

      console.log("Generazione nuove chiavi stealth...");
      // Altrimenti generiamo
      SEA.pair((pair: any) => {
        console.log("Chiavi generate da SEA:", pair);
        
        if (!pair?.pub || !pair?.priv || !pair?.epub || !pair?.epriv) {
          console.error("Chiavi generate non valide:", pair);
          return cb(new Error("Chiavi generate non valide"));
        }

        const stealthKeyPair: StealthKeyPair = {
          pub: pair.pub,
          priv: pair.priv,
          epub: pair.epub,
          epriv: pair.epriv
        };

        // Salviamo
        this.saveStealthKeys(stealthKeyPair, (error?: Error) => {
          if (error) {
            console.error("Errore nel salvataggio delle chiavi:", error);
            return cb(error);
          }
          console.log("Chiavi stealth salvate con successo");
          cb(undefined, stealthKeyPair);
        });
      });
    });
  }

  /**
   * Genera un indirizzo stealth per la chiave pubblica del destinatario (recipientPublicKey)
   */
  public generateStealthAddress(
    recipientPublicKey: string,
    cb: Callback<StealthAddressResult>
  ): void {
    if (!recipientPublicKey) {
      return cb(new Error("Chiavi non valide: parametri mancanti o non validi"));
    }

    const formattedPubKey = this.formatPublicKey(recipientPublicKey);

    this.gun
      .get("stealthKeys")
      .get(formattedPubKey)
      .once((recipientEpub: string) => {
        if (!recipientEpub) {
          return cb(new Error("Chiave pubblica effimera non trovata"));
        }

        SEA.pair((ephemeralKeyPair: any) => {
          if (!ephemeralKeyPair?.epub || !ephemeralKeyPair?.epriv) {
            return cb(new Error("Chiavi effimere non valide"));
          }

          SEA.secret(recipientEpub, ephemeralKeyPair, (sharedSecret: string) => {
            if (!sharedSecret) {
              return cb(new Error("Generazione segreto condiviso fallita"));
            }

            const stealthPrivateKey = ethers.keccak256(
              ethers.toUtf8Bytes(sharedSecret)
            );
            const stealthWallet = new ethers.Wallet(stealthPrivateKey);
            cb(undefined, {
              stealthAddress: stealthWallet.address,
              ephemeralPublicKey: ephemeralKeyPair.epub,
              recipientPublicKey,
            });
          });
        });
      });
  }

  /**
   * Apre un indirizzo stealth, ricavando la chiave privata a partire dall'ephemeralPublicKey
   */
  public openStealthAddress(
    stealthAddress: string,
    ephemeralPublicKey: string,
    cb: Callback<ethers.Wallet>
  ): void {
    if (!stealthAddress || !ephemeralPublicKey) {
      return cb(
        new Error("Parametri mancanti: stealthAddress o ephemeralPublicKey")
      );
    }

    const user = this.gun.user();
    if (!user?.is) {
      return cb(new Error("Utente non autenticato o user mancante"));
    }

    // Recupera le chiavi stealth
    const node = user.get("stealthKeys");
    node.once((keys: any) => {
      console.log("Chiavi recuperate per apertura:", keys);
      
      if (!keys?.epriv || !keys?.epub) {
        console.error("Chiavi stealth mancanti:", keys);
        return cb(new Error("Chiavi stealth non trovate o incomplete"));
      }

      const { epriv, epub } = keys;

      // Genera il segreto condiviso
      SEA.secret(ephemeralPublicKey, { epriv, epub }, (sharedSecret: string) => {
        if (!sharedSecret) {
          console.error("Impossibile generare il segreto condiviso");
          return cb(new Error("Impossibile generare il segreto condiviso"));
        }

        console.log("Segreto condiviso generato");

        try {
          // Deriva la chiave privata
          const stealthPrivateKey = ethers.keccak256(
            ethers.toUtf8Bytes(sharedSecret)
          );
          const stealthWallet = new ethers.Wallet(stealthPrivateKey);

          // Verifica che l'indirizzo derivato corrisponda
          if (
            stealthWallet.address.toLowerCase() !== stealthAddress.toLowerCase()
          ) {
            console.error("Indirizzo derivato non corrisponde:", {
              derivato: stealthWallet.address,
              atteso: stealthAddress
            });
            return cb(
              new Error(
                "L'indirizzo derivato non corrisponde all'indirizzo stealth fornito"
              )
            );
          }

          console.log("Wallet stealth recuperato con successo");
          cb(undefined, stealthWallet);
        } catch (error) {
          console.error("Errore nella derivazione del wallet:", error);
          cb(new Error("Errore nella derivazione del wallet stealth"));
        }
      });
    });
  }

  /**
   * Recupera le chiavi stealth (epub) dal registro pubblico, se presenti
   */
  public retrieveStealthKeysFromRegistry(
    publicKey: string,
    cb: Callback<string>
  ): void {
    if (!publicKey) {
      return cb(new Error("Chiave pubblica non valida"));
    }
    const formattedPubKey = this.formatPublicKey(publicKey);

    this.gun
      .get("stealthKeys")
      .get(formattedPubKey)
      .once((data: string | null) => {
        if (!data) {
          return cb(new Error("Chiavi non trovate nel registro"));
        }
        cb(undefined, data);
      });
  }

  /**
   * Recupera le chiavi stealth dalla sessione utente loggato
   */
  public retrieveStealthKeysFromUser(cb: Callback<StealthKeyPair>): void {
    const user = this.gun.user();
    if (!user?.is) {
      return cb(new Error("Utente non autenticato o user mancante"));
    }

    const node = user.get("stealthKeys");
    
    // Recupera tutti i campi separatamente
    node.once((data: any) => {
      console.log("Dati recuperati:", data);
      
      if (!data?.pub || !data?.priv || !data?.epub || !data?.epriv) {
        return cb(new Error("Chiavi stealth non trovate o incomplete"));
      }

      const stealthKeyPair: StealthKeyPair = {
        pub: data.pub,
        priv: data.priv,
        epub: data.epub,
        epriv: data.epriv
      };

      cb(undefined, stealthKeyPair);
    });
  }

  /**
   * Salva le chiavi stealth nell'utente loggato e aggiorna il registro pubblico
   */
  public saveStealthKeys(stealthKeyPair: StealthKeyPair, cb: Callback<void>): void {
    if (!stealthKeyPair || !stealthKeyPair.pub || !stealthKeyPair.epub) {
      console.error("Chiavi stealth non valide:", stealthKeyPair);
      return cb(new Error("Chiavi stealth non valide o incomplete"));
    }

    const user = this.gun.user();
    if (!user?.is) {
      console.error("Utente non autenticato");
      return cb(new Error("Utente non autenticato"));
    }

    console.log("Salvataggio chiavi per utente:", user.is.pub);

    // Salva prima nel registro pubblico
    this.gun.get("stealthKeys").get(user.is.pub).put(stealthKeyPair.epub);

    // Poi salva le chiavi private nell'utente
    const node = user.get("stealthKeys");
    
    // Salva ogni campo separatamente per evitare problemi di serializzazione
    node.get("pub").put(stealthKeyPair.pub);
    node.get("priv").put(stealthKeyPair.priv);
    node.get("epub").put(stealthKeyPair.epub);
    node.get("epriv").put(stealthKeyPair.epriv);

    // Verifica il salvataggio
    node.once((data: any) => {
      console.log("Verifica salvataggio:", data);
      if (data?.pub && data?.priv && data?.epub && data?.epriv) {
        console.log("Chiavi salvate con successo");
        cb();
      } else {
        console.error("Errore nel salvataggio delle chiavi");
        cb(new Error("Errore nel salvataggio delle chiavi"));
      }
    });
  }
}
