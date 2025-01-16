import { ethers } from "ethers";
import * as GunNamespace from "gun";
require("gun/sea");

const SEA = GunNamespace.SEA;

interface KeyPair {
  epub: string;
  epriv: string;
}

async function deriveSharedKey(theirPub: string, myKeyPair: KeyPair): Promise<KeyPair> {
  try {
    console.log("🔑 Deriving shared key with:");
    console.log("Their public key:", theirPub);
    console.log("My keypair:", myKeyPair);

    if (!theirPub) throw new Error("Chiave pubblica del destinatario non valida");
    if (!myKeyPair || !myKeyPair.epriv || !myKeyPair.epub) {
      throw new Error("Keypair non valido per la derivazione della chiave condivisa");
    }

    // Calcola il segreto condiviso usando solo le chiavi pubbliche
    const theirPubHash = ethers.keccak256(ethers.toUtf8Bytes(theirPub));
    const myPubHash = ethers.keccak256(ethers.toUtf8Bytes(myKeyPair.epub));
    
    console.log("Their public key hash:", theirPubHash);
    console.log("My public key hash:", myPubHash);

    const sharedKey = ethers.keccak256(
      ethers.concat([
        ethers.getBytes(theirPubHash),
        ethers.getBytes(myPubHash)
      ])
    );

    console.log("Derived shared key:", sharedKey);

    return {
      epub: theirPub,
      epriv: sharedKey
    };
  } catch (error) {
    console.error("❌ Error deriving shared key:", error);
    throw error;
  }
}

function deriveStealthPrivateKey(sharedSecretHex: string, receiverSpendingKeyHex: string): string {
  console.log("🔐 Deriving stealth private key with:");
  console.log("Shared secret:", sharedSecretHex);
  console.log("Receiver spending key:", receiverSpendingKeyHex);

  const stealthPrivateKey = ethers.keccak256(
    ethers.concat([
      ethers.getBytes(sharedSecretHex),
      ethers.getBytes(receiverSpendingKeyHex),
    ])
  );

  console.log("Derived stealth private key:", stealthPrivateKey);
  return stealthPrivateKey;
}

class StealthChain {
  constructor() {}

  async generateStealthAddress(
    receiverViewingKey: string,
    receiverSpendingKey: string
  ): Promise<{ stealthAddress: string; ephemeralPublicKey: string }> {
    try {
      console.log("📤 Generating stealth address for:");
      console.log("Receiver viewing key:", receiverViewingKey);
      console.log("Receiver spending key:", receiverSpendingKey);

      // Genera una coppia di chiavi effimere
      const ephemeralKeyPair = await SEA.pair();
      console.log("Generated ephemeral keypair:", ephemeralKeyPair);
      
      // Crea un keypair temporaneo per il ricevitore
      const receiverKeyPair: KeyPair = {
        epub: receiverViewingKey,
        epriv: receiverViewingKey
      };
      console.log("Created receiver keypair:", receiverKeyPair);

      // Calcola il segreto condiviso usando le chiavi convertite
      const sharedSecret = await deriveSharedKey(ephemeralKeyPair.epub, receiverKeyPair);
      if (!sharedSecret) throw new Error("Impossibile calcolare il segreto condiviso");
      console.log("Calculated shared secret:", sharedSecret);

      // Deriva la chiave privata stealth
      const stealthPrivateKey = deriveStealthPrivateKey(sharedSecret.epriv, receiverSpendingKey);
      const stealthWallet = new ethers.Wallet(stealthPrivateKey);
      console.log("Generated stealth wallet:", {
        address: stealthWallet.address,
        privateKey: stealthPrivateKey
      });

      return {
        stealthAddress: stealthWallet.address,
        ephemeralPublicKey: ephemeralKeyPair.epub
      };
    } catch (error) {
      console.error("❌ Error generating stealth address:", error);
      if (error instanceof Error) {
        throw new Error("Impossibile generare l'indirizzo stealth: " + error.message);
      }
      throw new Error("Impossibile generare l'indirizzo stealth: errore sconosciuto");
    }
  }

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

      // Calcola il segreto condiviso usando le chiavi convertite
      const sharedSecret = await deriveSharedKey(senderEphemeralPublicKey, receiverViewingKeyPair);
      if (!sharedSecret) throw new Error("Impossibile calcolare il segreto condiviso");
      console.log("Calculated shared secret:", sharedSecret);

      // Deriva la chiave privata stealth
      const stealthPrivateKey = deriveStealthPrivateKey(sharedSecret.epriv, receiverSpendingKey);
      const derivedWallet = new ethers.Wallet(stealthPrivateKey);
      console.log("Derived stealth wallet:", {
        address: derivedWallet.address,
        privateKey: stealthPrivateKey
      });

      // Verifica che l'indirizzo derivato corrisponda
      if (derivedWallet.address.toLowerCase() !== stealthAddress.toLowerCase()) {
        console.error("❌ Address mismatch:");
        console.log("Expected:", stealthAddress.toLowerCase());
        console.log("Got:", derivedWallet.address.toLowerCase());
        throw new Error("L'indirizzo stealth derivato non corrisponde all'indirizzo fornito");
      }

      return derivedWallet;
    } catch (error) {
      console.error("❌ Error opening stealth address:", error);
      if (error instanceof Error) {
        throw new Error("Impossibile aprire l'indirizzo stealth: " + error.message);
      }
      throw new Error("Impossibile aprire l'indirizzo stealth: errore sconosciuto");
    }
  }
}

module.exports = { StealthChain }; 