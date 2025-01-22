import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import type { 
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/typescript-types";
import { PasskeyAuthData, PasskeyCredential } from "./interfaces/PasskeyData";
import type { GunKeyPair } from "./interfaces/GunKeyPair";

export class PasskeyManager {
  private readonly rpName = "HUGO Wallet";
  private readonly rpID = window.location.hostname;

  constructor() {
    if (!window.PublicKeyCredential) {
      throw new Error("WebAuthn non è supportato in questo browser");
    }
  }

  /**
   * Registra un nuovo dispositivo con Passkey
   */
  public async registerPasskey(username: string): Promise<PasskeyAuthData> {
    try {
      // 1. Genera le opzioni per la creazione della credenziale
      const options: PublicKeyCredentialCreationOptionsJSON = {
        challenge: this.generateChallenge(),
        rp: {
          name: this.rpName,
          id: this.rpID,
        },
        user: {
          id: this.stringToBase64(username),
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        timeout: 60000,
        attestation: "direct",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "required",
        },
      };

      // 2. Avvia la registrazione
      const credential = await startRegistration({ optionsJSON: options });

      // 3. Verifica e processa la risposta
      const passkeyData: PasskeyAuthData = {
        username,
        credentialID: credential.id,
        publicKey: credential.response.publicKey instanceof Uint8Array ? 
          this.arrayBufferToBase64(credential.response.publicKey) : '',
        encryptedGunKeys: "", // Sarà popolato dopo
        counter: 0, // Inizializza a 0
      };

      // 4. Salva i dati localmente
      this.savePasskeyData(passkeyData);

      return passkeyData;
    } catch (error) {
      console.error("Errore nella registrazione Passkey:", error);
      throw new Error("Impossibile registrare la Passkey");
    }
  }

  /**
   * Verifica una Passkey esistente e recupera le chiavi Gun
   */
  public async verifyAndGetKeys(username: string): Promise<GunKeyPair> {
    try {
      // 1. Recupera i dati Passkey salvati
      const savedData = this.getPasskeyData(username);
      if (!savedData) {
        throw new Error("Nessuna Passkey trovata per questo utente");
      }

      // 2. Genera le opzioni per l'autenticazione
      const options: PublicKeyCredentialRequestOptionsJSON = {
        challenge: this.generateChallenge(),
        rpId: this.rpID,
        allowCredentials: [{
          id: savedData.credentialID,
          type: "public-key",
          transports: ["internal"]
        }],
        userVerification: "required",
        timeout: 60000,
      };

      // 3. Avvia l'autenticazione
      const assertion = await startAuthentication({ optionsJSON: options });

      // 4. Verifica l'autenticazione
      if (assertion.response.userHandle !== username) {
        throw new Error("Autenticazione Passkey fallita");
      }

      // 5. Decripta e restituisci le chiavi Gun
      return this.decryptGunKeys(savedData.encryptedGunKeys, assertion);
    } catch (error) {
      console.error("Errore nella verifica Passkey:", error);
      throw new Error("Impossibile verificare la Passkey");
    }
  }

  /**
   * Backup delle chiavi su un nuovo dispositivo
   */
  public async backupToNewDevice(username: string): Promise<void> {
    try {
      // 1. Verifica che ci sia una Passkey esistente
      const existingData = this.getPasskeyData(username);
      if (!existingData) {
        throw new Error("Nessuna Passkey da backuppare");
      }

      // 2. Registra il nuovo dispositivo
      const newPasskeyData = await this.registerPasskey(username);

      // 3. Copia le chiavi Gun criptate
      newPasskeyData.encryptedGunKeys = existingData.encryptedGunKeys;

      // 4. Salva i nuovi dati
      this.savePasskeyData(newPasskeyData);
    } catch (error) {
      console.error("Errore nel backup Passkey:", error);
      throw new Error("Impossibile eseguire il backup della Passkey");
    }
  }

  /**
   * Salva le chiavi Gun criptate con la Passkey
   */
  public async encryptAndSaveGunKeys(
    username: string,
    gunKeys: GunKeyPair
  ): Promise<void> {
    try {
      const passkeyData = this.getPasskeyData(username);
      if (!passkeyData) {
        throw new Error("Nessuna Passkey trovata");
      }

      // Cripta le chiavi Gun usando la chiave pubblica della Passkey
      const encryptedKeys = await this.encryptGunKeys(gunKeys, passkeyData.publicKey);
      
      // Aggiorna i dati salvati
      passkeyData.encryptedGunKeys = encryptedKeys;
      this.savePasskeyData(passkeyData);
    } catch (error) {
      console.error("Errore nel salvataggio delle chiavi Gun:", error);
      throw new Error("Impossibile salvare le chiavi Gun");
    }
  }

  // Utility methods
  private generateChallenge(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.arrayBufferToBase64(array);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private stringToBase64(str: string): string {
    return btoa(str);
  }

  private savePasskeyData(data: PasskeyAuthData): void {
    localStorage.setItem(`passkey_${data.username}`, JSON.stringify(data));
  }

  private getPasskeyData(username: string): PasskeyAuthData | null {
    const data = localStorage.getItem(`passkey_${username}`);
    return data ? JSON.parse(data) : null;
  }

  private async encryptGunKeys(
    gunKeys: GunKeyPair,
    publicKey: string
  ): Promise<string> {
    // TODO: Implementa la crittografia delle chiavi Gun
    return JSON.stringify(gunKeys);
  }

  private async decryptGunKeys(
    encryptedKeys: string,
    assertion: any
  ): Promise<GunKeyPair> {
    // TODO: Implementa la decrittografia delle chiavi Gun
    return JSON.parse(encryptedKeys);
  }
} 