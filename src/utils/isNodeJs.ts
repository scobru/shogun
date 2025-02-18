
/**
 * Check if the code is running in Node.js
 * @returns {any} - The crypto module
 */

export function checkIsNode() : any {
    let cryptoModule

    try {
        if (typeof window === "undefined") {
            cryptoModule = require("crypto");
        }
    } catch {
        cryptoModule = null;
    }
    return cryptoModule
}
