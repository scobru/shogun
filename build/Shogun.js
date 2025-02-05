/**
 * @fileoverview Manages wallet functionality, including authentication and key management
 * @module Shogun
 */
import Gun from "gun";
import "gun/sea";
import { EthereumManager } from "./managers/EthereumManager";
import { StealthManager } from "./managers/StealthManager";
import { GunAuthManager } from "./managers/GunAuthManager";
import { ActivityPubManager } from "./managers/ActivityPubManager";
import { WebAuthnManager } from "./managers/WebAuthnManager";
import { WalletManager } from "./managers/WalletManager";
const SEA = Gun.SEA;
/**
 * Main class for managing wallet and related functionality
 */
export class Shogun {
    constructor(gun, APP_KEY_PAIR) {
        this.gunAuthManager = new GunAuthManager(gun, APP_KEY_PAIR);
        this.ethereumManager = new EthereumManager(gun, APP_KEY_PAIR);
        this.stealthManager = new StealthManager(gun, APP_KEY_PAIR);
        this.walletManager = new WalletManager(gun, APP_KEY_PAIR);
        this.webAuthnManager = new WebAuthnManager(gun, APP_KEY_PAIR);
        this.activityPubManager = new ActivityPubManager(gun, APP_KEY_PAIR);
    }
    /**
     * Returns the EthereumManager instance
     * @returns {EthereumManager} The EthereumManager instance
     */
    getEthereumManager() {
        return this.ethereumManager;
    }
    /**
     * Returns the StealthManager instance
     * @returns {StealthManager} The StealthManager instance
     */
    getStealthChain() {
        return this.stealthManager;
    }
    /**
     * Returns the GunAuthManager instance
     * @returns {GunAuthManager} The GunAuthManager instance
     */
    getGunAuthManager() {
        return this.gunAuthManager;
    }
    /**
     * Returns the WebAthnManager instance
     * @returns {WebAuthnManager} The WebAuthnManager instance
     */
    getWebAuthnManager() {
        return this.webAuthnManager;
    }
    /**
     * Returns the ActivityPubManager instance
     * @returns {ActivityPubManager} The ActivityPubManager instance
     */
    getActivityPubManager() {
        return this.activityPubManager;
    }
    /**
     * Returns the WalletManager instance
     * @returns {WalletManager} The WalletManager instance
     */
    getWalletManager() {
        return this.walletManager;
    }
    /**
     * Creates a user with a Gun account, wallet, stealth key, and ActivityPub key
     * @param {string} alias - The alias for the user
     * @param {string} password - The password for the user
     * @returns {Promise<UserKeys>} The created user keys
     */
    async createUser(alias, password) {
        const pair = await this.gunAuthManager.createAccount(alias, password);
        const wallet = await this.walletManager.getWallet();
        const stealthKey = await this.stealthManager.createAccount();
        const activityPubKey = await this.activityPubManager.createAccount();
        return {
            pair,
            wallet,
            stealthKey,
            activityPubKey,
        };
    }
    /**
     * Retrieves user data from the database
     * @param {string} alias - The alias of the user
     * @returns {Promise<UserKeys>} The user keys
     */
    async getUser(alias) {
        const user = await this.gunAuthManager.getUser();
        const pair = user.pair();
        const wallet = await this.walletManager.getWallet();
        const stealthKey = await this.stealthManager.getPair();
        const activityPubKey = await this.activityPubManager.getKeys();
        return {
            pair,
            wallet,
            stealthKey,
            activityPubKey,
        };
    }
    /**
     * Retrieves the stealth key pair
     * @returns {Promise<StealthKeyPair>} The stealth key pair
     */
    async getStealthKeyPair() {
        const stealthKey = await this.stealthManager.getPair();
        return stealthKey;
    }
}
