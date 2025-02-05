import { IGunChainReference } from "./types/chain";
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
export declare function waitForData<T = any>(ref: IGunChainReference<Record<any, T>>, options?: {
    filter?: (data: T) => boolean;
    timeout?: number;
    timeoutError?: Error;
}): Promise<T>;
/**
 * Resolve after `ms` interval.
 * @param ms
 * @param passthrough
 */
export declare function delay<T = any>(ms: number, passthrough?: T): Promise<T>;
/**
 * Throw error after `ms` interval.
 * @param ms
 * @param error
 */
export declare function errorAfter<T = void>(ms: number, error: Error): Promise<T>;
/**
 * If the promise does not resolve (or error) within `ms` interval,
 * throws a the specified `error`. If no error is specified, uses
 * a `TimeoutError` instead.
 * @param ms
 * @param error
 */
export declare function timeoutAfter<T = any>(promise: Promise<T>, ms: number, error?: Error): Promise<T>;
