import { IGunInstance, ISEAPair } from "gun";
import type { ActivityPubKeys } from "../interfaces/ActivityPubKeys";
import { BaseManager } from "./BaseManager";
export declare class ActivityPubManager extends BaseManager<ActivityPubKeys> {
    protected storagePrefix: string;
    constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair);
    /**
     * Generates a new RSA key pair for ActivityPub.
     * @returns {Promise<ActivityPubKeys>} - The generated key pair.
     * @throws {Error} - If key generation fails.
     */
    createAccount(): Promise<ActivityPubKeys>;
    /**
     * Effettua il login con le credenziali fornite
     */
    login(username: string, password: string): Promise<string>;
    /**
     * Salva le chiavi ActivityPub
     */
    saveKeys(keys: ActivityPubKeys): Promise<void>;
    /**
     * Recupera le chiavi ActivityPub
     */
    getKeys(): Promise<ActivityPubKeys>;
    /**
     * Recupera la chiave pubblica ActivityPub
     */
    getPub(): Promise<string>;
    /**
     * Elimina le chiavi ActivityPub
     */
    deleteKeys(): Promise<void>;
    /**
     * Retrieves the private key for a given username.
     * @param {string} username - The username to retrieve the private key for.
     * @returns {Promise<string>}
     * @throws {Error} - If the username format is invalid or the private key is not found.
     */
    getPk(username: string): Promise<string>;
    /**
     * Validates the format of a given key.
     * @param {string} key - The key to validate.
     * @returns {boolean} - True if the key format is valid, false otherwise.
     */
    private validateKey;
    /**
     * Imports a private key from a PEM string.
     * @param {string} pem - The PEM string to import.
     * @returns {Promise<CryptoKey>}
     */
    importPk(pem: string): Promise<CryptoKey | string>;
    /**
     * Signs ActivityPub data.
     * @param {string} stringToSign - The string to sign.
     * @param {string} username - The username associated with the private key.
     * @returns {Promise<{ signature: string; signatureHeader: string }>}
     * @throws {Error} - If the private key is not found or signing fails.
     */
    sign(stringToSign: string, username: string): Promise<{
        signature: string;
        signatureHeader: string;
    }>;
    /**
     * Generates an RSA key pair.
     * @returns {Promise<{ publicKey: string; privateKey: string }>}
     * @throws {Error} - If key generation fails.
     */
    private generateRSAKeyPair;
    private arrayBufferToBase64;
}
