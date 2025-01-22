import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticatorAttestationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/typescript-types";
import { PasskeyAuthData, PasskeyCredential } from "./interfaces/PasskeyData";
import type { GunKeyPair } from "./interfaces/GunKeyPair";

export class PasskeyManager {
  private readonly rpName = "HUGO Wallet";
  private readonly rpID = window.location.host;

  constructor() {
    if (!window.PublicKeyCredential) {
      throw new Error("WebAuthn non è supportato in questo browser");
    }
    console.log("Inizializzazione PasskeyManager con rpID:", this.rpID);

    // Verifica il supporto per le piattform authenticator
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(
      (available) => {
        console.log("Platform authenticator disponibile:", available);
      }
    );

    // Verifica se il browser supporta le credenziali residenti
    if (
      "PublicKeyCredential" in window &&
      "isConditionalMediationAvailable" in PublicKeyCredential
    ) {
      (PublicKeyCredential as any)
        .isConditionalMediationAvailable()
        .then((available: boolean) => {
          console.log("Conditional mediation disponibile:", available);
        });
    }
  }

  /**
   * Registra un nuovo dispositivo con Passkey
   */
  public async registerPasskey(username: string): Promise<PasskeyAuthData> {
    try {
      console.log("Inizio registrazione Passkey per:", username);
      console.log("RP ID:", this.rpID);

      // 1. Genera le opzioni per la creazione della credenziale
      const challengeArray = new Uint8Array(32);
      crypto.getRandomValues(challengeArray);
      console.log("Challenge generata (bytes):", Array.from(challengeArray));

      const userIdArray = new TextEncoder().encode(username);
      console.log("User ID codificato (bytes):", Array.from(userIdArray));

      const options: PublicKeyCredentialCreationOptionsJSON = {
        rp: {
          name: this.rpName,
          id: this.rpID,
        },
        user: {
          id: this.bufferToBase64URLString(userIdArray),
          name: username,
          displayName: username,
        },
        challenge: this.bufferToBase64URLString(challengeArray),
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        timeout: 60000,
        attestation: "none",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred",
          residentKey: "preferred",
        },
        excludeCredentials: [],
      };

      console.log(
        "Opzioni di registrazione:",
        JSON.stringify(options, null, 2)
      );

      // 2. Avvia la registrazione
      console.log("Avvio registrazione con SimpleWebAuthn...");
      const credential = await startRegistration({
        optionsJSON:
          options as unknown as PublicKeyCredentialCreationOptionsJSON,
      });
      console.log("Credenziale ricevuta:", credential);

      // 3. Verifica e processa la risposta
      const response =
        credential.response as AuthenticatorAttestationResponseJSON;
      const passkeyData: PasskeyAuthData = {
        username,
        credentialID: credential.id,
        publicKey: this.arrayBufferToBase64(response.clientDataJSON),
        encryptedGunKeys: "", // Sarà popolato dopo
        counter: 0, // Inizializza a 0
      };

      console.log("Dati Passkey generati:", passkeyData);

      // 4. Salva i dati localmente
      this.savePasskeyData(passkeyData);
      console.log("Dati Passkey salvati localmente");

      return passkeyData;
    } catch (error) {
      console.error("Errore dettagliato nella registrazione Passkey:", {
        error,
        name: error instanceof Error ? error.name : "Unknown Error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : "No stack trace",
      });
      throw error;
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
        allowCredentials: [
          {
            id: savedData.credentialID,
            type: "public-key",
            transports: ["internal"],
          },
        ],
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
      const encryptedKeys = await this.encryptGunKeys(
        gunKeys,
        passkeyData.publicKey
      );

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
    try {
      console.log("Generazione challenge...");
      // Genera 32 bytes casuali
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      console.log("Bytes casuali generati:", array);

      // Converti in base64url senza padding
      const challenge = this.bufferToBase64URLString(array);
      console.log("Challenge convertita in base64url:", challenge);
      return challenge;
    } catch (error) {
      console.error("Errore nella generazione della challenge:", error);
      throw error;
    }
  }

  private bufferToBase64URLString(buffer: ArrayBuffer | Uint8Array): string {
    const base64String = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return base64String
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  private arrayBufferToBase64URL(buffer: ArrayBuffer | Uint8Array): string {
    const base64 = this.arrayBufferToBase64(buffer);
    // Converti in base64url sostituendo i caratteri non validi per URL
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private stringToBase64URL(str: string): string {
    const base64 = btoa(str);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
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
    try {
      // Converti le chiavi in stringa
      const keysString = JSON.stringify(gunKeys);

      // Codifica la stringa in bytes
      const encoder = new TextEncoder();
      const data = encoder.encode(keysString);

      // Importa la chiave pubblica
      const key = await crypto.subtle.importKey(
        "raw",
        Buffer.from(publicKey, "base64"),
        {
          name: "ECDH",
          namedCurve: "P-256",
        },
        false,
        ["deriveKey"]
      );

      // Genera una chiave AES per la cifratura
      const aesKey = await crypto.subtle.deriveKey(
        {
          name: "ECDH",
          public: key,
        },
        key,
        {
          name: "AES-GCM",
          length: 256,
        },
        false,
        ["encrypt"]
      );

      // Genera un IV casuale
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Cifra i dati
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        aesKey,
        data
      );

      // Combina IV e dati cifrati
      const result = new Uint8Array(iv.length + encryptedData.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encryptedData), iv.length);

      // Restituisci il risultato in base64
      return Buffer.from(result).toString("base64");
    } catch (error) {
      console.error("Errore nella cifratura delle chiavi:", error);
      throw new Error("Impossibile cifrare le chiavi Gun");
    }
  }

  private async decryptGunKeys(
    encryptedKeys: string,
    assertion: any
  ): Promise<GunKeyPair> {
    try {
      // Decodifica i dati cifrati da base64
      const encryptedData = Buffer.from(encryptedKeys, "base64");

      // Estrai IV e dati
      const iv = encryptedData.slice(0, 12);
      const data = encryptedData.slice(12);

      // Usa l'assertion per ottenere la chiave di decifratura
      const key = await crypto.subtle.importKey(
        "raw",
        assertion.response.userHandle,
        {
          name: "ECDH",
          namedCurve: "P-256",
        },
        false,
        ["deriveKey"]
      );

      // Deriva la chiave AES
      const aesKey = await crypto.subtle.deriveKey(
        {
          name: "ECDH",
          public: key,
        },
        key,
        {
          name: "AES-GCM",
          length: 256,
        },
        false,
        ["decrypt"]
      );

      // Decifra i dati
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        aesKey,
        data
      );

      // Converti i dati decifrati in stringa
      const decoder = new TextDecoder();
      const decryptedString = decoder.decode(decryptedData);

      // Parsing delle chiavi Gun
      return JSON.parse(decryptedString);
    } catch (error) {
      console.error("Errore nella decifratura delle chiavi:", error);
      throw new Error("Impossibile decifrare le chiavi Gun");
    }
  }
}
