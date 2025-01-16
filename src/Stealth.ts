const { ethers } = require("ethers");
import * as GunNamespace from "gun";
require("gun/sea");

const SEA = GunNamespace.SEA;

// Costante per la curva secp256k1 usata da Ethereum
const CURVE_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

interface SEAKeyPair {
  epub: string;
  epriv: string;
  pub?: string;
}

interface SharedSecret {
  epriv: string;
}

interface Wallet {
  address: string;
}

class StealthChain {
  constructor(private spendingKey: string) {}

  private async base64ToHex(base64: string): Promise<string> {
    try {
      // Rimuovi eventuali parti dopo il punto (formato Gun)
      const cleanBase64 = base64.split('.')[0];
      if (!cleanBase64) {
        throw new Error("Base64 non valido");
      }

      // Aggiungi padding se necessario
      const padding = '='.repeat((4 - cleanBase64.length % 4) % 4);
      const paddedBase64 = cleanBase64 + padding;
      
      // Converti da base64 a buffer
      const buffer = Buffer.from(paddedBase64, 'base64');
      
      // Converti in hex e assicurati che sia lungo 64 caratteri
      const hex = buffer.toString('hex').padStart(64, '0');
      return '0x' + hex;
    } catch (error) {
      console.error("Errore nella conversione base64 a hex:", error);
      throw error;
    }
  }

  private deriveStealthPrivateKey(sharedSecretHex: string, spendingKeyHex: string): string {
    const sharedSecretBigInt = BigInt(sharedSecretHex);
    const spendingKeyBigInt = BigInt(spendingKeyHex);
    const stealthPrivateKeyBigInt = (sharedSecretBigInt + spendingKeyBigInt) % CURVE_N;
    return '0x' + stealthPrivateKeyBigInt.toString(16).padStart(64, '0');
  }

  async generateStealthAddress(receiverViewingKey: string, receiverSpendingKey: string): Promise<{ stealthAddress: string, ephemeralPublicKey: string }> {
    try {
      // Generiamo una nuova coppia di chiavi effimere ogni volta
      const ephemeralKeyPair = await SEA.pair();
      
      // Calcoliamo il segreto condiviso usando la chiave effimera privata e la chiave pubblica di visualizzazione del ricevente
      const sharedSecret = await SEA.secret(ephemeralKeyPair.epriv, { epriv: receiverViewingKey, epub: ephemeralKeyPair.epub }) as unknown as SharedSecret;
      if (!sharedSecret || !sharedSecret.epriv) {
        throw new Error("Impossibile calcolare il segreto condiviso");
      }

      // Convertiamo le chiavi nel formato corretto
      const sharedSecretHex = await this.base64ToHex(sharedSecret.epriv);
      const receiverSpendingKeyHex = await this.base64ToHex(receiverSpendingKey);

      // Deriviamo la chiave privata stealth
      const stealthPrivateKey = this.deriveStealthPrivateKey(sharedSecretHex, receiverSpendingKeyHex);
      
      // Creiamo il wallet dalla chiave privata stealth
      const wallet = new ethers.Wallet(stealthPrivateKey);

      return {
        stealthAddress: wallet.address,
        ephemeralPublicKey: ephemeralKeyPair.epub
      };
    } catch (error) {
      console.error("Errore nella generazione dell'indirizzo stealth:", error);
      throw error;
    }
  }

  async computeStealthPrivateKey(
    receiverViewingPrivateKey: string,
    senderEphemeralPublicKey: string
  ): Promise<string> {
    try {
      // Calcoliamo il segreto condiviso usando la chiave privata di visualizzazione del ricevente e la chiave pubblica effimera del mittente
      const sharedSecret = await SEA.secret(senderEphemeralPublicKey, { epriv: receiverViewingPrivateKey, epub: senderEphemeralPublicKey }) as unknown as SharedSecret;
      if (!sharedSecret || !sharedSecret.epriv) {
        throw new Error("Impossibile calcolare il segreto condiviso");
      }

      // Convertiamo le chiavi nel formato corretto
      const sharedSecretHex = await this.base64ToHex(sharedSecret.epriv);
      const spendingKeyHex = await this.base64ToHex(this.spendingKey);

      // Deriviamo la chiave privata stealth
      return this.deriveStealthPrivateKey(sharedSecretHex, spendingKeyHex);
    } catch (error) {
      console.error("Errore nel calcolo della chiave privata stealth:", error);
      throw error;
    }
  }

  async openStealthAddress(
    stealthAddress: string,
    senderEphemeralPublicKey: string,
    receiverViewingKeyPair: SEAKeyPair
  ): Promise<Wallet> {
    try {
      const privateKey = await this.computeStealthPrivateKey(
        receiverViewingKeyPair.epriv,
        senderEphemeralPublicKey
      );
      
      const wallet = new ethers.Wallet(privateKey);
      
      if (wallet.address.toLowerCase() !== stealthAddress.toLowerCase()) {
        throw new Error("L'indirizzo stealth derivato non corrisponde all'indirizzo fornito");
      }
      
      return wallet;
    } catch (error) {
      console.error("Errore nell'apertura dell'indirizzo stealth:", error);
      throw error;
    }
  }
}

module.exports = { StealthChain }; 