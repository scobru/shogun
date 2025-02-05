/**
 * Errore base per l'applicazione
 */
export class BaseError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
/**
 * Errore di autenticazione
 */
export class AuthenticationError extends BaseError {
    constructor(message) {
        super(message);
    }
}
/**
 * Errore di validazione
 */
export class ValidationError extends BaseError {
    constructor(message) {
        super(message);
    }
}
/**
 * Errore WebAuthn
 */
export class WebAuthnError extends BaseError {
    constructor(message) {
        super(message);
    }
}
export class WalletError extends BaseError {
    constructor(message) {
        super(`Errore wallet: ${message}`);
    }
}
/** Base Gun wrapper error. */
export class GunError extends Error {
}
/** Base error related to the network. */
export class NetworkError extends GunError {
}
/** Timeout error. */
export class TimeoutError extends NetworkError {
    constructor(...args) {
        super(...withDefaultMessage(args, "The operation timed out"));
    }
}
/** Base error related to authentication. */
export class AuthError extends GunError {
}
/** Attempting to start another login while another is in progress. */
export class MultipleAuthError extends AuthError {
}
/** Login error. */
export class InvalidCredentials extends AuthError {
}
/** User creation error. */
export class UserExists extends AuthError {
}
const withDefaultMessage = (args, defaultMessage) => {
    if (args.length === 0 || (args.length === 1 && !args[0])) {
        args = [defaultMessage];
    }
    return args;
};
