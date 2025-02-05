/**
 * Errore base per l'applicazione
 */
export declare class BaseError extends Error {
    constructor(message: string);
}
/**
 * Errore di autenticazione
 */
export declare class AuthenticationError extends BaseError {
    constructor(message: string);
}
/**
 * Errore di validazione
 */
export declare class ValidationError extends BaseError {
    constructor(message: string);
}
/**
 * Errore WebAuthn
 */
export declare class WebAuthnError extends BaseError {
    constructor(message: string);
}
export declare class WalletError extends BaseError {
    constructor(message: string);
}
/** Base Gun wrapper error. */
export declare class GunError extends Error {
}
/** Base error related to the network. */
export declare class NetworkError extends GunError {
}
/** Timeout error. */
export declare class TimeoutError extends NetworkError {
    constructor(...args: any);
}
/** Base error related to authentication. */
export declare class AuthError extends GunError {
}
/** Attempting to start another login while another is in progress. */
export declare class MultipleAuthError extends AuthError {
}
/** Login error. */
export declare class InvalidCredentials extends AuthError {
}
/** User creation error. */
export declare class UserExists extends AuthError {
}
