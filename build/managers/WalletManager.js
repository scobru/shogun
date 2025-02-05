import { SEA } from "gun";
import { Wallet } from "ethers";
import { ValidationError } from "../utils/gun/errors";
import { validateEthereumAddress, validatePrivateKey, } from "../utils/validation";
import { BaseManager } from "./BaseManager";
// Import crypto only for Node.js
let cryptoModule;
try {
    if (typeof window === "undefined") {
        // We are in Node.js
        cryptoModule = require("crypto");
    }
}
catch {
    cryptoModule = null;
}
export class WalletManager extends BaseManager {
    constructor(gun, APP_KEY_PAIR) {
        super(gun, APP_KEY_PAIR);
        this.storagePrefix = "wallets";
    }
    /**
     * Creates a new wallet from the Gun user
     * @returns {Promise<WalletData[]>} - The result object of the created wallet
     * @throws {Error} - If the user is not authenticated or if wallet creation fails
     */
    async createAccount() {
        try {
            const gunKeyPair = this.user._.sea;
            if (!gunKeyPair || !gunKeyPair.pub) {
                throw new Error("Missing or invalid Gun key pair");
            }
            const salt = `${gunKeyPair.pub}_${Date.now()}_${Math.random()
                .toString(36)
                .substring(2, 15)}`;
            console.log("Creating wallet with salt:", salt);
            const wallet = await this.createWalletFromSalt(gunKeyPair, salt);
            if (!wallet || !wallet.address) {
                throw new Error("Failed to create valid wallet");
            }
            const walletData = {
                address: wallet.address.toLowerCase(),
                privateKey: wallet.privateKey,
                entropy: salt,
                timestamp: Date.now(),
            };
            console.log("Saving wallet with address:", walletData.address);
            await this.saveWallet(new Wallet(walletData.privateKey));
            // Verifichiamo che il wallet sia stato salvato correttamente
            const savedWallets = await this.getPrivateData("wallets");
            if (!savedWallets) {
                throw new Error("Failed to verify wallet was saved");
            }
            console.log("Wallet saved successfully");
            return [walletData];
        }
        catch (error) {
            console.error("Error in createAccount:", error);
            throw new Error(`Error creating wallet: ${error.message}`);
        }
    }
    /**
     * Creates a hash using the Web Crypto API in the browser or the crypto module in Node.js
     * @param {string} data - The data to hash
     * @returns {Promise<string>} - The created hash
     * @throws {Error} - If no crypto implementation is available or if hash creation fails
     */
    async createHash(data) {
        try {
            // If we are in Node.js
            if (typeof window === "undefined" && cryptoModule) {
                return cryptoModule
                    .createHash("sha256")
                    .update(Buffer.from(data, "utf8"))
                    .digest("hex");
            }
            // If we are in the browser
            if (typeof window !== "undefined" && window.crypto) {
                const encoder = new TextEncoder();
                const dataBuffer = encoder.encode(data);
                const hashBuffer = await window.crypto.subtle.digest("SHA-256", dataBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
            }
            throw new Error("No crypto implementation available");
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown error during hash creation";
            throw new Error(`Hash creation failed: ${errorMessage}`);
        }
    }
    /**
     * Creates a wallet from a salt and a Gun key pair
     * @param {GunKeyPair} gunKeyPair - The Gun key pair
     * @param {string} salt - The salt to use for wallet creation
     * @returns {Promise<Wallet>} - The created wallet
     * @throws {Error} - If the salt is invalid, if the derived key cannot be generated, if the generated hash is invalid, or if wallet creation fails
     */
    async createWalletFromSalt(gunKeyPair, salt) {
        try {
            if (!salt || typeof salt !== "string") {
                throw new Error("Invalid salt provided");
            }
            const derivedKey = await SEA.work(salt, gunKeyPair);
            if (!derivedKey)
                throw new Error("Unable to generate derived key");
            const hash = await this.createHash(derivedKey);
            if (!hash || hash.length !== 64) {
                throw new Error("Invalid hash generated");
            }
            const wallet = new Wallet("0x" + hash);
            if (!wallet || !wallet.address || !wallet.privateKey) {
                throw new Error("Failed to create valid wallet");
            }
            // Basic wallet verification
            if (!wallet.address.startsWith("0x") || wallet.address.length !== 42) {
                throw new Error("Invalid wallet address format");
            }
            wallet.entropy = salt;
            return wallet;
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown error during wallet creation";
            throw new Error(`Error recreating wallet: ${errorMessage}`);
        }
    }
    /**
     * Retrieves all user wallets with all their information
     * @returns {Promise<Array<Wallet & { entropy?: string; timestamp?: number }>>} - An array of wallets with additional information
     * @throws {Error} - If wallet data retrieval fails
     */
    async getWallets() {
        try {
            let walletData = null;
            walletData = await this.getPrivateData("wallets");
            if (!walletData) {
                console.log("No wallet data found after multiple attempts");
                return [];
            }
            // Convertiamo in array se necessario
            const walletsArray = Array.isArray(walletData)
                ? walletData
                : [walletData];
            console.log("Retrieved wallets:", walletsArray.length);
            // Filtriamo e creiamo le istanze
            const wallets = walletsArray
                .filter((w) => w && w.privateKey && w.address)
                .map((w) => {
                try {
                    const wallet = new Wallet(w.privateKey);
                    // Verifichiamo che l'indirizzo corrisponda
                    if (wallet.address.toLowerCase() !== w.address.toLowerCase()) {
                        console.error("Address mismatch for wallet:", w.address);
                        return null;
                    }
                    // Aggiungiamo le proprietà aggiuntive
                    Object.defineProperties(wallet, {
                        entropy: {
                            value: w.entropy || "",
                            writable: true,
                            enumerable: true,
                        },
                        timestamp: {
                            value: w.timestamp || Date.now(),
                            writable: true,
                            enumerable: true,
                        },
                    });
                    return wallet;
                }
                catch (error) {
                    console.error("Error creating wallet instance:", error);
                    return null;
                }
            })
                .filter((w) => w !== null);
            console.log("Processed wallets:", wallets.length);
            return wallets;
        }
        catch (error) {
            console.error("Error retrieving wallets:", error);
            throw new Error(`Failed to retrieve wallets: ${error instanceof Error ? error.message : "unknown error"}`);
        }
    }
    /**
     * Retrieves the main wallet (derived from the Gun key)
     * @returns {Promise<Wallet>} - The main wallet
     * @throws {Error} - If the user is not authenticated or if private key conversion fails
     */
    async getWallet() {
        const pair = this.user._.sea;
        if (!pair)
            throw new Error("User not authenticated");
        const walletPK = this.convertToEthPk(pair.priv);
        const wallet = new Wallet(walletPK);
        return wallet;
    }
    /**
     * Saves a new wallet
     * @param {Wallet} wallet - The wallet to save
     * @returns {Promise<void>} - A promise that resolves when the wallet is saved
     * @throws {ValidationError} - If the Ethereum address or private key are invalid
     * @throws {Error} - If the user is not authenticated or if wallet saving fails
     */
    async saveWallet(wallet) {
        this.checkAuthentication();
        if (!validateEthereumAddress(wallet.address)) {
            throw new ValidationError("Invalid Ethereum address");
        }
        if (!validatePrivateKey(wallet.privateKey)) {
            throw new ValidationError("Invalid private key");
        }
        const walletData = {
            address: wallet.address.toLowerCase(),
            privateKey: wallet.privateKey,
            entropy: wallet.entropy || "",
            timestamp: Date.now(),
        };
        try {
            // Recuperiamo i wallet esistenti con retry
            let existingWallets = [];
            let retries = 3;
            const existingData = await this.getPrivateData("wallets");
            if (existingData) {
                if (Array.isArray(existingData)) {
                    existingWallets = existingData;
                }
                else if (typeof existingData === "object") {
                    existingWallets = [existingData];
                }
            }
            // Verifichiamo se il wallet esiste già
            const walletExists = existingWallets.some((w) => w &&
                w.address &&
                w.address.toLowerCase() === walletData.address.toLowerCase());
            if (!walletExists) {
                existingWallets.push(walletData);
            }
            // Salviamo i dati con retry
            retries = 3;
            let saved = false;
            await this.savePrivateData(existingWallets, "wallets");
            // Verifichiamo il salvataggio
            const verificationData = await this.getPrivateData("wallets");
            if (verificationData) {
                saved = true;
            }
            if (!saved) {
                throw new Error("Failed to verify wallet data was saved after multiple attempts");
            }
        }
        catch (error) {
            console.error("Error saving wallet:", error);
            throw new Error(`Failed to save wallet: ${error instanceof Error ? error.message : "unknown error"}`);
        }
    }
    /**
     * Converts a Gun private key to an Ethereum private key
     * @param {string} gunPrivateKey - The Gun private key
     * @returns {string} - The Ethereum private key
     * @throws {Error} - If the private key is invalid or if conversion fails
     */
    convertToEthPk(gunPrivateKey) {
        const base64UrlToHex = (base64url) => {
            const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
            const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
            const binary = atob(base64);
            const hex = Array.from(binary, (char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
            if (hex.length !== 64) {
                throw new Error("Cannot convert private key: invalid length");
            }
            return hex;
        };
        if (!gunPrivateKey || typeof gunPrivateKey !== "string") {
            throw new Error("Cannot convert private key: invalid input");
        }
        try {
            const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
            return hexPrivateKey;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Cannot convert private key: ${error.message}`);
            }
            else {
                throw new Error("Cannot convert private key: unknown error");
            }
        }
    }
}
