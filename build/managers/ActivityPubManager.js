import { BaseManager } from "./BaseManager";
let cryptoModule;
try {
    if (typeof window === "undefined") {
        // Siamo in Node.js
        cryptoModule = require("crypto");
    }
}
catch {
    cryptoModule = null;
}
export class ActivityPubManager extends BaseManager {
    constructor(gun, APP_KEY_PAIR) {
        super(gun, APP_KEY_PAIR);
        this.storagePrefix = "activitypub";
    }
    /**
     * Generates a new RSA key pair for ActivityPub.
     * @returns {Promise<ActivityPubKeys>} - The generated key pair.
     * @throws {Error} - If key generation fails.
     */
    async createAccount() {
        try {
            const { privateKey, publicKey } = await this.generateRSAKeyPair();
            if (!this.validateKey(privateKey) || !this.validateKey(publicKey)) {
                throw new Error("Invalid generated key format");
            }
            const keys = {
                publicKey,
                privateKey,
                createdAt: Date.now(),
            };
            await this.saveKeys(keys);
            return keys;
        }
        catch (error) {
            console.error("Error generating keys:", error);
            throw new Error(`Key generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Effettua il login con le credenziali fornite
     */
    async login(username, password) {
        return new Promise((resolve, reject) => {
            this.user.auth(username, password, (ack) => {
                if (ack.err)
                    reject(new Error(ack.err));
                else
                    resolve(this.getCurrentPublicKey());
            });
        });
    }
    /**
     * Salva le chiavi ActivityPub
     */
    async saveKeys(keys) {
        this.checkAuthentication();
        await this.savePrivateData(keys, "activitypub/keys");
        await this.savePublicData({ publicKey: keys.publicKey }, "activitypub/publicKey");
    }
    /**
     * Recupera le chiavi ActivityPub
     */
    async getKeys() {
        this.checkAuthentication();
        const keys = await this.getPrivateData("activitypub/keys");
        if (!keys) {
            throw new Error("Keys not found");
        }
        return keys;
    }
    /**
     * Recupera la chiave pubblica ActivityPub
     */
    async getPub() {
        this.checkAuthentication();
        const publicKey = this.getCurrentPublicKey();
        const data = await this.getPublicData(publicKey, "activitypub/publicKey");
        return data?.publicKey;
    }
    /**
     * Elimina le chiavi ActivityPub
     */
    async deleteKeys() {
        this.checkAuthentication();
        await this.deletePrivateData("activitypub/keys");
        await this.deletePublicData("activitypub/publicKey");
    }
    /**
     * Retrieves the private key for a given username.
     * @param {string} username - The username to retrieve the private key for.
     * @returns {Promise<string>}
     * @throws {Error} - If the username format is invalid or the private key is not found.
     */
    async getPk(username) {
        try {
            // Aggiungi controllo più rigoroso
            if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
                throw new Error(`Username "${username}" non valido`);
            }
            const privateData = await this.getPrivateData(`activitypub/keys`); // Path specifico per utente
            if (!privateData || !privateData.privateKey) {
                throw new Error("Private key not found for user " + username);
            }
            if (!this.validateKey(privateData.privateKey)) {
                throw new Error("Invalid key format for user " + username);
            }
            return privateData.privateKey;
        }
        catch (error) {
            console.error("Error retrieving key:", error);
            throw error;
        }
    }
    /**
     * Validates the format of a given key.
     * @param {string} key - The key to validate.
     * @returns {boolean} - True if the key format is valid, false otherwise.
     */
    validateKey(key) {
        if (!key || typeof key !== "string") {
            return false;
        }
        // Per le chiavi private
        if (key.includes("PRIVATE KEY")) {
            return key.includes("-----BEGIN PRIVATE KEY-----") &&
                key.includes("-----END PRIVATE KEY-----") &&
                key.length > 500; // Una chiave RSA 2048 dovrebbe essere più lunga di questo
        }
        // Per le chiavi pubbliche
        if (key.includes("PUBLIC KEY")) {
            return key.includes("-----BEGIN PUBLIC KEY-----") &&
                key.includes("-----END PUBLIC KEY-----") &&
                key.length > 200; // Una chiave pubblica RSA 2048 dovrebbe essere più lunga di questo
        }
        return false;
    }
    /**
     * Imports a private key from a PEM string.
     * @param {string} pem - The PEM string to import.
     * @returns {Promise<CryptoKey>}
     */
    async importPk(pem) {
        // Se siamo in Node.js, non serve importare la chiave
        if (typeof window === "undefined") {
            return pem;
        }
        // Se siamo nel browser
        const pemContents = pem
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replace(/\n/g, "");
        const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
        return window.crypto.subtle.importKey("pkcs8", binaryDer, {
            name: "RSASSA-PKCS1-v1_5",
            hash: { name: "SHA-256" },
        }, false, ["sign"]);
    }
    /**
     * Signs ActivityPub data.
     * @param {string} stringToSign - The string to sign.
     * @param {string} username - The username associated with the private key.
     * @returns {Promise<{ signature: string; signatureHeader: string }>}
     * @throws {Error} - If the private key is not found or signing fails.
     */
    async sign(stringToSign, username) {
        try {
            // Recupera la chiave privata
            const privateKey = await this.getPk(username);
            if (!privateKey) {
                throw new Error("Private key not found for user " + username);
            }
            let signature;
            // Se siamo in Node.js
            if (typeof window === "undefined" && cryptoModule) {
                try {
                    const signer = cryptoModule.createSign("RSA-SHA256");
                    signer.update(stringToSign);
                    signature = signer.sign(privateKey, "base64");
                }
                catch (error) {
                    throw new Error(`Private key not found or invalid: ${error instanceof Error ? error.message : "unknown error"}`);
                }
            }
            // Se siamo nel browser
            else if (typeof window !== "undefined" && window.crypto?.subtle) {
                try {
                    // Converti la chiave PEM in formato utilizzabile
                    const cryptoKey = await this.importPk(privateKey);
                    if (typeof cryptoKey === 'string') {
                        throw new Error("Private key not found or invalid format for browser environment");
                    }
                    // Codifica la stringa da firmare
                    const encoder = new TextEncoder();
                    const dataBuffer = encoder.encode(stringToSign);
                    // Firma i dati
                    const signatureBuffer = await window.crypto.subtle.sign({
                        name: "RSASSA-PKCS1-v1_5",
                        hash: { name: "SHA-256" },
                    }, cryptoKey, dataBuffer);
                    // Converti la firma in base64
                    signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
                }
                catch (error) {
                    throw new Error(`Private key not found or invalid: ${error instanceof Error ? error.message : "unknown error"}`);
                }
            }
            else {
                throw new Error("No cryptographic implementation available");
            }
            // Genera l'header della firma
            const signatureHeader = `keyId="${username}",algorithm="rsa-sha256",signature="${signature}"`;
            return { signature, signatureHeader };
        }
        catch (error) {
            if (error instanceof Error && error.message.includes("Private key not found")) {
                throw error; // Rilanciamo l'errore originale se riguarda la chiave privata mancante
            }
            console.error("Error signing ActivityPub data:", error);
            throw new Error(`ActivityPub signing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Generates an RSA key pair.
     * @returns {Promise<{ publicKey: string; privateKey: string }>}
     * @throws {Error} - If key generation fails.
     */
    async generateRSAKeyPair() {
        // Se siamo in Node.js
        if (typeof window === "undefined" && cryptoModule) {
            try {
                const { generateKeyPairSync } = cryptoModule;
                const keys = generateKeyPairSync("rsa", {
                    modulusLength: 2048,
                    publicKeyEncoding: {
                        type: "spki",
                        format: "pem",
                    },
                    privateKeyEncoding: {
                        type: "pkcs8",
                        format: "pem",
                    },
                });
                // Verifica il formato delle chiavi
                if (!this.validateKey(keys.privateKey)) {
                    throw new Error("Generated private key has invalid format");
                }
                return {
                    publicKey: keys.publicKey,
                    privateKey: keys.privateKey,
                };
            }
            catch (error) {
                console.error("Node.js key generation error:", error);
                throw new Error(`Key generation failed in Node.js: ${error instanceof Error ? error.message : "unknown error"}`);
            }
        }
        // Se siamo nel browser
        if (typeof window !== "undefined" && window.crypto?.subtle) {
            try {
                const keyPair = await window.crypto.subtle.generateKey({
                    name: "RSASSA-PKCS1-v1_5",
                    modulusLength: 2048,
                    publicExponent: new Uint8Array([1, 0, 1]),
                    hash: { name: "SHA-256" },
                }, true, ["sign", "verify"]);
                const [publicKeyBuffer, privateKeyBuffer] = await Promise.all([
                    window.crypto.subtle.exportKey("spki", keyPair.publicKey),
                    window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
                ]);
                const publicKey = `-----BEGIN PUBLIC KEY-----\n${this.arrayBufferToBase64(publicKeyBuffer)}\n-----END PUBLIC KEY-----`;
                const privateKey = `-----BEGIN PRIVATE KEY-----\n${this.arrayBufferToBase64(privateKeyBuffer)}\n-----END PRIVATE KEY-----`;
                // Verifica il formato delle chiavi
                if (!this.validateKey(privateKey)) {
                    throw new Error("Generated private key has invalid format");
                }
                return { publicKey, privateKey };
            }
            catch (error) {
                console.error("Browser key generation error:", error);
                throw new Error(`Key generation failed in browser: ${error instanceof Error ? error.message : "unknown error"}`);
            }
        }
        throw new Error("No cryptographic implementation available");
    }
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        // Formatta il base64 in linee di 64 caratteri
        return base64.match(/.{1,64}/g)?.join("\n") || base64;
    }
}
