import { ethers } from 'ethers';
import type { WalletResult, StealthAddressResult } from './interfaces/WalletResult';
import Gun from 'gun';
import 'gun/sea';
import { WalletManager } from './WalletManager';
const SEA = Gun.SEA;

interface KeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}

interface StealthKeys {
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

  async generateStealthKeys(): Promise<KeyPair> {
    const pair = await SEA.pair();
    if (!pair || !pair.pub || !pair.priv || !pair.epub || !pair.epriv) {
      throw new Error("Chiavi non valide: generazione fallita");
    }
    return pair;
  }

  private async deriveStealthPrivateKey(sharedSecret: string): Promise<string> {
    // Usa il segreto condiviso come entropia per generare la chiave privata
    const hash = ethers.keccak256(
      ethers.toUtf8Bytes(sharedSecret)
    );
    return hash;
  }

  async generateStealthAddress(
    recipientPublicKey: string,
    recipientEphemeralPublicKey: string
  ): Promise<StealthAddressResult> {
    try {
      // Verifica che le chiavi siano nel formato corretto
      if (!recipientPublicKey || !recipientEphemeralPublicKey) {
        throw new Error("Chiavi non valide: parametri mancanti");
      }

      // Genera una coppia di chiavi effimere per questa transazione
      const ephemeralKeyPair = await SEA.pair();
      if (!ephemeralKeyPair?.epub || !ephemeralKeyPair?.epriv) {
        throw new Error("Chiavi non valide: impossibile generare le chiavi effimere");
      }

      console.log("🔑 Generazione chiavi effimere completata", ephemeralKeyPair);

      // Prepara le chiavi del destinatario
      const recipientKeys = {
        epub: recipientEphemeralPublicKey
      };

      // Genera il segreto condiviso
      try {
        const sharedSecret = await SEA.secret(recipientEphemeralPublicKey, ephemeralKeyPair);

        if (!sharedSecret) {
          throw new Error("Chiavi non valide: impossibile generare il segreto condiviso");
        }

        console.log("🤝 Segreto condiviso generato");

        // Genera l'indirizzo stealth usando il segreto condiviso
        const stealthPrivateKey = await this.deriveStealthPrivateKey(sharedSecret);
        const stealthWallet = new ethers.Wallet(stealthPrivateKey);
        
        console.log("💼 Wallet stealth generato:", stealthWallet.address);

        // Prepara i dati del wallet da cifrare
        const walletData = JSON.stringify({
          address: stealthWallet.address,
          privateKey: stealthWallet.privateKey
        });

        // Cifra il wallet con il segreto condiviso
        const encryptedWallet = await SEA.encrypt(walletData, sharedSecret);

        if (!encryptedWallet) {
          throw new Error("Chiavi non valide: impossibile cifrare il wallet");
        }

        console.log("🔒 Wallet cifrato con successo");

        return {
          stealthAddress: stealthWallet.address,
          ephemeralPublicKey: ephemeralKeyPair.epub,
          encryptedWallet
        };
      } catch (innerError: any) {
        console.error("❌ Errore interno:", innerError);
        if (innerError.code === "ERR_CRYPTO_ECDH_INVALID_PUBLIC_KEY") {
          throw new Error("Chiavi non valide: formato chiave pubblica non valido");
        }
        throw new Error("Chiavi non valide: " + (innerError.message || "errore sconosciuto"));
      }
    } catch (error: any) {
      console.error("❌ Errore nella generazione dell'indirizzo stealth:", error);
      throw error;
    }
  }

  async openStealthAddress(
    stealthAddress: string,
    ephemeralPublicKey: string,
    encryptedWallet: string
  ): Promise<WalletResult> {
    try {
      // Recupera le chiavi stealth dell'utente
      const keys = await this.retrieveStealthKeys();
      if (!keys?.stealthKeyPair?.epriv || !keys?.stealthKeyPair?.priv) {
        throw new Error("Chiavi stealth non trovate o incomplete");
      }

      console.log("🔐 Decifratura con chiave di visualizzazione...");
      console.log("📝 Chiavi utente:", keys.stealthKeyPair);
      console.log("🔑 Chiave effimera:", ephemeralPublicKey);
      
      // Prepara le chiavi nel formato corretto per SEA.secret
      const viewingKeyPair = {
        epriv: keys.stealthKeyPair.epriv,
        epub: keys.stealthKeyPair.epub
      };

      // Genera il segreto condiviso usando la chiave privata di visualizzazione
      const sharedSecret = await SEA.secret(ephemeralPublicKey, viewingKeyPair);

      if (!sharedSecret) {
        throw new Error("Impossibile generare il segreto condiviso per la decifratura");
      }

      console.log("🔑 Tentativo di decifratura del wallet...");
      console.log("🔐 Wallet cifrato:", encryptedWallet);

      // Decifra il wallet
      const wallet = await SEA.decrypt(encryptedWallet, sharedSecret) as WalletResult;
      
      console.log("📦 Wallet decifrato:", wallet);

      if (!wallet || typeof wallet !== 'object') {
        throw new Error("Impossibile decifrare il wallet");
      }

      if (!wallet.address || !wallet.privateKey) {
        throw new Error("Dati del wallet mancanti dopo la decifratura");
      }

      // Verifica che l'indirizzo decrittato corrisponda all'indirizzo stealth
      if (wallet.address.toLowerCase() !== stealthAddress.toLowerCase()) {
        throw new Error("L'indirizzo decrittato non corrisponde all'indirizzo stealth");
      }

      return wallet;
    } catch (error: any) {
      console.error("❌ Errore nel recupero dell'indirizzo stealth:", error);
      throw new Error(error.message || "Errore nel recupero dell'indirizzo stealth");
    }
  }

  async retrieveStealthKeys(): Promise<StealthKeys | null> {
    try {
      const user = this.gun.user();
      if (!user.is) {
        throw new Error("Utente non autenticato");
      }

      return new Promise((resolve) => {
        user.get("stealthKeys").once((data: any) => {
          if (!data || !data.pub || !data.priv || !data.epub || !data.epriv) {
            console.log("❌ Chiavi incomplete o non trovate");
            resolve(null);
            return;
          }

          resolve({
            stealthKeyPair: {
              pub: data.pub,
              priv: data.priv,
              epub: data.epub,
              epriv: data.epriv
            }
          });
        });
      });

    } catch (error) {
      console.error("❌ Errore nel recupero delle chiavi stealth:", error);
      throw error;
    }
  }

  async saveStealthKeys(stealthKeyPair: KeyPair): Promise<void> {
    if (!this.gun.user().is) {
      throw new Error("Utente non autenticato");
    }

    // Salva direttamente usando il callback di Gun
    this.gun.user().get("stealthKeys").put(stealthKeyPair, (ack: { err: string | null }) => {
      if (ack.err) {
        console.error("❌ Errore nel salvataggio:", ack.err);
        throw new Error("Errore nel salvataggio delle chiavi: " + ack.err);
      }
      console.log("✅ Chiavi salvate con successo");
    });
  }
}

