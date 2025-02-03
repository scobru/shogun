/**
 * @fileoverview Manages wallet functionality, including authentication and key management
 * @module Shogun
 */

import Gun from "gun";
import "gun/sea";
import { Wallet } from "ethers";
import { EthereumManager } from "./managers/EthereumManager";
import { StealthChain } from "./chains/StealthChain";
import type { GunKeyPair } from "./interfaces/GunKeyPair";
import { WalletResult, WalletData } from "./interfaces/WalletResult";
import { WebAuthnService } from "./services/WebAuthn";
import { EthereumService } from "./services/Ethereum";
import { GunAuthManager } from "./managers/GunAuthManager";
import { ActivityPubManager } from "./managers/ActivityPubManager";
import { WalletManager } from "./managers/WalletManager";
import {
  WebAuthnError,
  NetworkError,
  ValidationError,
  AuthenticationError,
} from "./utils/errors";
import {
  validateAlias,
  validatePrivateKey,
  validateEthereumAddress,
} from "./utils/validation";
import type { ActivityPubKeys } from "./interfaces/ActivityPubKeys";

// Extend Gun type definitions
declare module "gun" {
  interface _GunRoot {
    sea: GunKeyPair;
  }
}

const SEA = Gun.SEA;

/**
 * Main class for managing wallet and related functionality
 */
export class Shogun {
  private gunAuthManager: GunAuthManager;
  private ethereumManager: EthereumManager;
  private stealthChain: StealthChain;
  private webAuthnService: WebAuthnService;
  private ethereumService: EthereumService;
  private activityPubManager: ActivityPubManager;
  private walletManager: WalletManager;

  /**
   * Creates a Shogun instance
   * Initializes Gun, user and managers for Ethereum and StealthChain
   */
  constructor(gunOptions: any, APP_KEY_PAIR: any) {
    this.gunAuthManager = new GunAuthManager(gunOptions, APP_KEY_PAIR);
    this.ethereumManager = new EthereumManager(this);
    this.stealthChain = new StealthChain(this.gunAuthManager);
    this.webAuthnService = new WebAuthnService(this.gunAuthManager);
    this.ethereumService = new EthereumService();
    this.activityPubManager = new ActivityPubManager(this.gunAuthManager);
    this.walletManager = new WalletManager(this.gunAuthManager);
  }

  /**
   * Gets the EthereumManager instance
   */
  public getEthereumManager(): EthereumManager {
    return this.ethereumManager;
  }

  /**
   * Gets the StealthChain instance
   */
  public getStealthChain(): StealthChain {
    return this.stealthChain;
  }

  /**
   * Gets the current user's keyPair
   */
  public getCurrentUserKeyPair(): GunKeyPair {
    return this.gunAuthManager.getCurrentUserKeyPair();
  }

  public getPublicKey(): string {
    return this.gunAuthManager.getPublicKey();
  }

  public async createAccount(alias: string, passphrase: string): Promise<void> {
    if (!validateAlias(alias)) {
      throw new ValidationError("Alias non valido");
    }
    const userPair = await this.gunAuthManager.createAccount(alias, passphrase);
    const walletResult = await Shogun.createWalletObj(userPair);
    const wallet = new Wallet(walletResult.walletObj.privateKey);
    await this.saveWallet(wallet);
  }

  public async login(alias: string, passphrase: string): Promise<string> {
    if (!validateAlias(alias)) {
      throw new ValidationError("Alias non valido");
    }
    return this.gunAuthManager.login(alias, passphrase);
  }

  public logout(): void {
    this.gunAuthManager.logout();
  }

  public async exportGunKeyPair(): Promise<string> {
    return this.gunAuthManager.exportGunKeyPair();
  }

  public async importGunKeyPair(keyPairJson: string): Promise<string> {
    return this.gunAuthManager.importGunKeyPair(keyPairJson);
  }

  public async updateProfile(displayName: string): Promise<void> {
    return this.gunAuthManager.updateProfile(displayName);
  }

