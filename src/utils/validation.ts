import { ValidationError } from "./errors";

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
 * @param alias - Alias da validare
 * @throws {ValidationError} Se l'alias non è valido
 */
export function validateAlias(alias: string): void {
  if (!alias || typeof alias !== "string") {
    throw new ValidationError("L'alias deve essere una stringa non vuota");
  }
  
  if (alias.length < VALIDATION_CONSTANTS.ALIAS.MIN_LENGTH || 
      alias.length > VALIDATION_CONSTANTS.ALIAS.MAX_LENGTH) {
    throw new ValidationError(
      `L'alias deve essere lungo tra ${VALIDATION_CONSTANTS.ALIAS.MIN_LENGTH} e ${VALIDATION_CONSTANTS.ALIAS.MAX_LENGTH} caratteri`
    );
  }

  if (!VALIDATION_CONSTANTS.ALIAS.PATTERN.test(alias)) {
    throw new ValidationError("L'alias può contenere solo lettere, numeri, underscore e trattini");
  }
}

/**
 * Valida una chiave privata
 * @param privateKey - Chiave privata da validare
 * @throws {ValidationError} Se la chiave privata non è valida
 */
export function validatePrivateKey(privateKey: string): void {
  if (!privateKey || typeof privateKey !== "string") {
    throw new ValidationError("La chiave privata deve essere una stringa non vuota");
  }

  if (privateKey.length !== VALIDATION_CONSTANTS.PRIVATE_KEY.LENGTH) {
    throw new ValidationError(`La chiave privata deve essere lunga ${VALIDATION_CONSTANTS.PRIVATE_KEY.LENGTH} caratteri`);
  }

  if (!VALIDATION_CONSTANTS.PRIVATE_KEY.HEX_PATTERN.test(privateKey)) {
    throw new ValidationError("La chiave privata deve essere in formato esadecimale");
  }
}

/**
 * Valida una password
 * @param password - Password da validare
 * @throws {ValidationError} Se la password non è valida
 */
export function validatePassword(password: string): void {
  if (!password || typeof password !== "string") {
    throw new ValidationError("La password deve essere una stringa non vuota");
  }

  if (password.length < VALIDATION_CONSTANTS.PASSWORD.MIN_LENGTH) {
    throw new ValidationError(
      `La password deve essere lunga almeno ${VALIDATION_CONSTANTS.PASSWORD.MIN_LENGTH} caratteri`
    );
  }

  if (!VALIDATION_CONSTANTS.PASSWORD.PATTERN.test(password)) {
    throw new ValidationError(
      "La password deve contenere almeno una lettera minuscola, una maiuscola e un numero"
    );
  }
}

/**
 * Valida un indirizzo Ethereum
 * @param address - Indirizzo da validare
 * @throws {ValidationError} Se l'indirizzo non è valido
 */
export function validateEthereumAddress(address: string): void {
  if (!address || typeof address !== "string") {
    throw new ValidationError("L'indirizzo deve essere una stringa non vuota");
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new ValidationError("L'indirizzo Ethereum non è valido");
  }
} 