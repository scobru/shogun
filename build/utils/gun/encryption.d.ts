import { IGunCryptoKeyPair } from './types/types';
interface CryptOptionsBase {
    pair?: IGunCryptoKeyPair;
    secret?: any;
}
interface EncryptOptionsBase extends CryptOptionsBase {
    recipient?: {
        epub: string;
    };
}
interface DecryptOptionsBase extends CryptOptionsBase {
    sender?: {
        epub: string;
    };
}
type CryptOptions = CryptOptionsBase & (Required<Pick<CryptOptionsBase, 'pair'>> | Required<Pick<CryptOptionsBase, 'secret'>>);
export type EncryptOptions = EncryptOptionsBase & CryptOptions;
export type DecryptOptions = DecryptOptionsBase & CryptOptions;
/**
 * Encrypt (and optionally sign) a value, array or object. The encrypted data
 * retains topology and can only be decrypted by the current user.
 *
 * Keys are not encrypted.
 *
 * If the value or nested value is already encrypted, does not re-encrypt
 * that value.
 *
 * Specifying a recipient's epub key will only allow that user to decrypt the value,
 * with Elliptic-curve Diffie–Hellman based encryption.
 *
 * @param value
 * @param opts
 */
export declare function encrypt<T>(data: T, opts: EncryptOptions): Promise<T>;
/**
 * Decrypt (and optionally verify) a value, array or object. The decrypted data
 * retains topology and can only be decrypted by the current user.
 *
 * Keys are not encrypted.
 *
 * If the value or nested value is already encrypted, does not re-encrypt
 * that value.
 *
 * Specifying a sender's epub key will decrypt the value which was encrypted
 * by the sender.
 *
 * @param value
 * @param opts
 */
export declare function decrypt<T>(data: T, opts: DecryptOptions): Promise<T>;
export declare function _crypt(data: any, map: any, opts: CryptOptions & {
    epub?: string;
}): Promise<any>;
export {};
