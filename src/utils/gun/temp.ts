// Temporary GUN fixes

// PR: Fixed missing Gun.log.once function #961
// https://github.com/amark/gun/pull/961
export const gunLogOnceFix = (Gun: any) => {
    if (typeof Gun !== 'function') {
        throw new Error('Must specify a Gun constructor');
    }
    if (!Gun.log.once) {
        Gun.log.once = function(w: any,s: any,o: any){ return ((o = Gun.log.once) as any)[w] = o[w] || 0, o[w]++ || Gun.log(s) };
    }
};

/** Call in case of user is not defined errors. */
export const fixSea = (Gun: any) => {
    if (typeof Gun !== 'function') {
        throw new Error('Must specify a Gun constructor');
    }
    if (!Gun.SEA && !!require) {
        Gun.SEA = require('gun/sea');
    }
};