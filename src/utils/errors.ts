/**
 * Errori personalizzati per l'applicazione
 */

export class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends BaseError {
  constructor(message: string) {
    super(`Errore di validazione: ${message}`);
  }
}

export class WebAuthnError extends BaseError {
  constructor(message: string) {
    super(`Errore WebAuthn: ${message}`);
  }
}

export class NetworkError extends BaseError {
  constructor(message: string) {
    super(`Errore di rete: ${message}`);
  }
}

export class WalletError extends BaseError {
  constructor(message: string) {
    super(`Errore wallet: ${message}`);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string) {
    super(`Errore di autenticazione: ${message}`);
  }
} 