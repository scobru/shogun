import { ValidationError } from "./gun/errors";
import { ethers } from "ethers";
/**
 * Costanti di validazione
 */
export const VALIDATION_CONSTANTS = {
    ALIAS: {
        MIN_LENGTH: 3,
        MAX_LENGTH: 64,
        PATTERN: /^[a-zA-Z0-9_-]+$/
    },
    PRIVATE_KEY: {
        LENGTH: 64,
        HEX_PATTERN: /^[0-9a-fA-F]+$/
    },
    PASSWORD: {
        MIN_LENGTH: 8,
        PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/
    }
};
/**
 * Valida un alias utente
 * @param alias - L'alias da validare
 * @returns true se l'alias è valido, false altrimenti
 */
export function validateAlias(alias) {
    if (!alias || typeof alias !== 'string')
        return false;
    // Se è un indirizzo Ethereum, lo accettiamo
    if (alias.startsWith('0x') && alias.length === 42) {
        return ethers.isAddress(alias);
    }
    // Altrimenti verifichiamo il formato standard
    // Minimo 3 caratteri, massimo 30
    if (alias.length < 3 || alias.length > 30)
        return false;
    // Solo caratteri alfanumerici e underscore
    const aliasRegex = /^[a-zA-Z0-9_]+$/;
    return aliasRegex.test(alias);
}
/**
 * Valida una chiave privata Ethereum
 * @param privateKey - La chiave privata da validare
 * @returns true se la chiave è valida, false altrimenti
 */
export function validatePrivateKey(privateKey) {
    try {
        if (!privateKey || typeof privateKey !== 'string')
            return false;
        // Rimuovi '0x' se presente
        const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
        // Deve essere una stringa esadecimale di 64 caratteri
        if (!/^[0-9a-fA-F]{64}$/.test(cleanKey))
            return false;
        // Prova a creare un wallet con questa chiave
        new ethers.Wallet(privateKey);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Valida una password
 * @param password - Password da validare
 * @throws {ValidationError} Se la password non è valida
 */
export function validatePassword(password) {
    if (!password || typeof password !== "string") {
        throw new ValidationError("La password deve essere una stringa non vuota");
    }
    if (password.length < VALIDATION_CONSTANTS.PASSWORD.MIN_LENGTH) {
        throw new ValidationError(`La password deve essere lunga almeno ${VALIDATION_CONSTANTS.PASSWORD.MIN_LENGTH} caratteri`);
    }
    if (!VALIDATION_CONSTANTS.PASSWORD.PATTERN.test(password)) {
        throw new ValidationError("La password deve contenere almeno una lettera minuscola, una maiuscola e un numero");
    }
}
/**
 * Valida un indirizzo Ethereum
 * @param address - L'indirizzo da validare
 * @returns true se l'indirizzo è valido, false altrimenti
 */
export function validateEthereumAddress(address) {
    try {
        if (!address || typeof address !== 'string')
            return false;
        return ethers.isAddress(address);
    }
    catch {
        return false;
    }
}
