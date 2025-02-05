/**
 * Costanti di validazione
 */
export declare const VALIDATION_CONSTANTS: {
    ALIAS: {
        MIN_LENGTH: number;
        MAX_LENGTH: number;
        PATTERN: RegExp;
    };
    PRIVATE_KEY: {
        LENGTH: number;
        HEX_PATTERN: RegExp;
    };
    PASSWORD: {
        MIN_LENGTH: number;
        PATTERN: RegExp;
    };
};
/**
 * Valida un alias utente
 * @param alias - L'alias da validare
 * @returns true se l'alias è valido, false altrimenti
 */
export declare function validateAlias(alias: string): boolean;
/**
 * Valida una chiave privata Ethereum
 * @param privateKey - La chiave privata da validare
 * @returns true se la chiave è valida, false altrimenti
 */
export declare function validatePrivateKey(privateKey: string): boolean;
/**
 * Valida una password
 * @param password - Password da validare
 * @throws {ValidationError} Se la password non è valida
 */
export declare function validatePassword(password: string): void;
/**
 * Valida un indirizzo Ethereum
 * @param address - L'indirizzo da validare
 * @returns true se l'indirizzo è valido, false altrimenti
 */
export declare function validateEthereumAddress(address: string): boolean;
