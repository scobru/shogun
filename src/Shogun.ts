/**
 * @fileoverview Manages wallet functionality, including authentication and key management
 * @module Shogun
 */

import Gun from "gun";
import "gun/sea";
import { EthereumManager } from "./managers/EthereumManager";
import { StealthManager } from "./managers/StealthManager";
import type { GunKeyPair } from "./interfaces/GunKeyPair";
import { WebAuthnService } from "./services/WebAuthn";
import { EthereumService } from "./services/Ethereum";
import { GunAuthManager } from "./managers/GunAuthManager";
import { ActivityPubManager } from "./managers/ActivityPubManager";
import { WalletManager } from "./managers/WalletManager";
import { UserKeys } from "./interfaces/UserKeys";
import { Wallet } from "ethers";

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
  private stealthManager: StealthManager;
  private webAuthnService: WebAuthnService;
  private ethereumService: EthereumService;
  private activityPubManager: ActivityPubManager;
  private walletManager: WalletManager;

  constructor(gunOptions: any, APP_KEY_PAIR: any) {
    this.gunAuthManager = new GunAuthManager(gunOptions, APP_KEY_PAIR);
    this.ethereumManager = new EthereumManager(this.gunAuthManager);
    this.stealthManager = new StealthManager(this.gunAuthManager);
    this.walletManager = new WalletManager(this.gunAuthManager);
    this.webAuthnService = new WebAuthnService(this.gunAuthManager);
    this.ethereumService = new EthereumService();
    this.activityPubManager = new ActivityPubManager(this.gunAuthManager);
  }


  public getEthereumManager(): EthereumManager {
    return this.ethereumManager;
  }

  public getStealthChain(): StealthManager {
    return this.stealthManager;
  }

  public getGunAuthManager(): GunAuthManager {
    return this.gunAuthManager;
  }

  public getEthereumService(): EthereumService {
    return this.ethereumService;
  }

  public getActivityPubManager(): ActivityPubManager {
    return this.activityPubManager;
  }

  public getWalletManager(): WalletManager {
    return this.walletManager;
  }

  public getWebAuthnService(): WebAuthnService {
    return this.webAuthnService;
  }

  // crea una funzione create dove vai a creare 1 utente gun, 2 wallet, 3 stealthkey, 4 activitypubkey
  public async createUser(alias: string, password: string): Promise<UserKeys> {
    const pair = await this.gunAuthManager.createAccount(alias, password);
    const wallet = await this.walletManager.getWallet();
    const stealthKey = await this.stealthManager.generateStealthKeys();
    const activityPubKey =
      await this.activityPubManager.generateActivityPubKeys();

    return {
      pair,
      wallet,
      stealthKey,
      activityPubKey,
    };
  }

  // funzione che recupera i vari dati dell'utente dal database
  public async getUser(alias: string): Promise<UserKeys> {
    const user = await this.gunAuthManager.getUser();
    const pair = user.pair();
    const wallet = await this.walletManager.getWallet();
    const stealthKey = await this.stealthManager.getStealthKeys();
    const activityPubKey = await this.activityPubManager.getActivityPubKeys();

    return {
      pair,
      wallet,
      stealthKey,
      activityPubKey,
    };
  }
}
