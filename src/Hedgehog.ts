import type { Wallet } from "ethers";
import { waitUntil } from "./utils";

export class Hedgehog {
  protected wallet: Wallet | null = null;
  protected ready: boolean = false;

  constructor() {
    this.ready = true;
  }

  /**
   * Helper function to check if Hedgehog instance is ready.
   */
  isReady() {
    return this.ready;
  }

  /**
   * Helper function to wait until Hedgehog instance is ready.
   */
  async waitUntilReady() {
    await waitUntil(() => this.isReady());
  }

  /**
   * Returns if the user has a client side wallet.
   * @returns true if the user has a client side wallet, false otherwise
   */
  isLoggedIn() {
    return !!this.wallet;
  }

  /**
   * Returns the current user wallet
   * @returns ethereumjs-wallet wallet object if a wallet exists, otherwise null
   */
  getWallet() {
    return this.wallet;
  }
}
