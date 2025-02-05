import Gun from 'gun';
import _ from 'lodash';
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
export async function encrypt(data, opts) {
    let epub = opts.recipient?.epub;
    return await _crypt(data, _encryptValue, { ...opts, epub });
}
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
export async function decrypt(data, opts) {
    let epub = opts.sender?.epub;
    return await _crypt(data, _decryptValue, { ...opts, epub });
}
export async function _crypt(data, map, opts) {
    let { pair, secret = '', epub = '' } = opts;
    if (!pair && !secret) {
        throw new Error('Either pair or secret is required');
    }
    if (!secret && epub) {
        secret = await Gun.SEA.secret(epub, pair || secret);
        if (typeof secret === 'undefined') {
            throw _getSEAError('Could not create secret');
        }
    }
    if (!secret) {
        secret = pair;
    }
    return await _mapDeep(data, map, { secret, signed: !epub });
}
/**
 * Traverse data and map.
 * @param data
 * @param map
 * @param opts
 */
async function _mapDeep(data, map, opts) {
    switch (typeof data) {
        case 'undefined':
            return undefined;
        case 'object':
            if (_.isArrayLike(data)) {
                // Array
                return Promise.all(_.map(data, x => _mapDeep(x, map, opts)));
            }
            // Object
            let meta = data._;
            if (meta) {
                // Remove meta
                data = _.omit(data, '_');
            }
            let keys = Object.keys(data);
            let rawValues = Object.values(data);
            let values = await Promise.all(rawValues.map(x => _mapDeep(x, map, opts)));
            let result = _.zipObject(keys, values);
            if (meta) {
                result = { _: meta, ...result };
            }
            return result;
        default:
            return map(data, opts);
    }
}
const _encryptValue = async (value, { secret, signed }) => {
    if (value.startsWith('SEA{')) {
        // Already encrypted
        return value;
    }
    let data = await Gun.SEA.encrypt(value, secret);
    if (typeof data === 'undefined') {
        throw _getSEAError('Could not encrypt');
    }
    if (signed) {
        data = await Gun.SEA.sign(data, secret);
        if (typeof data === 'undefined') {
            throw _getSEAError('Could not sign');
        }
    }
    return data;
};
const _decryptValue = async (data, { secret, signed }) => {
    if (!data.startsWith('SEA{')) {
        // No decryption necessary
        return data;
    }
    let msg = data;
    if (signed) {
        msg = await Gun.SEA.verify(data, secret);
        if (typeof msg === 'undefined') {
            throw _getSEAError('Could not verify');
        }
    }
    let value = await Gun.SEA.decrypt(msg, secret);
    if (typeof value === 'undefined') {
        throw _getSEAError('Could not decrypt');
    }
    return value;
};
const _getSEAError = (_default) => {
    let err = Gun.SEA.err || _default;
    if (!err) {
        return undefined;
    }
    if (typeof err === 'object' && err instanceof Error) {
        return err;
    }
    return new Error(String(err));
};
