import { ethers } from "ethers";
import Gun from 'gun';
import "gun/sea";

const SEA = Gun.SEA;

export interface KeyPair {
  epub: string;
  epriv: string;
}

/**
 * Deriva una chiave condivisa da due chiavi pubbliche
 * @param theirPub - La chiave pubblica dell'altra parte
 * @param myKeyPair - Il keypair dell'utente
 * @returns Promise che risolve nella coppia di chiavi derivata
 * @throws Error se una delle chiavi pubbliche non è valida
 */
export async function deriveSharedKey(
  theirPub: string,
  myKeyPair: KeyPair
): Promise<KeyPair> {
  try {
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

    // Usa SEA.secret per derivare il segreto condiviso
    const sharedSecret = await SEA.secret(theirPub, myKeyPair);
    if (!sharedSecret) {
      throw new Error("Impossibile generare la chiave condivisa");
    }

    // Converti il segreto condiviso in formato hex
    const sharedSecretHex = ethers.keccak256(ethers.toUtf8Bytes(sharedSecret));

    return {
      epub: theirPub,
      epriv: sharedSecretHex,
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
 * Deriva una chiave privata stealth da un segreto condiviso e una chiave di spesa
 * @param sharedSecretHex - Il segreto condiviso in formato hex
 * @param receiverSpendingKeyHex - La chiave di spesa del ricevitore in formato hex
 * @returns La chiave privata stealth derivata
 * @throws Error se non è possibile derivare la chiave
 */
export function deriveStealthPrivateKey(
  sharedSecretHex: string,
  receiverSpendingKeyHex: string
): string {
  if (!sharedSecretHex || !receiverSpendingKeyHex) {
    throw new Error("Parametri non validi per la derivazione della chiave stealth");
  }

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

  if (!stealthPrivateKey) {
    throw new Error("Impossibile derivare la chiave privata stealth");
  }

  return stealthPrivateKey;
} 