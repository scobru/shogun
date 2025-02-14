import { IGunInstance, ISEAPair } from "gun";
import type {
  WebAuthnResult,
  WebAuthnVerifyResult,
  WebAuthnCredentials,
  DeviceCredential,
} from "../interfaces/WebAuthnResult";
import jsSha256 from "js-sha256";
import "gun/sea";
import { WebAuthnResult as IWebAuthnResult } from '../interfaces/WebAuthnResult';

const sha256 = jsSha256.sha256;

let cryptoModule: any;
try {
  if (typeof window === "undefined") {
    // Siamo in Node.js
    cryptoModule = require("crypto");
  }
} catch {
  cryptoModule = null;
}

const TIMEOUT_MS = 60000; // 60 secondi
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 64;

const generateDeviceId = (): string => {
  const platform =
    typeof navigator !== "undefined" ? navigator.platform : "unknown";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return uint8ArrayToHex(
    new TextEncoder().encode(`${platform}-${timestamp}-${random}`)
  );
};

// Funzione per ottenere informazioni sulla piattaforma
const getPlatformInfo = (): { name: string; platform: string } => {
  if (typeof navigator === "undefined") {
    return { name: "unknown", platform: "unknown" };
  }

  const platform = navigator.platform;
  const userAgent = navigator.userAgent;
  let name = "Unknown Device";

  if (/iPhone|iPad|iPod/.test(platform)) {
    name = "iOS Device";
  } else if (/Android/.test(userAgent)) {
    name = "Android Device";
  } else if (/Win/.test(platform)) {
    name = "Windows Device";
  } else if (/Mac/.test(platform)) {
    name = "Mac Device";
  } else if (/Linux/.test(platform)) {
    name = "Linux Device";
  }

  return { name, platform };
};

