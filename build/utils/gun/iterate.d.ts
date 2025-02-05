import { IGunChainReference } from "./types/chain";
import { Filter } from "./filter";
export interface IterateOptions<T = string> extends Filter<T> {
    /**
     * Possible values:
     * 1. Positive number: Ascending order.
     * 2. Negative number: Desccending order.
     * 3. Zero or undefined: Defaults to ascending order when
     * ordering is guaranteed, otherwise order is not defined.
     */
    order?: number;
    /**
     * **Temporarily ignored. Do not use.**
     *
     * After this time interval (ms), no more
     * data is returned. Defaults to Gun's default
     * of 99 ms.
     **/
    wait?: number;
}
/**
 * Iterate over async iterator to the end and return
 * the collected values.
 * @param it An async iterable
 */
export declare function iterateAll<T>(it: AsyncIterable<T>): Promise<T[]>;
/**
 * Iterates over the inner keys of a record at a Gun node reference.
 * ~~Specify a `opt.wait` value over 1000 on slow networks and CPUs.~~
 * ~~Behaviour is different if ordering is required, which is specified by
 * setting `opt.order` to a non zero value.~~
 *
 * **1. If order is specified:**
 *
 * Iterates over the inner keys of a record at a Gun node reference,
 * by loading the whole record.
 *
 * Note that keys are guaranteed to be in order, but if a peer
 * fails to reply within the `wait` period, the item [value, key] will
 * skipped. A second pass is necessary to get these skipped items.
 *
 * Filtering using [Gun's lexical wire spec](https://gun.eco/docs/RAD#lex)
 * is **not** supported (as at Gun v0.2020.520).
 *
 * **2. If order is not specified:**
 *
 * ~~This is more efficient than without ordering, but it sacrifices guaranteed
 * ascending order of data by key. This is the case if there is more
 * than one connected peer.~~
 *
 * ~~Filtering using [Gun's lexical wire spec](https://gun.eco/docs/RAD#lex)
 * is supported.~~
 *
 * @param ref Gun node reference
 **/
export declare function iterateRecord<V = any, T = Record<any, V>>(ref: IGunChainReference<T>, opts?: IterateOptions): AsyncGenerator<[V, string]>;
/**
 * Iterate over inner references at a Gun node reference, yielding
 * the inner reference and its key.
 *
 * Note that keys are not guaranteed to be in order if there
 * is more than one connected peer.
 *
 * @param ref Gun node reference
 **/
export declare function iterateRefs<T = any>(ref: IGunChainReference<T[] | Record<any, T>>, opts?: IterateOptions): AsyncGenerator<[IGunChainReference<T>, string]>;
/**
 * Iterate over inner records at a Gun node reference, yielding
 * the inner record and its key.
 *
 * Note that keys are not guaranteed to be in order if there
 * is more than one connected peer.
 *
 * @param ref Gun node reference
 **/
export declare function iterateItems<T = any>(ref: IGunChainReference<T[] | Record<any, T>>, opts?: IterateOptions): AsyncGenerator<[T, string]>;
/**
 * Iterate over inner records at a Gun node reference, yielding
 * the inner record.
 *
 * Note that keys are not guaranteed to be in order if there
 * is more than one connected peer.
 *
 * @param ref Gun node reference
 **/
export declare function iterateValues<T = any>(ref: IGunChainReference<T[] | Record<any, T>>, opts?: IterateOptions): AsyncGenerator<T>;
/**
 * Iterate over inner records at a Gun node reference, yielding
 * the inner record.
 *
 * Note that keys are not guaranteed to be in order if there
 * is more than one connected peer.
 *
 * @param ref Gun node reference
 **/
export declare function iterateKeys(ref: IGunChainReference, opts?: IterateOptions): AsyncGenerator<string>;