  public async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return this.gunAuthManager.changePassword(oldPassword, newPassword);
  }

  

  

  /**
   * Exports all user data as a single JSON
   */
  public async exportAllData(): Promise<string> {
    if (!this.gunAuthManager.getCurrentUserKeyPair()) {
      throw new Error("User not authenticated");
    }

    const wallet = await this.gunAuthManager.getWallet();
    const stealthKeys = await this.stealthChain.retrieveStealthKeysLocally(
      this.gunAuthManager.getPublicKey()
    );

    const exportData = {
      wallet: wallet
        ? {
            address: wallet.address,
            privateKey: wallet.privateKey,
            entropy: (wallet as any).entropy || null,
          }
        : null,
      stealthKeys: stealthKeys,
      gunPair: this.gunAuthManager.getCurrentUserKeyPair(),
      timestamp: Date.now(),
      version: "1.0",
    };

    return JSON.stringify(exportData);
  }

  /**
   * Imports all user data from a JSON export
   */
  public async importAllData(jsonData: string): Promise<void> {
    try {
      const importData = JSON.parse(jsonData);

      // Verify version and structure
      if (!importData.version || !importData.timestamp) {
        throw new Error("Invalid data format");
      }

      // Import Gun pair and authenticate
      if (importData.gunPair) {
        await this.importGunKeyPair(JSON.stringify(importData.gunPair));
      }

      // Save wallet if present
      if (importData.wallet) {
        const wallet = new Wallet(importData.wallet.privateKey);
        if (importData.wallet.entropy) {
          Object.defineProperty(wallet, "entropy", {
            value: importData.wallet.entropy,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }
        await this.saveWallet(wallet);
      }

      // Save stealth keys if present
      if (importData.stealthKeys) {
        await this.stealthChain.saveStealthKeysLocally(
          this.gunAuthManager.getPublicKey(),
          importData.stealthKeys
        );
      }
    } catch (error) {
      throw new Error(
        `Error importing data: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  /**
   * Crea un account utilizzando WebAuthn
   */
  public async createAccountWithWebAuthn(alias: string): Promise<WalletResult> {
    try {
      if (!this.webAuthnService.isSupported()) {
        throw new WebAuthnError("WebAuthn non è supportato su questo browser");
      }

      const webAuthnResult = await this.webAuthnService.generateCredentials(
        alias
      );
      if (!webAuthnResult.success || !webAuthnResult.password) {
        throw new WebAuthnError(
          webAuthnResult.error || "Errore durante la registrazione con WebAuthn"
        );
      }

      await this.createAccount(alias, webAuthnResult.password);
      const walletResult = await Shogun.createWalletObj(this.gunAuthManager.getCurrentUserKeyPair());
      const wallet = new Wallet(walletResult.walletObj.privateKey);
      await this.saveWallet(wallet);

      return walletResult;
    } catch (error) {
      if (error instanceof WebAuthnError) {
        throw error;
      }
      throw new NetworkError(
        `Errore durante la creazione dell'account con WebAuthn: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }

  // ActivityPub methods delegated to ActivityPubManager
  public async getPrivateKey(username: string): Promise<string> {
    return this.activityPubManager.getPrivateKey(username);
  }

  public async saveActivityPubKeys(keys: ActivityPubKeys): Promise<void> {
    return this.gunAuthManager.saveActivityPubKeys(keys);
  }

  public async getActivityPubKeys(): Promise<ActivityPubKeys | null> {
    return this.gunAuthManager.getActivityPubKeys();
  }

  public async deleteActivityPubKeys(): Promise<void> {
    await this.gunAuthManager.savePrivateData(null, 'activityPubKeys');
    await this.gunAuthManager.savePublicData(null, 'activityPubKeys');
  }

  public async signActivityPubData(
    stringToSign: string,
  ): Promise<{ signature: string; }> {
    return this.activityPubManager.signActivityPubData(stringToSign);
  }
}
