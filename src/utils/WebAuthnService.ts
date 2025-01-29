import { sha256 } from 'js-sha256';
import type { WebAuthnResult, WebAuthnVerifyResult } from '../interfaces/WebAuthnResult';

// Utility per convertire ArrayBuffer in base64
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

// Utility per convertire base64 in ArrayBuffer
const base64ToBuffer = (base64: string): ArrayBuffer => {
  const base64Url = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64Padded = base64Url + padding;
  
  const binary = atob(base64Padded);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
};

// Challenge statica per generare credenziali deterministiche
const STATIC_CHALLENGE = new TextEncoder().encode('static_challenge_for_shogun_wallet');

export class WebAuthnService {
  private gun: any;
  private readonly DAPP_NAME = 'shogun';

  constructor(gun: any) {
    this.gun = gun;
  }

  // Genera credenziali WebAuthn deterministiche
  public async generateCredentials(username: string): Promise<WebAuthnResult> {
    try {
      if (!this.isSupported()) {
        throw new Error('WebAuthn non è supportato su questo browser');
      }

      // Verifica se l'username è già registrato
      const existingCredential = await this.getCredentialId(username);
      if (existingCredential) {
        throw new Error('Username già registrato con WebAuthn');
      }

      const createCredentialOptions: PublicKeyCredentialCreationOptions = {
        challenge: STATIC_CHALLENGE,
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
          }
        ],
        timeout: 60000,
        attestation: "none",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          requireResidentKey: false
        }
      };

      const credential = await navigator.credentials.create({
        publicKey: createCredentialOptions
      }) as PublicKeyCredential;

      const credentialId = bufferToBase64(credential.rawId);
      const password = sha256(username + credentialId);

      // Salva localmente
      localStorage.setItem("shogun_webauthn_credential_id", credentialId);
      localStorage.setItem("shogun_webauthn_username", username);
      
      // Salva in Gun
      await this.gun.get(this.DAPP_NAME)
        .get("webauthn-credentials")
        .get(username)
        .put({
          credentialId,
          timestamp: Date.now()
        });

      return {
        success: true,
        username,
        password,
        credentialId
      };
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
      const credentialId = await this.getCredentialId(username);
      if (!credentialId) {
        throw new Error("Nessuna credenziale WebAuthn trovata per questo username");
      }

      const assertionOptions: PublicKeyCredentialRequestOptions = {
        challenge: STATIC_CHALLENGE,
        allowCredentials: [{
          id: base64ToBuffer(credentialId),
          type: 'public-key',
          transports: ['internal', 'platform']
        }],
        timeout: 60000,
        userVerification: "required"
      };

      const assertion = await navigator.credentials.get({
        publicKey: assertionOptions
      });

      if (!assertion) {
        throw new Error('Verifica WebAuthn fallita');
      }

      const password = sha256(username + credentialId);

      return {
        success: true,
        username,
        password,
        credentialId
      };
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
      const assertionOptions: PublicKeyCredentialRequestOptions = {
        challenge: STATIC_CHALLENGE,
        allowCredentials: [{
          id: base64ToBuffer(credentialId),
          type: 'public-key',
          transports: ['internal', 'platform']
        }],
        timeout: 60000,
        userVerification: "required"
      };

      const assertion = await navigator.credentials.get({
        publicKey: assertionOptions
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
    } catch (error) {
      console.error('Errore verifica WebAuthn:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    }
  }

  // Recupera il credentialId da Gun
  private async getCredentialId(username: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.gun.get(this.DAPP_NAME)
        .get("webauthn-credentials")
        .get(username)
        .once((data: any) => {
          resolve(data?.credentialId || null);
        });
    });
  }

  // Verifica se WebAuthn è supportato
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 
           window.PublicKeyCredential !== undefined &&
           typeof window.PublicKeyCredential === 'function';
  }
} 