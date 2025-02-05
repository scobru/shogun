import { IGunInstance, ISEAPair } from "gun";
import type { GunKeyPair } from "../interfaces/GunKeyPair";
import { BaseManager } from "./BaseManager";
/**
 * Main authentication manager handling GUN.js user operations and SEA (Security, Encryption, Authorization)
 * @class
 * @classdesc Manages decentralized user authentication, data encryption, and secure operations using GUN.js and SEA
 */
export declare class GunAuthManager extends BaseManager<GunKeyPair> {
    private isAuthenticating;
    private pub;
    protected storagePrefix: string;
    constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair);
    private resetGunState;
    /**
     * Checks username availability and creates user if available.
     * @param username Desired username.
     * @param password User password.
     * @returns Public key of created user.
     * @throws Error if username is already taken or user creation fails.
     */
    checkUser(username: string, password: string): Promise<string>;
    private getPubFromAlias;
    /**
     * Creates a new user account with GUN/SEA.
     * @param alias User's username.
     * @param passphrase User's password.
     * @returns Generated SEA key pair for the user.
     */
    createAccount(alias: string, passphrase: string): Promise<GunKeyPair>;
    private _hardReset;
    /**
     * Authenticates user with provided credentials.
     * @param alias User's username.
     * @param passphrase User's password.
     * @param attempt (Optional) Current attempt number (for retry).
     * @returns User's public key.
     * @throws Error on authentication failure or timeout.
     */
    login(alias: string, passphrase: string): Promise<string | null>;
    /**
     * Terminates the current user session.
     */
    logout(): void;
    /**
     * Gets current user's public key.
     * @returns User's public key.
     * @throws Error if user is not authenticated.
     */
    getPublicKey(): string;
    /**
     * Gets current user's SEA key pair.
     */
    getPair(): GunKeyPair;
    /**
     * Gets the GUN instance reference.
     */
    getGun(): any;
    getUser(): any;
    /**
     * Exports the current user's key pair as JSON.
     * @returns Stringified key pair.
     * @throws Error if user is not authenticated.
     */
    exportGunKeyPair(): Promise<string>;
    /**
     * Imports and authenticates with a key pair.
     * @param keyPairJson Stringified key pair.
     * @returns Public key of authenticated user.
     * @throws Error if key pair is invalid or authentication fails.
     */
    importGunKeyPair(keyPairJson: string): Promise<string>;
    /**
     * Saves private user data.
     * @param data Data to store.
     * @param path Storage path.
     * @throws Error if user is not authenticated.
     */
    savePrivateData(data: any, path: string): Promise<void>;
    /**
     * Retrieves private user data.
     * @param path Storage path.
     * @returns Stored data.
     * @throws Error if user is not authenticated.
     */
    getPrivateData(path: string): Promise<any>;
    /**
     * Saves public user data for the authenticated user.
     * @param data Data to store.
     * @param path Storage path.
     * @throws Error if user is not authenticated.
     */
    savePublicData(data: any, path: string): Promise<void>;
    /**
     * Retrieves public user data of a given user.
     * @param publicKey Public key of the user whose data to retrieve.
     * @param path Storage path.
     * @returns Stored data.
     */
    getPublicData(publicKey: string, path: string): Promise<any>;
    /**
     * Deletes private user data at the specified path.
     */
    deletePrivateData(path: string): Promise<void>;
    /**
     * Deletes public user data at the specified path for the authenticated user.
     */
    deletePublicData(path: string): Promise<void>;
    /**
     * Checks if a user with the specified alias exists.
     * @param alias Username to check.
     * @returns True if the user exists, false otherwise.
     */
    exists(alias: string): Promise<boolean>;
    /**
     * Initializes the authentication listener.
     */
    authListener(): Promise<void>;
    /**
     * Safely logs out the user ensuring session termination.
     */
    private _safeLogout;
    /**
     * Checks if the current user is authenticated.
     * @returns True if authenticated, false otherwise.
     */
    isAuthenticated(): boolean;
}
