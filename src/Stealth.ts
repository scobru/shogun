import { ethers } from "ethers";
import Gun from "gun";
import "gun/sea";

const SEA = Gun.SEA;

export interface KeyPair {
  epub: string;
  epriv: string;
  pub?: string;   // Opzionale per compatibilità con SEA
  priv?: string;  // Opzionale per compatibilità con SEA
}

export interface GunKeyPair {
  pub: string;
  epub: string;
  epriv: string;
  priv: string;
}

/**
 * Derives a shared key from two public keys
 * @param theirPub - The other party's public key
 * @param myKeyPair - The user's keypair
 * @returns Promise resolving to the derived shared key pair
 * @throws Error if either public key is invalid
 */
async function deriveSharedKey(
  theirPub: string,
  myKeyPair: KeyPair
): Promise<KeyPair> {
  try {
    console.log("🔑 Deriving shared key with:");
    console.log("Their public key:", theirPub);
    console.log("My keypair:", myKeyPair);

    if (!theirPub || typeof theirPub !== "string" || theirPub.length === 0) {
      throw new Error("Chiave pubblica del destinatario non valida");
    }
    if (
      !myKeyPair ||
      !myKeyPair.epriv ||
      !myKeyPair.epub ||
      typeof myKeyPair.epriv !== "string" ||
      typeof myKeyPair.epub !== "string" ||
      myKeyPair.epriv.length === 0 ||
      myKeyPair.epub.length === 0
    ) {
      throw new Error(
        "Keypair non valido per la derivazione della chiave condivisa"
      );
    }

    // Crea un keypair completo per SEA.secret
    const pair = {
      epub: myKeyPair.epub,
      epriv: myKeyPair.epriv,
      pub: myKeyPair.epub,  // Usa epub come pub se non fornito
      priv: myKeyPair.epriv // Usa epriv come priv se non fornito
    };

    // Usa SEA.secret per derivare la chiave condivisa
    const sharedSecret = await SEA.secret(theirPub, pair);
    if (!sharedSecret) {
      throw new Error("Impossibile derivare il segreto condiviso");
    }

    // Converti il segreto in hex
    const sharedSecretHex = base64UrlToHex(sharedSecret as string);
    console.log("Derived shared key:", sharedSecretHex);

    return {
      epub: theirPub,
      epriv: sharedSecretHex,
    };
  } catch (error) {
    console.error("Error in deriveSharedKey:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      "Errore sconosciuto nella derivazione della chiave condivisa"
    );
  }
}

/**
 * Converte una stringa base64url in hex
 * @param base64url - Stringa in formato base64url
 * @returns Stringa in formato hex
 */
function base64UrlToHex(base64url: string): string {
  try {
    // Per le chiavi SEA, prendi solo la prima parte prima del punto
    const parts = base64url.split('.');
    const mainKey = parts[0];
    
    // Converti base64url in base64 standard
    const padding = "=".repeat((4 - (mainKey.length % 4)) % 4);
    const base64 = mainKey.replace(/-/g, "+").replace(/_/g, "/") + padding;
    
    // Converti base64 in binario
    const binary = atob(base64);
    
    // Converti binario in hex
    const hex = Array.from(binary, (char) =>
      char.charCodeAt(0).toString(16).padStart(2, "0")
    ).join("");
    
    return "0x" + hex;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Impossibile convertire la chiave da base64url a hex: ${error.message}`);
    }
    throw new Error("Impossibile convertire la chiave da base64url a hex: errore sconosciuto");
  }
}

/**
 * Derives a stealth private key from a shared secret and receiver's spending key
 * @param sharedSecretHex - The shared secret in hex format
 * @param receiverSpendingKeyBase64 - The receiver's spending key in base64url format
 * @returns The derived stealth private key
 */
function deriveStealthPrivateKey(
  sharedSecretHex: string,
  receiverSpendingKeyBase64: string
): string {
  console.log("🔐 Deriving stealth private key with:");
  console.log("Shared secret:", sharedSecretHex);
  console.log("Receiver spending key:", receiverSpendingKeyBase64);

  try {
    // Converti la chiave di spesa da base64url a hex
    const spendingKeyHex = base64UrlToHex(receiverSpendingKeyBase64);
    console.log("Converted spending key to hex:", spendingKeyHex);

    // Calcola l'hash di (shared_secret || spending_key)
    const stealthPrivateKey = ethers.keccak256(
      ethers.concat([
        ethers.getBytes(sharedSecretHex),
        ethers.getBytes(spendingKeyHex),
      ])
    );

    console.log("Derived stealth private key:", stealthPrivateKey);
    return stealthPrivateKey;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Errore nella derivazione della chiave privata stealth: ${error.message}`);
    }
    throw new Error("Errore nella derivazione della chiave privata stealth: errore sconosciuto");
  }
}

