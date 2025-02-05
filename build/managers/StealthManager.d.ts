import { ethers } from "ethers";
import { BaseManager } from "./BaseManager";
import type { StealthKeyPair } from "../interfaces/StealthKeyPair";
import { IGunInstance, ISEAPair } from "gun";
/**
 * Gestisce la logica stealth usando Gun e SEA
 */
export declare class StealthManager extends BaseManager<StealthKeyPair> {
    protected storagePrefix: string;
    constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair);
    /**
     * Rimuove il tilde (~) iniziale dalla chiave pubblica se presente
     * @param {string} publicKey - The public key to format
     * @returns {string} - The formatted public key
     * @throws {Error} - If the public key is invalid
     */
    private formatPublicKey;
    /**
     * Genera le chiavi stealth se non esistono, altrimenti restituisce quelle esistenti
     * @returns {Promise<StealthKeyPair>} - The generated or existing stealth key pair
     * @throws {Error} - If the generated keys are invalid
     */
    createAccount(): Promise<StealthKeyPair>;
    /**
     * Generates a stealth address for the recipient's public key
     * @param {string} recipientPublicKey - The recipient's public key
     * @returns {Promise<{stealthAddress: string, ephemeralPublicKey: string, recipientPublicKey: string}>} - The generated stealth address and keys
     * @throws {Error} - If the keys are invalid or missing
     */
    generateStAdd(recipientPublicKey: string): Promise<{
        stealthAddress: string;
        ephemeralPublicKey: string;
        recipientPublicKey: string;
    }>;
    /**
     * Opens a stealth address by deriving the private key
     * @param {string} stealthAddress - The stealth address to open
     * @param {string} ephemeralPublicKey - The ephemeral public key
     * @returns {Promise<ethers.Wallet>} - The derived wallet
     * @throws {Error} - If the parameters are missing or the keys are invalid
     */
    openStAdd(stealthAddress: string, ephemeralPublicKey: string): Promise<ethers.Wallet>;
    /**
     * Retrieves stealth keys (epub) from public registry if present
     * @param {string} publicKey - The public key to retrieve stealth keys for
     * @returns {Promise<string | null>} - The retrieved stealth keys or null if not found
     * @throws {Error} - If the public key is invalid
     */
    retrieveKeys(publicKey: string): Promise<string | null>;
    /**
     * Retrieves stealth keys for a specific user
     * @param {string} publicKey - The public key to retrieve stealth keys for
     * @returns {Promise<StealthKeyPair | null>} - The retrieved stealth key pair or null if not found
     * @throws {Error} - If the public key is invalid
     */
    retrievePair(publicKey: string): Promise<StealthKeyPair | null>;
    /**
     * Salva le chiavi stealth nel profilo utente
     * @param {StealthKeyPair} stealthKeyPair - The stealth key pair to save
     * @returns {Promise<void>} - A promise that resolves when the keys are saved
     * @throws {Error} - If the stealth keys are invalid or incomplete
     */
    save(stealthKeyPair: StealthKeyPair): Promise<void>;
    /**
     * Recupera le chiavi stealth dell'utente corrente
     * @returns {Promise<StealthKeyPair>} - The stealth key pair
     * @throws {Error} - If the keys are not found
     */
    getPair(): Promise<StealthKeyPair>;
    /**
     * Recupera la chiave pubblica stealth di un utente
     * @param {string} publicKey - The public key to get the stealth key for
     * @returns {Promise<string | null>} - The stealth public key or null if not found
     */
    getPub(publicKey: string): Promise<string | null>;
}
