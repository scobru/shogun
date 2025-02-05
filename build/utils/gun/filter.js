import _ from "lodash";
export function isInRange(key, range) {
    if (isValueRangeEmpty(range)) {
        return false;
    }
    let { start, end, startClosed, endClosed, } = range;
    let keyValue = key.valueOf();
    if (typeof start !== 'undefined') {
        let startValue = start.valueOf();
        if (keyValue < startValue)
            return false;
        if (!startClosed && keyValue === startValue)
            return false;
    }
    if (typeof end !== 'undefined') {
        let endValue = end.valueOf();
        if (keyValue > endValue)
            return false;
        if (!endClosed && keyValue === endValue)
            return false;
    }
    return true;
}
;
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
export function filteredIndexRange(keys, range) {
    if (isValueRangeEmpty(range)) {
        return [0, 0];
    }
    let len = keys.length;
    if (len === 0) {
        return [0, 0];
    }
    if (len === 1) {
        if (isInRange(keys[0], range)) {
            return [0, 1];
        }
        else {
            return [0, 0];
        }
    }
    let { start, end, startClosed = true, endClosed = false, } = range;
    let iStart = 0;
    if (typeof start !== 'undefined') {
        iStart = _.sortedIndex(keys, start);
        let key = keys[iStart];
        if (key <= start && !startClosed) {
            iStart += 1;
        }
    }
    // iEnd is inclusive here
    let iEnd = len - 1;
    if (typeof end !== 'undefined') {
        iEnd = _.sortedIndex(keys, end);
        let key = keys[iEnd];
        if (key >= end && !endClosed) {
            iEnd -= 1;
        }
        iEnd = Math.min(iEnd, len - 1);
    }
    if (iStart > iEnd) {
        return [0, 0];
    }
    return [iStart, iEnd + 1];
}
;
export const isValueRangeEmpty = (range) => {
    let { start, end, startClosed, endClosed, } = range;
    if (typeof start !== 'undefined' && typeof end !== 'undefined') {
        if (start == end && !(startClosed && endClosed)) {
            return true;
        }
        else if (start > end) {
            return true;
        }
    }
    return false;
};
export function rangeWithFilter(filter) {
    let { gt, gte, lt, lte } = filter || {};
    let range = {
        start: undefined,
        end: undefined,
        startClosed: false,
        endClosed: false,
    };
    if (typeof gte !== 'undefined') {
        range.start = gte;
        range.startClosed = true;
    }
    else if (typeof gt !== 'undefined') {
        range.start = gt;
    }
    if (typeof lte !== 'undefined') {
        range.end = lte;
        range.endClosed = true;
    }
    else if (typeof lt !== 'undefined') {
        range.end = lt;
    }
    return range;
}
;
export function filterWithRange(range) {
    let { start, end, startClosed, endClosed, } = range;
    let filter = {};
    if (startClosed) {
        filter.gte = start;
    }
    else {
        filter.gt = start;
    }
    if (endClosed) {
        filter.lte = end;
    }
    else {
        filter.lt = end;
    }
    return filter;
}
;
export function mapValueRange(range, map) {
    return {
        start: typeof range.start !== 'undefined' ? map(range.start) : undefined,
        end: typeof range.end !== 'undefined' ? map(range.end) : undefined,
        startClosed: range.startClosed,
        endClosed: range.endClosed,
    };
}
;
/**
 * Create a closed filter from an open filter,
 * preserving any other properties on the object.
 **/
export function closedFilter(filter) {
    // Extract filter
    let { gt, gte, lt, lte, ...otherOptions } = filter;
    let start = gt || gte;
    let end = lt || lte;
    // Reapply filter
    let closedFilter = otherOptions;
    if (typeof start !== 'undefined') {
        closedFilter.gte = start;
    }
    if (typeof end !== 'undefined') {
        closedFilter.lte = end;
    }
    return closedFilter;
}
