/**
 * @fileoverview Manages wallet functionality, including authentication and key management
 * @module Shogun
 */
import { IGunInstance } from "gun";
import "gun/sea";
import { EthereumManager } from "./managers/EthereumManager";
import { StealthManager } from "./managers/StealthManager";
import type { GunKeyPair } from "./interfaces/GunKeyPair";
import { GunAuthManager } from "./managers/GunAuthManager";
import { ActivityPubManager } from "./managers/ActivityPubManager";
import { WebAuthnManager } from "./managers/WebAuthnManager";
import { WalletManager } from "./managers/WalletManager";
import { UserKeys } from "./interfaces/UserKeys";
import { StealthKeyPair } from "./interfaces/StealthKeyPair";
declare module "gun" {
    interface _GunRoot {
        sea: GunKeyPair;
    }
}
/**
 * Main class for managing wallet and related functionality
 */
export declare class Shogun {
    private gunAuthManager;
    private ethereumManager;
    private stealthManager;
    private activityPubManager;
    private walletManager;
    private webAuthnManager;
    constructor(gun: IGunInstance, APP_KEY_PAIR: any);
    /**
     * Returns the EthereumManager instance
     * @returns {EthereumManager} The EthereumManager instance
     */
    getEthereumManager(): EthereumManager;
    /**
     * Returns the StealthManager instance
     * @returns {StealthManager} The StealthManager instance
     */
    getStealthChain(): StealthManager;
    /**
     * Returns the GunAuthManager instance
     * @returns {GunAuthManager} The GunAuthManager instance
     */
    getGunAuthManager(): GunAuthManager;
    /**
     * Returns the WebAthnManager instance
     * @returns {WebAuthnManager} The WebAuthnManager instance
     */
    getWebAuthnManager(): WebAuthnManager;
    /**
     * Returns the ActivityPubManager instance
     * @returns {ActivityPubManager} The ActivityPubManager instance
     */
    getActivityPubManager(): ActivityPubManager;
    /**
     * Returns the WalletManager instance
     * @returns {WalletManager} The WalletManager instance
     */
    getWalletManager(): WalletManager;
    /**
     * Creates a user with a Gun account, wallet, stealth key, and ActivityPub key
     * @param {string} alias - The alias for the user
     * @param {string} password - The password for the user
     * @returns {Promise<UserKeys>} The created user keys
     */
    createUser(alias: string, password: string): Promise<UserKeys>;
    /**
     * Retrieves user data from the database
     * @param {string} alias - The alias of the user
     * @returns {Promise<UserKeys>} The user keys
     */
    getUser(alias: string): Promise<UserKeys>;
    /**
     * Retrieves the stealth key pair
     * @returns {Promise<StealthKeyPair>} The stealth key pair
     */
    getStealthKeyPair(): Promise<StealthKeyPair>;
}