/**
 * Class for handling stealth address generation and recovery
 */
export class StealthChain {
  private gun: any;

  constructor(gun?: any) {
    this.gun = gun;
  }

  /**
   * Generates spending key and viewing key for receiver
   * @param pair - The GunDB keypair to use for encryption
   * @returns Promise resolving to generated spending and viewing keys
   */
  public async generateStealthKeys(
    pair: GunKeyPair
  ): Promise<{ spendingKey: string; viewingKey: string }> {
    // Genera una coppia di chiavi per la visualizzazione
    const viewingKeyPair = await SEA.pair();
    // Genera una coppia di chiavi per la spesa
    const spendingKeyPair = await SEA.pair();

    if (!viewingKeyPair || !spendingKeyPair) {
      throw new Error("Impossibile generare le chiavi stealth");
    }

    return {
      spendingKey: spendingKeyPair.pub,  // Usa la chiave pubblica per la spesa
      viewingKey: viewingKeyPair.pub,    // Usa la chiave pubblica per la visualizzazione
    };
  }

  /**
   * Saves receiver's viewing and spending keys to localStorage
   * @param alias - The alias to store the keys under
   * @param stealthKeys - The stealth keys to store
   */
  public async saveStealthKeysLocally(
    alias: string,
    stealthKeys: { spendingKey: string; viewingKey: string }
  ): Promise<void> {
    localStorage.setItem(`stealthKeys_${alias}`, JSON.stringify(stealthKeys));
  }

  /**
   * Retrieves receiver's viewing and spending keys from localStorage
   * @param alias - The alias to retrieve keys for
   * @returns Promise resolving to the stored stealth keys
   * @throws Error if keys are not found or invalid
   */
  public async retrieveStealthKeysLocally(
    alias: string
  ): Promise<{ spendingKey: string; viewingKey: string }> {
    const stealthKeys = localStorage.getItem(`stealthKeys_${alias}`);
    if (!stealthKeys) {
      throw new Error("Chiavi stealth non trovate in localStorage");
    }
    const parsed = JSON.parse(stealthKeys);
    if (!parsed || !parsed.spendingKey || !parsed.viewingKey) {
      throw new Error("Chiavi stealth non valide in localStorage");
    }
    return parsed;
  }

  /**
   * Saves receiver's viewing and spending keys to GunDB
   * @param alias - The alias to store the keys under
   * @param stealthKeys - The stealth keys to store
   * @throws Error if GunDB is not initialized
   */
  public async saveStealthKeys(
    alias: string,
    stealthKeys: { spendingKey: string; viewingKey: string }
  ): Promise<void> {
    if (!this.gun) {
      throw new Error("Gun non inizializzato");
    }
    this.gun.get(`stealthKeys/${alias}`).put(stealthKeys);
  }

  /**
   * Retrieves receiver's viewing and spending keys from GunDB
   * @param alias - The alias to retrieve keys for
   * @returns Promise resolving to the stored stealth keys
   * @throws Error if GunDB is not initialized or keys are not found
   */
  public async retrieveStealthKeys(
    alias: string
  ): Promise<{ spendingKey: string; viewingKey: string }> {
    if (!this.gun) {
      throw new Error("Gun non inizializzato");
    }

    if (!alias || typeof alias !== "string") {
      throw new Error("Chiavi stealth non trovate: alias non valido");
    }

    return new Promise((resolve, reject) => {
      this.gun.get(`stealthKeys/${alias}`).once((data: any) => {
        if (!data) {
          reject(new Error("Chiavi stealth non trovate"));
          return;
        }
        if (!data.spendingKey || !data.viewingKey) {
          reject(new Error("Chiavi stealth non trovate o incomplete"));
          return;
        }
        resolve({
          spendingKey: data.spendingKey,
          viewingKey: data.viewingKey,
        });
      });
    });
  }

