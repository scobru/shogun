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
  viewingKeyPair: KeyPair;
  spendingKeyPair: KeyPair;
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
    // Controlla se esiste stealthKeys in usernode
    const privateNode = this.gun.user();
    const stealthKeys = await privateNode.get("stealthKeys").once();
    if (stealthKeys) {
      return stealthKeys;
    }

    const viewingKeyPair = await SEA.pair();
    const stealthKeyPair = await SEA.pair();

    try {
      const v_pair: KeyPair = {
        pub: viewingKeyPair.pub,
        priv: viewingKeyPair.priv,
        epub: viewingKeyPair.epub,
        epriv: viewingKeyPair.epriv,
      };

      const s_pair: KeyPair = {
        pub: stealthKeyPair.pub,
        priv: stealthKeyPair.priv,
        epub: stealthKeyPair.epub,
        epriv: stealthKeyPair.epriv,
      };

      return {
        viewingKeyPair: v_pair,
        spendingKeyPair: s_pair,
        ephemeralPublicKey: stealthKeyPair.epub,
      };
    } catch (error) {
      console.error("Errore nella generazione delle chiavi stealth:", error);
      throw error;
    }
  }

  public async generateStealthAddress(
    recipientViewingPub: string,
    recipientSpendingPub: string
  ): Promise<{
    stealthAddress: string;
    encryptedWallet: string;
    ephemeralPublicKey: string;
  }> {
    try {
      // Genera una coppia di chiavi effimere
      const ephemeralPair = await SEA.pair();
      const privateKey = convertToEthPk(ephemeralPair.epriv);
      const wallet = new ethers.Wallet(privateKey);

      // Genera il segreto condiviso per la chiave di spesa
      const spending_secret = await SEA.secret(
        recipientSpendingPub,
        {
          epub: ephemeralPair.epub,
          epriv: ephemeralPair.epriv
        }
      );

      if (!spending_secret) {
        throw new Error("Impossibile generare il segreto condiviso per la chiave di spesa");
      }

      // Prima cifratura con la chiave di spesa
      const spending_enc = await SEA.encrypt(JSON.stringify(wallet), spending_secret);

      // Genera il segreto condiviso per la chiave di visualizzazione
      const viewing_secret = await SEA.secret(
        recipientViewingPub,
        {
          epub: ephemeralPair.epub,
          epriv: ephemeralPair.epriv
        }
      );

      if (!viewing_secret) {
        throw new Error("Impossibile generare il segreto condiviso per la chiave di visualizzazione");
      }

      // Seconda cifratura con la chiave di visualizzazione
      const viewing_enc = await SEA.encrypt(spending_enc, viewing_secret);

      if (!viewing_enc) {
        throw new Error("Impossibile cifrare il wallet");
      }

      console.log("✅ Indirizzo stealth generato:", {
        address: wallet.address,
        ephemeralPublicKey: ephemeralPair.epub
      });

      return {
        stealthAddress: wallet.address,
        encryptedWallet: viewing_enc,
        ephemeralPublicKey: ephemeralPair.epub
      };

    } catch (error) {
      console.error("❌ Errore nella generazione dell'indirizzo stealth:", error);
      throw error;
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
        throw new Error("Impossibile recuperare le chiavi stealth");
      }

      console.log("🔐 Decifratura con chiave di visualizzazione...");
      // Decifratura con la chiave di visualizzazione
      const viewing_secret = await SEA.secret(
        ephemeralPublicKey,
        {
          epub: stealthKeys.viewingKeyPair.epub,
          epriv: stealthKeys.viewingKeyPair.epriv
        }
      );

      if (!viewing_secret) {
        throw new Error("Impossibile generare il segreto condiviso per la visualizzazione");
      }

      const viewing_dec = await SEA.decrypt(encryptedWallet, viewing_secret);
      if (!viewing_dec) {
        throw new Error("Impossibile decifrare il wallet con la chiave di visualizzazione");
      }

      console.log("🔐 Decifratura con chiave di spesa...");
      // Decifratura con la chiave di spesa
      const spending_secret = await SEA.secret(
        ephemeralPublicKey,
        {
          epub: stealthKeys.spendingKeyPair.epub,
          epriv: stealthKeys.spendingKeyPair.epriv
        }
      );

      if (!spending_secret) {
        throw new Error("Impossibile generare il segreto condiviso per la spesa");
      }

      const spending_dec = await SEA.decrypt(viewing_dec, spending_secret);
      if (!spending_dec) {
        throw new Error("Impossibile decifrare il wallet con la chiave di spesa");
      }

      const walletData = JSON.parse(spending_dec);
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

  public async saveStealthKeys(stealthKeys: StealthKeys): Promise<void> {
    try {
      console.log("💾 Salvando chiavi stealth...");
      const publicKey = this.gun.user()._.sea.pub;
      console.log("🔑 Chiave pubblica:", publicKey);

      // Salva le chiavi private nel nodo utente
      const privateNode = this.gun.user();
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          privateNode.get("stealthKeys").get("viewingKeyPair").put(stealthKeys.viewingKeyPair, (ack: { err?: string }) => {
            if (ack.err) {
              console.error("❌ Errore nel salvare le chiavi di visualizzazione:", ack.err);
              reject(new Error(ack.err));
            } else {
              console.log("✅ Chiavi di visualizzazione salvate");
              resolve();
            }
          });
        }),
        new Promise<void>((resolve, reject) => {
          privateNode.get("stealthKeys").get("spendingKeyPair").put(stealthKeys.spendingKeyPair, (ack: { err?: string }) => {
            if (ack.err) {
              console.error("❌ Errore nel salvare le chiavi di spesa:", ack.err);
              reject(new Error(ack.err));
            } else {
              console.log("✅ Chiavi di spesa salvate");
              resolve();
            }
          });
        })
      ]);

      // Salva i dati pubblici
      const publicData = {
        v_pub: stealthKeys.viewingKeyPair.pub,
        v_epub: stealthKeys.viewingKeyPair.epub,
        s_pub: stealthKeys.spendingKeyPair.pub,
        s_epub: stealthKeys.spendingKeyPair.epub
      };

      await new Promise<void>((resolve, reject) => {
        this.gun.get("stealth").get(publicKey).put(publicData, (ack: { err?: string }) => {
          if (ack.err) {
            console.error("❌ Errore nel salvare i dati pubblici:", ack.err);
            reject(new Error(ack.err));
          } else {
            console.log("✅ Dati pubblici salvati");
            resolve();
          }
        });
      });

      // Verifica il salvataggio
      const savedData = await new Promise<any>((resolve) => {
        this.gun.get("stealth").get(publicKey).once((data: any) => {
          console.log("📥 Verifica dati salvati:", data);
          resolve(data);
        });
      });

      if (!savedData || 
          savedData.v_pub !== publicData.v_pub ||
          savedData.v_epub !== publicData.v_epub ||
          savedData.s_pub !== publicData.s_pub ||
          savedData.s_epub !== publicData.s_epub) {
        throw new Error("Verifica del salvataggio fallita: i dati non corrispondono");
      }

      console.log("✅ Verifica completata con successo");

    } catch (error) {
      console.error("❌ Errore nel salvataggio delle chiavi stealth:", error);
      throw error;
    }
  }

  public async retrieveStealthKeys(publicKey: string): Promise<StealthKeys | null> {
    try {
      console.log("🔍 Cercando chiavi stealth per:", publicKey);
      
      // Recupera le chiavi pubbliche
      const publicData = await new Promise<any>((resolve) => {
        this.gun.get("stealth").get(publicKey).once((data: any) => {
          console.log("📥 Dati pubblici ricevuti:", data);
          resolve(data);
        });
      });

      if (!publicData || !publicData.v_pub || !publicData.v_epub || !publicData.s_pub || !publicData.s_epub) {
        console.log("⚠️ Dati pubblici mancanti o incompleti:", publicData);
        return null;
      }

      // Recupera le chiavi private dal nodo utente
      const privateNode = this.gun.user();
      const viewingKeyPair = await new Promise<KeyPair | null>((resolve) => {
        privateNode.get("stealthKeys").get("viewingKeyPair").once((data: any) => {
          console.log("📥 Chiavi di visualizzazione ricevute:", data);
          if (!data || !data.pub || !data.priv || !data.epub || !data.epriv) {
            resolve(null);
          } else {
            resolve(data);
          }
        });
      });

      const spendingKeyPair = await new Promise<KeyPair | null>((resolve) => {
        privateNode.get("stealthKeys").get("spendingKeyPair").once((data: any) => {
          console.log("📥 Chiavi di spesa ricevute:", data);
          if (!data || !data.pub || !data.priv || !data.epub || !data.epriv) {
            resolve(null);
          } else {
            resolve(data);
          }
        });
      });

      if (!viewingKeyPair || !spendingKeyPair) {
        console.log("⚠️ Chiavi private mancanti");
        return null;
      }

      const result = {
        viewingKeyPair,
        spendingKeyPair,
        ephemeralPublicKey: publicData.s_epub
      };

      console.log("✅ Chiavi stealth recuperate:", result);
      return result;

    } catch (error) {
      console.error("❌ Errore nel recupero delle chiavi stealth:", error);
      throw error;
    }
  }
}
