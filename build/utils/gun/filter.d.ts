export interface PrimitiveCastable {
    valueOf: () => string | number;
}
export interface Filter<T> {
    gt?: T;
    gte?: T;
    lt?: T;
    lte?: T;
}
export interface ValueRange<T> {
    start?: T;
    end?: T;
    startClosed: boolean;
    endClosed: boolean;
}
export declare function isInRange<T extends PrimitiveCastable>(key: T, range: ValueRange<T>): boolean;
/**
 * Returns the index range of keys which are inside
 * the given range.
 *
 * @param keys Unique keys sorted in ascending lexical order
 * @param range
 * @returns
 *  The start (inclusive) and end (exclusive) indexes of
 *  the keys matching the filter.
 */
export declare function filteredIndexRange<T extends PrimitiveCastable>(keys: T[], range: ValueRange<T>): [number, number];
export declare const isValueRangeEmpty: (range: ValueRange<any>) => boolean;
export declare function rangeWithFilter<T>(filter: Filter<T>): ValueRange<T>;
export declare function filterWithRange<T>(range: ValueRange<T>): Filter<T>;
export declare function mapValueRange<U, V>(range: ValueRange<U>, map: (v: U) => V): ValueRange<V>;
/**
 * Create a closed filter from an open filter,
 * preserving any other properties on the object.
 **/
export declare function closedFilter<T>(filter: Filter<T> & {
    [x: string]: any;
}): Filter<T> & {
    [x: string]: any;
};
