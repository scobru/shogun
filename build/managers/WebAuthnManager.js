import { BaseManager } from "./BaseManager";
import jsSha256 from "js-sha256";
import "gun/sea";
const sha256 = jsSha256.sha256;
let cryptoModule;
try {
    if (typeof window === "undefined") {
        cryptoModule = require("crypto");
    }
}
catch {
    cryptoModule = null;
}
const TIMEOUT_MS = 60000; // 60 secondi
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 64;
const generateDeviceId = () => {
    const platform = typeof navigator !== "undefined" ? navigator.platform : "unknown";
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return uint8ArrayToHex(new TextEncoder().encode(`${platform}-${timestamp}-${random}`));
};
// Funzione per ottenere informazioni sulla piattaforma
const getPlatformInfo = () => {
    if (typeof navigator === "undefined") {
        return { name: "unknown", platform: "unknown" };
    }
    const platform = navigator.platform;
    const userAgent = navigator.userAgent;
    let name = "Unknown Device";
    if (/iPhone|iPad|iPod/.test(platform)) {
        name = "iOS Device";
    }
    else if (/Android/.test(userAgent)) {
        name = "Android Device";
    }
    else if (/Win/.test(platform)) {
        name = "Windows Device";
    }
    else if (/Mac/.test(platform)) {
        name = "Mac Device";
    }
    else if (/Linux/.test(platform)) {
        name = "Linux Device";
    }
    return { name, platform };
};
// Funzione per convertire Uint8Array in stringa hex
const uint8ArrayToHex = (arr) => {
    return Array.from(arr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};
// Genera bytes casuali in modo sicuro
const getRandomBytes = (length) => {
    if (typeof window !== "undefined" && window.crypto) {
        // Usa WebCrypto nel browser
        return window.crypto.getRandomValues(new Uint8Array(length));
    }
    else if (cryptoModule) {
        // Usa Node.js crypto
        return new Uint8Array(cryptoModule.randomBytes(length));
    }
    throw new Error("Nessuna implementazione crittografica disponibile");
};
// Challenge statica per generare credenziali deterministiche
const generateChallenge = (username) => {
    const timestamp = Date.now().toString();
    const randomBytes = getRandomBytes(32);
    const challengeData = `${username}-${timestamp}-${uint8ArrayToHex(randomBytes)}`;
    return new TextEncoder().encode(challengeData);
};
// Utility per convertire ArrayBuffer in base64 in modo sicuro
const bufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    const binary = bytes.reduce((str, byte) => str + String.fromCharCode(byte), "");
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};
// Utility per convertire base64 in ArrayBuffer in modo sicuro
const base64ToBuffer = (base64) => {
    if (!/^[A-Za-z0-9\-_]*$/.test(base64)) {
        throw new Error("Invalid base64 string");
    }
    const base64Url = base64.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
    const base64Padded = base64Url + padding;
    try {
        const binary = atob(base64Padded);
        const buffer = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            buffer[i] = binary.charCodeAt(i);
        }
        return buffer.buffer;
    }
    catch (error) {
        throw new Error("Failed to decode base64 string");
    }
};
// Genera credenziali deterministiche da username e salt
const generateCredentialsFromSalt = (username, salt) => {
    return {
        password: sha256(username + salt),
    };
};
export class WebAuthnManager extends BaseManager {
    constructor(gun, APP_KEY_PAIR) {
        super(gun, APP_KEY_PAIR);
        this.storagePrefix = "webauthn";
    }
    validateUsername(username) {
        if (!username || typeof username !== "string") {
            throw new Error("Username must be a non-empty string");
        }
        if (username.length < MIN_USERNAME_LENGTH ||
            username.length > MAX_USERNAME_LENGTH) {
            throw new Error(`Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`);
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            throw new Error("Username can only contain letters, numbers, underscores and hyphens");
        }
    }
    /**
     * Recupera i dati privati per un utente WebAuthn
     */
    async getWebAuthnPrivateData(username) {
        const data = await this.getPrivateData(username);
        return data;
    }
    /**
     * Salva i dati privati per un utente WebAuthn
     */
    async saveWebAuthnPrivateData(data) {
        await this.savePrivateData(data, "webauthn");
    }
    /**
     * Salva i dati pubblici per un utente WebAuthn
     */
    async saveWebAuthnPublicData(data) {
        await this.savePublicData(data, "webauthn");
    }
    /**
     * Ottiene la coppia di chiavi corrente
     */
    getPairFromGun() {
        return this.gun.user()._.sea;
    }
    /**
     * Implementazione del metodo createAccount richiesto da BaseManager
     */
    async createAccount(username, isNewDevice = false, deviceName) {
        const result = await this.generateCredentials(username, isNewDevice, deviceName);
        if (!result.success) {
            throw new Error(result.error || "Errore durante la creazione dell'account");
        }
        return result;
    }
    // Recupera le credenziali WebAuthn da Gun
    async getWebAuthnCredentials(username) {
        const credentials = await this.getWebAuthnPrivateData(username);
        return credentials;
    }
    async saveCredentials(username, credentials) {
        // Salva i dati privati (credenziali complete)
        await this.saveWebAuthnPrivateData(credentials);
        // Salva i dati pubblici (solo informazioni non sensibili)
        const publicData = {
            username,
            registered: true,
            lastUsed: Date.now(),
            deviceCount: Object.keys(credentials.credentials).length,
        };
        await this.saveWebAuthnPublicData(publicData);
    }
    getAuthenticators() {
        return [this.getPairFromGun()];
    }
    async generateCredentials(username, isNewDevice = false, deviceName) {
        try {
            this.validateUsername(username);
            if (!this.isSupported()) {
                throw new Error("WebAuthn non è supportato su questo browser");
            }
            // Recupera le credenziali esistenti
            const existingCreds = await this.getWebAuthnCredentials(username);
            // Se non è un nuovo dispositivo e l'username esiste, errore
            if (existingCreds && !isNewDevice) {
                throw new Error("Username già registrato con WebAuthn");
            }
            // Se è un nuovo dispositivo ma l'username non esiste, errore
            if (!existingCreds && isNewDevice) {
                throw new Error("Username non trovato. Registrati prima come nuovo utente");
            }
            // Genera una challenge unica per questa registrazione
            const challenge = generateChallenge(username);
            const createCredentialOptions = {
                challenge,
                rp: {
                    name: "Shogun Wallet",
                    id: window.location.hostname,
                },
                user: {
                    id: new TextEncoder().encode(username),
                    name: username,
                    displayName: username,
                },
                pubKeyCredParams: [
                    {
                        type: "public-key",
                        alg: -7, // ES256
                    },
                    {
                        type: "public-key",
                        alg: -257, // RS256
                    },
                ],
                timeout: TIMEOUT_MS,
                attestation: "direct",
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "required",
                    requireResidentKey: true,
                },
                extensions: {
                    credProps: true,
                },
            };
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);
            try {
                const credential = (await navigator.credentials.create({
                    publicKey: createCredentialOptions,
                    signal: abortController.signal,
                }));
                // Usa il salt esistente o ne crea uno nuovo
                const salt = existingCreds?.salt || uint8ArrayToHex(getRandomBytes(32));
                // Genera le credenziali dal salt
                const { password } = generateCredentialsFromSalt(username, salt);
                // Ottieni informazioni sul dispositivo
                const { name: defaultDeviceName, platform } = getPlatformInfo();
                const deviceId = generateDeviceId();
                // Prepara le credenziali da salvare
                const credentialId = bufferToBase64(credential.rawId);
                const newCredential = {
                    deviceId,
                    timestamp: Date.now(),
                    name: deviceName || defaultDeviceName,
                    platform,
                };
                // Aggiorna o crea le credenziali WebAuthn
                const updatedCreds = {
                    salt,
                    timestamp: Date.now(),
                    credentials: {
                        ...(existingCreds?.credentials || {}),
                        [credentialId]: newCredential,
                    },
                };
                // Salva le credenziali aggiornate
                await this.saveCredentials(username, updatedCreds);
                return {
                    success: true,
                    username,
                    password,
                    credentialId,
                    deviceInfo: newCredential,
                };
            }
            finally {
                clearTimeout(timeoutId);
            }
        }
        catch (error) {
            console.error("Errore generazione credenziali WebAuthn:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Errore sconosciuto",
            };
        }
    }
    // Ottieni la lista dei dispositivi registrati
    async getRegisteredDevices(username) {
        const creds = await this.getWebAuthnCredentials(username);
        if (!creds?.credentials) {
            return [];
        }
        return Object.values(creds.credentials);
    }
    // Rimuovi un dispositivo registrato
    async removeDevice(username, credentialId) {
        const creds = await this.getWebAuthnCredentials(username);
        if (!creds?.credentials || !creds.credentials[credentialId]) {
            return false;
        }
        const updatedCreds = { ...creds };
        delete updatedCreds.credentials[credentialId];
        await this.saveCredentials(username, updatedCreds);
        return true;
    }
    async authenticateUser(username) {
        try {
            // Validazioni di sicurezza
            this.validateUsername(username);
            const salt = await this.getSalt(username);
            if (!salt) {
                throw new Error("Nessuna credenziale WebAuthn trovata per questo username");
            }
            const challenge = generateChallenge(username);
            const assertionOptions = {
                challenge,
                allowCredentials: [], // Non serve specificare le credenziali poiché usiamo il salt
                timeout: TIMEOUT_MS,
                userVerification: "required",
                rpId: window.location.hostname,
            };
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);
            try {
                const assertion = (await navigator.credentials.get({
                    publicKey: assertionOptions,
                    signal: abortController.signal,
                }));
                if (!assertion) {
                    throw new Error("Verifica WebAuthn fallita");
                }
                // Genera le credenziali dal salt salvato
                const { password } = generateCredentialsFromSalt(username, salt);
                await this.saveWebAuthnPublicData({
                    lastUsed: Date.now(),
                });
                return {
                    success: true,
                    username,
                    password,
                    credentialId: bufferToBase64(assertion.rawId),
                };
            }
            finally {
                clearTimeout(timeoutId);
            }
        }
        catch (error) {
            console.error("Errore login WebAuthn:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Errore sconosciuto",
            };
        }
    }
    // Verifica una credenziale esistente
    async verifyCredential(credentialId) {
        try {
            if (!credentialId || typeof credentialId !== "string") {
                throw new Error("Invalid credential ID");
            }
            const challengeBytes = getRandomBytes(32);
            const assertionOptions = {
                challenge: challengeBytes,
                allowCredentials: [
                    {
                        id: base64ToBuffer(credentialId),
                        type: "public-key",
                        transports: ["internal", "hybrid"],
                    },
                ],
                timeout: TIMEOUT_MS,
                userVerification: "required",
                rpId: window.location.hostname,
            };
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);
            try {
                const assertion = (await navigator.credentials.get({
                    publicKey: assertionOptions,
                    signal: abortController.signal,
                }));
                if (!assertion) {
                    throw new Error("Verifica WebAuthn fallita");
                }
                const response = assertion.response;
                return {
                    success: true,
                    authenticatorData: response.authenticatorData,
                    signature: response.signature,
                };
            }
            finally {
                clearTimeout(timeoutId);
            }
        }
        catch (error) {
            console.error("Errore verifica WebAuthn:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Errore sconosciuto",
            };
        }
    }
    // Recupera il salt da Gun
    async getSalt(username) {
        const credentials = await this.getWebAuthnCredentials(username);
        return credentials?.salt || null;
    }
    // Verifica se WebAuthn è supportato
    isSupported() {
        return (typeof window !== "undefined" &&
            window.PublicKeyCredential !== undefined &&
            typeof window.PublicKeyCredential === "function" &&
            typeof window.crypto !== "undefined" &&
            typeof window.crypto.subtle !== "undefined");
    }
}
