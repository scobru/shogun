import { TimeoutError } from "./errors";
/**
 * Subscribes to a Gun node reference and return
 * that value when the filter returns a truthy value.
 *
 * If no `filter` is specified, returns on the
 * first non-undefined value.
 *
 * If a `timeout` (in milliseconds) is given, and no
 * matching data arrives in that time, `timeoutError`
 * is thrown (or a `TimeoutError` if none given).
 *
 * @param ref
 * @param filter
 */
export async function waitForData(ref, options = {}) {
    if (!ref) {
        throw new Error('Invalid Gun node reference');
    }
    let { filter, timeout, timeoutError, } = options;
    if (typeof filter !== 'undefined' && (typeof filter !== 'function' || filter.length === 0)) {
        throw new Error('Invalid filter');
    }
    let sub;
    let listener = new Promise((resolve, reject) => {
        if (!filter) {
            filter = (data) => typeof data !== 'undefined';
        }
        sub = ref.on((data, key, at, ev) => {
            sub = ev;
            if (filter(data)) {
                sub?.off?.();
                sub = undefined;
                resolve(data);
            }
        });
    }).finally(() => {
        sub?.off?.();
    });
    if (timeout && timeout > 0) {
        return await timeoutAfter(listener, timeout, timeoutError);
    }
    else {
        return await listener;
    }
}
/**
 * Resolve after `ms` interval.
 * @param ms
 * @param passthrough
 */
export function delay(ms, passthrough) {
    let timer;
    return new Promise((resolve, reject) => {
        timer = setTimeout(() => resolve(passthrough), ms);
    }).finally(() => {
        timer && clearTimeout(timer);
    });
}
/**
 * Throw error after `ms` interval.
 * @param ms
 * @param error
 */
export async function errorAfter(ms, error) {
    await delay(ms);
    throw error;
}
/**
 * If the promise does not resolve (or error) within `ms` interval,
 * throws a the specified `error`. If no error is specified, uses
 * a `TimeoutError` instead.
 * @param ms
 * @param error
 */
export async function timeoutAfter(promise, ms, error) {
    return Promise.race([
        promise,
        errorAfter(ms, error || new TimeoutError()),
    ]);
}
