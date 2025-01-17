import { ethers } from "ethers";
import * as GunNamespace from "gun";
require("gun/sea");

const SEA = GunNamespace.SEA;

interface KeyPair {
  epub: string;
  epriv: string;
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

    // Usa il metodo di hashing diretto per evitare problemi di codifica
    const theirPubHash = ethers.keccak256(ethers.toUtf8Bytes(theirPub));
    const myPubHash = ethers.keccak256(ethers.toUtf8Bytes(myKeyPair.epub));

    // Combina i due hash per ottenere il segreto condiviso
    const sharedKey = ethers.keccak256(
      ethers.concat([ethers.getBytes(theirPubHash), ethers.getBytes(myPubHash)])
    );

    console.log("Derived shared key:", sharedKey);

    return {
      epub: theirPub,
      epriv: sharedKey,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      "Errore sconosciuto nella derivazione della chiave condivisa"
    );
  }
}

/**
 * Derives a stealth private key from a shared secret and receiver's spending key
 * @param sharedSecretHex - The shared secret in hex format
 * @param receiverSpendingKeyHex - The receiver's spending key in hex format
 * @returns The derived stealth private key
 */
function deriveStealthPrivateKey(
  sharedSecretHex: string,
  receiverSpendingKeyHex: string
): string {
  console.log("🔐 Deriving stealth private key with:");
  console.log("Shared secret:", sharedSecretHex);
  console.log("Receiver spending key:", receiverSpendingKeyHex);

  // Assicurati che la chiave di spesa sia in formato hex
  const spendingKey = receiverSpendingKeyHex.startsWith("0x")
    ? receiverSpendingKeyHex
    : "0x" + receiverSpendingKeyHex;

  const stealthPrivateKey = ethers.keccak256(
    ethers.concat([
      ethers.getBytes(sharedSecretHex),
      ethers.getBytes(spendingKey),
    ])
  );

  console.log("Derived stealth private key:", stealthPrivateKey);
  return stealthPrivateKey;
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
    const viewingKeyPair = await SEA.pair();
    const spendingKeyPair = await SEA.pair();

    const stealthKeyPairs = {
      spendingKey: spendingKeyPair.epriv,
      viewingKey: viewingKeyPair.epriv,
    };

    // encrypt the viewing key with the spending key
    const encryptedViewingKey = await SEA.encrypt(stealthKeyPairs, pair);
    const decryptedKeys = await SEA.decrypt(encryptedViewingKey, pair);

    return {
      spendingKey: decryptedKeys.spendingKey,
      viewingKey: decryptedKeys.viewingKey,
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
    try {
      console.log("📤 Generating stealth address for:");
      console.log("Receiver viewing public key:", receiverViewingPublicKey);
      console.log("Receiver spending public key:", receiverSpendingPublicKey);

      // Validazione input
      if (
        !receiverViewingPublicKey ||
        typeof receiverViewingPublicKey !== "string" ||
        receiverViewingPublicKey.length === 0
      ) {
        throw new Error("Chiave pubblica di visualizzazione non valida");
      }
      if (
        !receiverSpendingPublicKey ||
        typeof receiverSpendingPublicKey !== "string" ||
        receiverSpendingPublicKey.length === 0
      ) {
        throw new Error("Chiave pubblica di spesa non valida");
      }

      // Generate ephemeral keypair
      const ephemeralKeyPair = await SEA.pair();
      if (!ephemeralKeyPair || !ephemeralKeyPair.epub) {
        throw new Error("Impossibile generare la coppia di chiavi effimere");
      }
      console.log("Generated ephemeral keypair:", ephemeralKeyPair);

      // Create receiver keypair
      const receiverKeyPair: KeyPair = {
        epub: receiverViewingPublicKey,
        epriv: receiverViewingPublicKey,
      };

      // Calculate shared secret using public keys
      const sharedSecret = await deriveSharedKey(
        ephemeralKeyPair.epub,
        receiverKeyPair
      );
      if (!sharedSecret)
        throw new Error("Impossibile calcolare il segreto condiviso");
      console.log("Calculated shared secret:", sharedSecret);

      // Derive stealth private key
      const stealthPrivateKey = deriveStealthPrivateKey(
        sharedSecret.epriv,
        receiverSpendingPublicKey
      );
      if (!stealthPrivateKey)
        throw new Error("Impossibile derivare la chiave privata stealth");

      const stealthWallet = new ethers.Wallet(stealthPrivateKey);
      console.log("Generated stealth wallet:", {
        address: stealthWallet.address,
        privateKey: stealthPrivateKey,
      });

      return {
        stealthAddress: stealthWallet.address,
        ephemeralPublicKey: ephemeralKeyPair.epub,
      };
    } catch (error) {
      console.error("❌ Error generating stealth address:", error);
      if (error instanceof Error) {
        throw new Error(
          "Impossibile generare l'indirizzo stealth: " + error.message
        );
      }
      throw new Error(
        "Impossibile generare l'indirizzo stealth: errore sconosciuto"
      );
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
    receiverViewingKeyPair: KeyPair,
    receiverSpendingKey: string
  ): Promise<ethers.Wallet> {
    try {
      console.log("📥 Opening stealth address:");
      console.log("Stealth address:", stealthAddress);
      console.log("Sender ephemeral public key:", senderEphemeralPublicKey);
      console.log("Receiver viewing keypair:", receiverViewingKeyPair);
      console.log("Receiver spending key:", receiverSpendingKey);

      // Validazione input
      if (
        !stealthAddress ||
        typeof stealthAddress !== "string" ||
        !stealthAddress.match(/^0x[a-fA-F0-9]{40}$/)
      ) {
        throw new Error("Indirizzo stealth non valido");
      }
      if (
        !senderEphemeralPublicKey ||
        typeof senderEphemeralPublicKey !== "string" ||
        senderEphemeralPublicKey.length === 0
      ) {
        throw new Error("Chiave pubblica effimera del mittente non valida");
      }
      if (
        !receiverViewingKeyPair ||
        !receiverViewingKeyPair.epriv ||
        !receiverViewingKeyPair.epub ||
        typeof receiverViewingKeyPair.epriv !== "string" ||
        typeof receiverViewingKeyPair.epub !== "string"
      ) {
        throw new Error(
          "Keypair di visualizzazione del destinatario non valido"
        );
      }
      if (
        !receiverSpendingKey ||
        typeof receiverSpendingKey !== "string" ||
        receiverSpendingKey.length === 0
      ) {
        throw new Error("Chiave di spesa del destinatario non valida");
      }

      // Calculate shared secret using receiver's viewing private key
      const sharedSecret = await deriveSharedKey(senderEphemeralPublicKey, {
        epub: receiverViewingKeyPair.epub,
        epriv: receiverViewingKeyPair.epriv,
      });
      if (!sharedSecret)
        throw new Error("Impossibile calcolare il segreto condiviso");
      console.log("Calculated shared secret:", sharedSecret);

      // Derive stealth private key
      const stealthPrivateKey = deriveStealthPrivateKey(
        sharedSecret.epriv,
        receiverSpendingKey
      );
      if (!stealthPrivateKey)
        throw new Error("Impossibile derivare la chiave privata stealth");

      const derivedWallet = new ethers.Wallet(stealthPrivateKey);
      console.log("Derived stealth wallet:", {
        address: derivedWallet.address,
        privateKey: stealthPrivateKey,
      });

      // Verify derived address matches
      if (
        derivedWallet.address.toLowerCase() !== stealthAddress.toLowerCase()
      ) {
        console.error("❌ Address mismatch:");
        console.log("Expected:", stealthAddress.toLowerCase());
        console.log("Got:", derivedWallet.address.toLowerCase());
        throw new Error(
          "L'indirizzo stealth derivato non corrisponde all'indirizzo fornito"
        );
      }

      return derivedWallet;
    } catch (error) {
      console.error("❌ Error opening stealth address:", error);
      if (error instanceof Error) {
        throw new Error(
          "Impossibile aprire l'indirizzo stealth: " + error.message
        );
      }
      throw new Error(
        "Impossibile aprire l'indirizzo stealth: errore sconosciuto"
      );
    }
  }
}