// Funzione per convertire Uint8Array in stringa hex
const uint8ArrayToHex = (arr: Uint8Array): string => {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// Genera bytes casuali in modo sicuro
const getRandomBytes = (length: number): Uint8Array => {
  if (typeof window !== "undefined" && window.crypto) {
    // Usa WebCrypto nel browser
    return window.crypto.getRandomValues(new Uint8Array(length));
  } else if (cryptoModule) {
    // Usa Node.js crypto
    return new Uint8Array(cryptoModule.randomBytes(length));
  }
  throw new Error("Nessuna implementazione crittografica disponibile");
};

// Challenge statica per generare credenziali deterministiche
const generateChallenge = (username: string): Uint8Array => {
  const timestamp = Date.now().toString();
  const randomBytes = getRandomBytes(32);
  const challengeData = `${username}-${timestamp}-${uint8ArrayToHex(
    randomBytes
  )}`;
  return new TextEncoder().encode(challengeData);
};

// Utility per convertire ArrayBuffer in base64 in modo sicuro
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const binary = bytes.reduce(
    (str, byte) => str + String.fromCharCode(byte),
    ""
  );
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

// Utility per convertire base64 in ArrayBuffer in modo sicuro
const base64ToBuffer = (base64: string): ArrayBuffer => {
  if (!/^[A-Za-z0-9\-_]*$/.test(base64)) {
    throw new Error("Invalid base64 string");
  }

  const base64Url = base64.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64Padded = base64Url + padding;

  try {
    const binary = atob(base64Padded);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer.buffer;
  } catch (error) {
    throw new Error("Failed to decode base64 string");
  }
};

// Genera credenziali deterministiche da username e salt
const generateCredentialsFromSalt = (
  username: string,
  salt: string
): { password: string } => {
  return {
    password: sha256(username + salt),
  };
};

// Utility per convertire una firma in password
async function signatureToPassword(signature: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', signature);
  return bufferToBase64(hash);
}

export class WebAuthnManager {
  private user: { pair: any } | null = null;

  private validateUsername(username: string): void {
    if (!username || typeof username !== "string") {
      throw new Error("Username must be a non-empty string");
    }
    if (
      username.length < MIN_USERNAME_LENGTH ||
      username.length > MAX_USERNAME_LENGTH
    ) {
      throw new Error(
        `Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`
      );
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error(
        "Username can only contain letters, numbers, underscores and hyphens"
      );
    }
  }

  /**
   * Implementazione del metodo createAccount richiesto da BaseManager
   */
  public async createPair(
    username: string,
    deviceName?: string
  ): Promise<Record<string, any>> {
    const result = await this.generateCredentials(username, deviceName);
    if (!result.success) {
      throw new Error(result.error || "Errore durante la creazione dell'account");
    }
    return result;
  }

  public async generateCredentials(
    username: string,
    deviceName?: string
  ): Promise<IWebAuthnResult> {
    try {
      this.validateUsername(username);

      if (!this.isSupported()) {
        throw new Error("WebAuthn non è supportato su questo browser");
      }

      // Genera una challenge unica per questa registrazione
      const challenge = generateChallenge(username);

      const createCredentialOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "Shogun Wallet",
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(username),
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          {
            type: "public-key",
            alg: -7, // ES256
          },
          {
            type: "public-key",
            alg: -257, // RS256
          },
        ],
        timeout: TIMEOUT_MS,
        attestation: "direct",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          requireResidentKey: true,
        },
        extensions: {
          credProps: true,
        },
      };

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);

      try {
        const credential = (await navigator.credentials.create({
          publicKey: createCredentialOptions,
          signal: abortController.signal,
        })) as PublicKeyCredential;

        // Genera la password dalla chiave pubblica
        const publicKey = (credential.response as AuthenticatorAttestationResponse)
          .getPublicKey();
        if (!publicKey) throw new Error("Impossibile ottenere la chiave pubblica");
        
        const password = await signatureToPassword(publicKey);

        // Ottieni informazioni sul dispositivo
        const { name: defaultDeviceName, platform } = getPlatformInfo();
        const deviceId = generateDeviceId();

        // Prepara le credenziali da salvare
        const credentialId = bufferToBase64(credential.rawId);
        const newCredential = {
          deviceId,
          timestamp: Date.now(),
          name: deviceName || defaultDeviceName,
          platform: platform || 'Unknown Platform'
        };

        return {
          success: true,
          username,
          credentialId,
          deviceInfo: newCredential,
          password
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error("Errore generazione credenziali WebAuthn:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      };
    }
  }

  public async authenticateUser(username: string): Promise<IWebAuthnResult> {
    try {
      // Validazioni di sicurezza
      this.validateUsername(username);

      const salt = await this.getSalt(username);
      if (!salt) {
        throw new Error(
          "Nessuna credenziale WebAuthn trovata per questo username"
        );
      }

      const challenge = generateChallenge(username);

      const assertionOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [], // Non serve specificare le credenziali poiché usiamo il salt
        timeout: TIMEOUT_MS,
        userVerification: "required",
        rpId: window.location.hostname,
      };

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);

      try {
        const assertion = (await navigator.credentials.get({
          publicKey: assertionOptions,
          signal: abortController.signal,
        })) as PublicKeyCredential;

        if (!assertion) {
          throw new Error("Verifica WebAuthn fallita");
        }

        // Estrai la firma e genera la password
        const signature = (assertion.response as AuthenticatorAssertionResponse).signature;
        if (!signature) throw new Error("Firma non disponibile");
        
        const password = await signatureToPassword(signature);

        return {
          success: true,
          username,
          credentialId: bufferToBase64(assertion.rawId),
          password,
          signature
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error("Errore login WebAuthn:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      };
    }
  }

  // Verifica una credenziale esistente
  public async verifyCredential(
    credentialId: string
  ): Promise<WebAuthnVerifyResult> {
    try {
      if (!credentialId || typeof credentialId !== "string") {
        throw new Error("Invalid credential ID");
      }

      const challengeBytes = getRandomBytes(32);
      const assertionOptions: PublicKeyCredentialRequestOptions = {
        challenge: challengeBytes,
        allowCredentials: [
          {
            id: base64ToBuffer(credentialId),
            type: "public-key",
            transports: ["internal", "hybrid"] as AuthenticatorTransport[],
          },
        ],
        timeout: TIMEOUT_MS,
        userVerification: "required",
        rpId: window.location.hostname,
      };

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);

      try {
        const assertion = (await navigator.credentials.get({
          publicKey: assertionOptions,
          signal: abortController.signal,
        })) as PublicKeyCredential;

        if (!assertion) {
          throw new Error("Verifica WebAuthn fallita");
        }

        const response = assertion.response as AuthenticatorAssertionResponse;

        return {
          success: true,
          authenticatorData: response.authenticatorData,
          signature: response.signature,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error("Errore verifica WebAuthn:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      };
    }
  }

  // Recupera il salt da Gun
  private async getSalt(username: string): Promise<string | null> {
    const credentials = await this.getWebAuthnCredentials(username);
    return credentials?.salt || null;
  }

  // Verifica se WebAuthn è supportato
  public isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === "function" &&
      typeof window.crypto !== "undefined" &&
      typeof window.crypto.subtle !== "undefined"
    );
  }

  // Aggiungi questo metodo per firmare messaggi
  public async signMessage(message: string): Promise<ArrayBuffer> {
    if (!this.user?.pair) {
      throw new Error("Utente non autenticato");
    }

    const challenge = new TextEncoder().encode(message);
    const assertionOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [],
      timeout: TIMEOUT_MS,
      userVerification: "required",
      rpId: window.location.hostname,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: assertionOptions
    })) as PublicKeyCredential;

    const signature = (assertion.response as AuthenticatorAssertionResponse).signature;
    if (!signature) throw new Error("Firma non disponibile");
    
    return signature;
  }

  private async getWebAuthnCredentials(username: string): Promise<{ salt: string } | null> {
    // Implementa il recupero delle credenziali da Gun o altro storage
    return null; // Per ora restituisce null
  }
}
