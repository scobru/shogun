import { IGunInstance, ISEAPair } from "gun";
import { GunKeyPair } from "../interfaces";
import { WalletData } from "../interfaces/WalletResult";
import { Wallet } from "ethers";
import { BaseManager } from "./BaseManager";
export declare class WalletManager extends BaseManager<WalletData[]> {
    protected storagePrefix: string;
    constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair);
    /**
     * Creates a new wallet from the Gun user
     * @returns {Promise<WalletData[]>} - The result object of the created wallet
     * @throws {Error} - If the user is not authenticated or if wallet creation fails
     */
    createAccount(): Promise<WalletData[]>;
    /**
     * Creates a hash using the Web Crypto API in the browser or the crypto module in Node.js
     * @param {string} data - The data to hash
     * @returns {Promise<string>} - The created hash
     * @throws {Error} - If no crypto implementation is available or if hash creation fails
     */
    private createHash;
    /**
     * Creates a wallet from a salt and a Gun key pair
     * @param {GunKeyPair} gunKeyPair - The Gun key pair
     * @param {string} salt - The salt to use for wallet creation
     * @returns {Promise<Wallet>} - The created wallet
     * @throws {Error} - If the salt is invalid, if the derived key cannot be generated, if the generated hash is invalid, or if wallet creation fails
     */
    createWalletFromSalt(gunKeyPair: GunKeyPair, salt: string): Promise<Wallet>;
    /**
     * Retrieves all user wallets with all their information
     * @returns {Promise<Array<Wallet & { entropy?: string; timestamp?: number }>>} - An array of wallets with additional information
     * @throws {Error} - If wallet data retrieval fails
     */
    getWallets(): Promise<Array<Wallet & {
        entropy?: string;
        timestamp?: number;
    }>>;
    /**
     * Retrieves the main wallet (derived from the Gun key)
     * @returns {Promise<Wallet>} - The main wallet
     * @throws {Error} - If the user is not authenticated or if private key conversion fails
     */
    getWallet(): Promise<Wallet>;
    /**
     * Saves a new wallet
     * @param {Wallet} wallet - The wallet to save
     * @returns {Promise<void>} - A promise that resolves when the wallet is saved
     * @throws {ValidationError} - If the Ethereum address or private key are invalid
     * @throws {Error} - If the user is not authenticated or if wallet saving fails
     */
    saveWallet(wallet: Wallet): Promise<void>;
    /**
     * Converts a Gun private key to an Ethereum private key
     * @param {string} gunPrivateKey - The Gun private key
     * @returns {string} - The Ethereum private key
     * @throws {Error} - If the private key is invalid or if conversion fails
     */
    convertToEthPk(gunPrivateKey: string): string;
}