  /**
   * Generates a stealth address for a receiver
   * @param receiverViewingPublicKey - The receiver's viewing public key
   * @param receiverSpendingPublicKey - The receiver's spending public key
   * @returns Promise resolving to object containing stealth address and ephemeral public key
   * @throws Error if address generation fails
   */
  async generateStealthAddress(
    receiverViewingPublicKey: string,
    receiverSpendingPublicKey: string
  ): Promise<{ stealthAddress: string; ephemeralPublicKey: string }> {
    // Validazione input
    if (!receiverViewingPublicKey || !receiverSpendingPublicKey) {
      throw new Error("Chiave pubblica non valida: le chiavi non possono essere vuote");
    }

    try {
      // Genera coppia di chiavi effimere
      const ephemeralKeyPair = await SEA.pair();
      if (!ephemeralKeyPair) {
        throw new Error("Impossibile generare il keypair effimero");
      }

      // Calcola il segreto condiviso
      const sharedSecret = await SEA.secret(receiverViewingPublicKey, ephemeralKeyPair);
      if (!sharedSecret) {
        throw new Error("Impossibile calcolare il segreto condiviso: chiave pubblica non valida");
      }

      // Deriva la chiave privata stealth
      const stealthPrivateKey = await this.deriveStealthPrivateKey(sharedSecret, receiverSpendingPublicKey);
      
      // Crea il wallet stealth
      const stealthWallet = new ethers.Wallet(stealthPrivateKey);

      return {
        stealthAddress: stealthWallet.address,
        ephemeralPublicKey: ephemeralKeyPair.epub
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Public key is not valid")) {
          throw new Error("Chiave pubblica non valida per la curva specificata");
        }
        throw error;
      }
      throw new Error("Errore sconosciuto durante la generazione dell'indirizzo stealth");
    }
  }

  /**
   * Recovers a stealth address using the receiver's keys
   * @param stealthAddress - The stealth address to recover
   * @param senderEphemeralPublicKey - The sender's ephemeral public key
   * @param receiverViewingKeyPair - The receiver's viewing key pair
   * @param receiverSpendingKey - The receiver's spending key
   * @returns Promise resolving to the recovered wallet
   * @throws Error if address recovery fails
   */
  async openStealthAddress(
    stealthAddress: string,
    senderEphemeralPublicKey: string,
    receiverViewingKeyPair: GunKeyPair,
    receiverSpendingKey: string
  ): Promise<{ address: string; privateKey: string }> {
    // Validazione input
    if (!stealthAddress || !senderEphemeralPublicKey || !receiverViewingKeyPair || !receiverSpendingKey) {
      throw new Error("Parametri mancanti o non validi");
    }

    try {
      // Calcola il segreto condiviso
      const sharedSecret = await SEA.secret(senderEphemeralPublicKey, receiverViewingKeyPair);
      if (!sharedSecret) {
        throw new Error("Impossibile calcolare il segreto condiviso: chiave pubblica non valida");
      }

      // Deriva la chiave privata stealth
      const stealthPrivateKey = await this.deriveStealthPrivateKey(sharedSecret, receiverSpendingKey);
      
      // Crea il wallet stealth
      const stealthWallet = new ethers.Wallet(stealthPrivateKey);

      // Verifica che l'indirizzo derivato corrisponda
      if (stealthWallet.address.toLowerCase() !== stealthAddress.toLowerCase()) {
        throw new Error("L'indirizzo stealth derivato non corrisponde all'indirizzo fornito");
      }

      return {
        address: stealthWallet.address,
        privateKey: stealthPrivateKey
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Public key is not valid")) {
          throw new Error("Chiave pubblica non valida per la curva specificata");
        }
        throw error;
      }
      throw new Error("Errore sconosciuto durante l'apertura dell'indirizzo stealth");
    }
  }

  private async deriveStealthPrivateKey(
    sharedSecret: string,
    receiverSpendingPublicKey: string
  ): Promise<string> {
    console.log("🔐 Deriving stealth private key with:");
    console.log("Shared secret:", sharedSecret);
    console.log("Receiver spending key:", receiverSpendingPublicKey);

    try {
      // Converti il segreto condiviso in hex
      const sharedSecretHex = base64UrlToHex(sharedSecret);
      
      // Converti la chiave di spesa in hex
      const spendingKeyHex = base64UrlToHex(receiverSpendingPublicKey);
      console.log("Converted spending key to hex:", spendingKeyHex);

      // Calcola l'hash di (sharedSecret || spendingKey)
      const combinedHex = ethers.concat([
        ethers.getBytes(sharedSecretHex),
        ethers.getBytes(spendingKeyHex)
      ]);
      const stealthPrivateKey = ethers.hexlify(ethers.keccak256(combinedHex));
      console.log("Derived stealth private key:", stealthPrivateKey);

      return stealthPrivateKey;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Impossibile derivare la chiave privata stealth: ${error.message}`);
      }
      throw new Error("Errore sconosciuto durante la derivazione della chiave privata stealth");
    }
  }
}
