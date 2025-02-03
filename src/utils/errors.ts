/**
 * Errore base per l'applicazione
 */
export class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Errore di autenticazione
 */
export class AuthenticationError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Errore di validazione
 */
export class ValidationError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Errore di rete
 */
export class NetworkError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Errore WebAuthn
 */
export class WebAuthnError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class WalletError extends BaseError {
  constructor(message: string) {
    super(`Errore wallet: ${message}`);
  }
} 