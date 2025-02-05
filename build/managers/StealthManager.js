import { ethers } from "ethers";
import Gun from "gun";
import { BaseManager } from "./BaseManager";
const SEA = Gun.SEA;
/**
 * Gestisce la logica stealth usando Gun e SEA
 */
export class StealthManager extends BaseManager {
    constructor(gun, APP_KEY_PAIR) {
        super(gun, APP_KEY_PAIR);
        this.storagePrefix = "stealth";
    }
    /**
     * Rimuove il tilde (~) iniziale dalla chiave pubblica se presente
     * @param {string} publicKey - The public key to format
     * @returns {string} - The formatted public key
     * @throws {Error} - If the public key is invalid
     */
    formatPublicKey(publicKey) {
        if (!publicKey) {
            throw new Error("Invalid public key: missing parameter");
        }
        return publicKey.startsWith("~") ? publicKey.slice(1) : publicKey;
    }
    /**
     * Genera le chiavi stealth se non esistono, altrimenti restituisce quelle esistenti
     * @returns {Promise<StealthKeyPair>} - The generated or existing stealth key pair
     * @throws {Error} - If the generated keys are invalid
     */
    async createAccount() {
        try {
            const existingKeys = await this.getPair();
            if (existingKeys) {
                return existingKeys;
            }
        }
        catch (error) {
            // Se non troviamo chiavi esistenti, ne creiamo di nuove
        }
        return new Promise((resolve, reject) => {
            SEA.pair((pair) => {
                if (!pair?.pub || !pair?.priv || !pair?.epub || !pair?.epriv) {
                    reject(new Error("Generated keys are invalid"));
                    return;
                }
                const stealthKeyPair = {
                    pub: pair.pub,
                    priv: pair.priv,
                    epub: pair.epub,
                    epriv: pair.epriv,
                };
                this.save(stealthKeyPair)
                    .then(() => resolve(stealthKeyPair))
                    .catch(reject);
            });
        });
    }
    /**
     * Generates a stealth address for the recipient's public key
     * @param {string} recipientPublicKey - The recipient's public key
     * @returns {Promise<{stealthAddress: string, ephemeralPublicKey: string, recipientPublicKey: string}>} - The generated stealth address and keys
     * @throws {Error} - If the keys are invalid or missing
     */
    async generateStAdd(recipientPublicKey) {
        if (!recipientPublicKey) {
            throw new Error("Invalid keys: missing or invalid parameters");
        }
        // Prima creiamo le chiavi stealth se non esistono
        const stealthKeys = await this.createAccount();
        if (!stealthKeys) {
            throw new Error("Failed to create stealth keys");
        }
        return new Promise((resolve, reject) => {
            SEA.pair((ephemeralKeyPair) => {
                if (!ephemeralKeyPair?.epub || !ephemeralKeyPair?.epriv) {
                    reject(new Error("Invalid ephemeral keys"));
                    return;
                }
                SEA.secret(stealthKeys.epub, ephemeralKeyPair, (sharedSecret) => {
                    if (!sharedSecret) {
                        reject(new Error("Shared secret generation failed"));
                        return;
                    }
                    try {
                        const stealthPrivateKey = ethers.keccak256(ethers.toUtf8Bytes(sharedSecret));
                        const stealthWallet = new ethers.Wallet(stealthPrivateKey);
                        resolve({
                            stealthAddress: stealthWallet.address,
                            ephemeralPublicKey: ephemeralKeyPair.epub,
                            recipientPublicKey,
                        });
                    }
                    catch (error) {
                        reject(new Error(`Error creating stealth address: ${error instanceof Error ? error.message : "unknown error"}`));
                    }
                });
            });
        });
    }
    /**
     * Opens a stealth address by deriving the private key
     * @param {string} stealthAddress - The stealth address to open
     * @param {string} ephemeralPublicKey - The ephemeral public key
     * @returns {Promise<ethers.Wallet>} - The derived wallet
     * @throws {Error} - If the parameters are missing or the keys are invalid
     */
    async openStAdd(stealthAddress, ephemeralPublicKey) {
        if (!stealthAddress || !ephemeralPublicKey) {
            throw new Error("Missing parameters: stealthAddress or ephemeralPublicKey");
        }
        const keys = await this.getPair();
        if (!keys) {
            throw new Error("Stealth keys not found");
        }
        return new Promise((resolve, reject) => {
            SEA.secret(ephemeralPublicKey, { epriv: keys.epriv, epub: keys.epub }, (sharedSecret) => {
                if (!sharedSecret) {
                    reject(new Error("Unable to generate shared secret"));
                    return;
                }
                try {
                    const stealthPrivateKey = ethers.keccak256(ethers.toUtf8Bytes(sharedSecret));
                    const stealthWallet = new ethers.Wallet(stealthPrivateKey);
                    if (stealthWallet.address.toLowerCase() !==
                        stealthAddress.toLowerCase()) {
                        reject(new Error("Derived address doesn't match provided stealth address"));
                        return;
                    }
                    resolve(stealthWallet);
                }
                catch (error) {
                    reject(new Error(`Error deriving stealth wallet: ${error instanceof Error ? error.message : "unknown error"}`));
                }
            });
        });
    }
    /**
     * Retrieves stealth keys (epub) from public registry if present
     * @param {string} publicKey - The public key to retrieve stealth keys for
     * @returns {Promise<string | null>} - The retrieved stealth keys or null if not found
     * @throws {Error} - If the public key is invalid
     */
    async retrieveKeys(publicKey) {
        if (!publicKey) {
            throw new Error("Invalid public key");
        }
        const formattedPubKey = this.formatPublicKey(publicKey);
        const data = await this.getPublicData(formattedPubKey, "stealth");
        return data?.epub || null;
    }
    /**
     * Retrieves stealth keys for a specific user
     * @param {string} publicKey - The public key to retrieve stealth keys for
     * @returns {Promise<StealthKeyPair | null>} - The retrieved stealth key pair or null if not found
     * @throws {Error} - If the public key is invalid
     */
    async retrievePair(publicKey) {
        if (!publicKey) {
            throw new Error("Invalid public key: missing parameter");
        }
        try {
            // Otteniamo i dati grezzi da Gun
            const rawData = await this.getPrivateData("stealth");
            if (!rawData) {
                console.log("No stealth keys found");
                return null;
            }
            // Verifichiamo che i dati contengano le chiavi necessarie
            if (!rawData.pub || !rawData.priv || !rawData.epub || !rawData.epriv) {
                console.error("Invalid stealth keys format:", rawData);
                return null;
            }
            // Restituiamo i dati completi, inclusi i metadati di Gun
            return rawData;
        }
        catch (error) {
            console.error("Error retrieving stealth keys:", error);
            return null;
        }
    }
    /**
     * Salva le chiavi stealth nel profilo utente
     * @param {StealthKeyPair} stealthKeyPair - The stealth key pair to save
     * @returns {Promise<void>} - A promise that resolves when the keys are saved
     * @throws {Error} - If the stealth keys are invalid or incomplete
     */
    async save(stealthKeyPair) {
        if (!stealthKeyPair?.pub || !stealthKeyPair?.priv || !stealthKeyPair?.epub || !stealthKeyPair?.epriv) {
            throw new Error("Invalid stealth keys: missing or incomplete parameters");
        }
        await this.savePrivateData(stealthKeyPair, "stealth");
        await this.savePublicData({ epub: stealthKeyPair.epub }, "stealth");
    }
    /**
     * Recupera le chiavi stealth dell'utente corrente
     * @returns {Promise<StealthKeyPair>} - The stealth key pair
     * @throws {Error} - If the keys are not found
     */
    async getPair() {
        const keys = await this.getPrivateData("stealth");
        if (!keys || !keys.pub || !keys.priv || !keys.epub || !keys.epriv) {
            throw new Error("Stealth keys not found");
        }
        return keys;
    }
    /**
     * Recupera la chiave pubblica stealth di un utente
     * @param {string} publicKey - The public key to get the stealth key for
     * @returns {Promise<string | null>} - The stealth public key or null if not found
     */
    async getPub(publicKey) {
        const formattedPubKey = this.formatPublicKey(publicKey);
        const data = await this.getPublicData(formattedPubKey, "stealth");
        return data?.epub || null;
    }
}
