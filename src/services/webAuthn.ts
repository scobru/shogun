// Import sha256 usando require
const sha256 = require('js-sha256').sha256;
import type { WebAuthnResult, WebAuthnVerifyResult } from '../interfaces/WebAuthnResult';
import crypto from 'crypto';

// Costanti di sicurezza
const TIMEOUT_MS = 60000; // 60 secondi
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 64;

// Challenge statica per generare credenziali deterministiche
const generateChallenge = (username: string): Uint8Array => {
  const timestamp = Date.now().toString();
  const randomBytes = crypto.randomBytes(32);
  const challengeData = `${username}-${timestamp}-${randomBytes.toString('hex')}`;
  return new TextEncoder().encode(challengeData);
};

// Utility per convertire ArrayBuffer in base64 in modo sicuro
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const binary = bytes.reduce((str, byte) => str + String.fromCharCode(byte), '');
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

// Utility per convertire base64 in ArrayBuffer in modo sicuro
const base64ToBuffer = (base64: string): ArrayBuffer => {
  if (!/^[A-Za-z0-9\-_]*$/.test(base64)) {
    throw new Error('Invalid base64 string');
  }

  const base64Url = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64Padded = base64Url + padding;
  
  try {
    const binary = atob(base64Padded);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer.buffer;
  } catch (error) {
    throw new Error('Failed to decode base64 string');
  }
};

// Genera credenziali deterministiche da username e salt
const generateCredentialsFromSalt = (username: string, salt: string): { password: string } => {
  return {
    password: sha256(username + salt)
  };
};

export class WebAuthnService {
  private gun: any;
  private readonly DAPP_NAME = 'shogun';

  constructor(gun: any) {
    this.gun = gun;
  }

  private validateUsername(username: string): void {
    if (!username || typeof username !== 'string') {
      throw new Error('Username must be a non-empty string');
    }
    if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
      throw new Error(`Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`);
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, underscores and hyphens');
    }
  }

  // Genera credenziali WebAuthn deterministiche
  public async generateCredentials(username: string): Promise<WebAuthnResult> {
    try {
      // Validazioni di sicurezza
      this.validateUsername(username);

      if (!this.isSupported()) {
        throw new Error('WebAuthn non è supportato su questo browser');
      }

      // Verifica se l'username è già registrato
      const existingSalt = await this.getSalt(username);
      if (existingSalt) {
        throw new Error('Username già registrato con WebAuthn');
      }

      // Genera una challenge unica per questa registrazione
      const challenge = generateChallenge(username);

      const createCredentialOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "Shogun Wallet",
          id: window.location.hostname
        },
        user: {
          id: new TextEncoder().encode(username),
          name: username,
          displayName: username
        },
        pubKeyCredParams: [
          {
            type: "public-key",
            alg: -7 // ES256
          },
          {
            type: "public-key",
            alg: -257 // RS256
          }
        ],
        timeout: TIMEOUT_MS,
        attestation: "direct",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          requireResidentKey: true
        },
        extensions: {
          credProps: true
        }
      };

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);

      try {
        const credential = await navigator.credentials.create({
          publicKey: createCredentialOptions,
          signal: abortController.signal
        }) as PublicKeyCredential;

        // Genera un salt casuale
        const salt = crypto.randomBytes(32).toString('hex');
        
        // Genera le credenziali dal salt
        const { password } = generateCredentialsFromSalt(username, salt);

        // Salva solo il salt in Gun
        await this.gun.get(this.DAPP_NAME)
          .get("webauthn-credentials")
          .get(username)
          .put({
            salt,
            timestamp: Date.now()
          });

        return {
          success: true,
          username,
          password,
          credentialId: bufferToBase64(credential.rawId)
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Errore generazione credenziali WebAuthn:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    }
  }

  // Login con WebAuthn
  public async login(username: string): Promise<WebAuthnResult> {
    try {
      // Validazioni di sicurezza
      this.validateUsername(username);

      const salt = await this.getSalt(username);
      if (!salt) {
        throw new Error("Nessuna credenziale WebAuthn trovata per questo username");
      }

      const challenge = generateChallenge(username);

      const assertionOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [],  // Non serve specificare le credenziali poiché usiamo il salt
        timeout: TIMEOUT_MS,
        userVerification: "required",
        rpId: window.location.hostname
      };

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);

      try {
        const assertion = await navigator.credentials.get({
          publicKey: assertionOptions,
          signal: abortController.signal
        }) as PublicKeyCredential;

        if (!assertion) {
          throw new Error('Verifica WebAuthn fallita');
        }

        // Genera le credenziali dal salt salvato
        const { password } = generateCredentialsFromSalt(username, salt);

        // Aggiorna il timestamp dell'ultimo accesso
        await this.gun.get(this.DAPP_NAME)
          .get("webauthn-credentials")
          .get(username)
          .get('lastUsed')
          .put(Date.now());

        return {
          success: true,
          username,
          password,
          credentialId: bufferToBase64(assertion.rawId)
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Errore login WebAuthn:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    }
  }

  // Verifica una credenziale esistente
  public async verifyCredential(credentialId: string): Promise<WebAuthnVerifyResult> {
    try {
      if (!credentialId || typeof credentialId !== 'string') {
        throw new Error('Invalid credential ID');
      }

      const challenge = crypto.randomBytes(32);
      const assertionOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [{
          id: base64ToBuffer(credentialId),
          type: 'public-key',
          transports: ['internal', 'hybrid'] as AuthenticatorTransport[]
        }],
        timeout: TIMEOUT_MS,
        userVerification: "required",
        rpId: window.location.hostname
      };

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);

      try {
        const assertion = await navigator.credentials.get({
          publicKey: assertionOptions,
          signal: abortController.signal
        }) as PublicKeyCredential;

        if (!assertion) {
          throw new Error('Verifica WebAuthn fallita');
        }

        const response = assertion.response as AuthenticatorAssertionResponse;

        return {
          success: true,
          authenticatorData: response.authenticatorData,
          signature: response.signature
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Errore verifica WebAuthn:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    }
  }

  // Recupera il salt da Gun
  private async getSalt(username: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.gun.get(this.DAPP_NAME)
        .get("webauthn-credentials")
        .get(username)
        .once((data: any) => {
          resolve(data?.salt || null);
        });
    });
  }

  // Verifica se WebAuthn è supportato
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 
           window.PublicKeyCredential !== undefined &&
           typeof window.PublicKeyCredential === 'function' &&
           typeof window.crypto !== 'undefined' &&
           typeof window.crypto.subtle !== 'undefined';
  }
} 