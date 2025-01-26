import { ethers } from "ethers";
import { WalletManager } from "./WalletManager";
import {
  MESSAGE_TO_SIGN,
  generatePassword,
  verifySignature,
  getEthereumSigner,
} from "./utils/ethereum";

/**
 * Manages Ethereum wallet functionality and authentication
 */
export class EthereumManager {
  private walletManager: WalletManager;
  private customProvider: ethers.JsonRpcProvider | null = null;
  private customWallet: ethers.Wallet | null = null;

  /**
   * Creates an EthereumManager instance
   * @param {WalletManager} walletManager - Instance of WalletManager
   */
  constructor(walletManager: WalletManager) {
    this.walletManager = walletManager;
  }

  /**
   * Sets a custom provider with private key
   * @param {string} rpcUrl - RPC URL for the provider
   * @param {string} privateKey - Private key for the wallet
   */
  public setCustomProvider(rpcUrl: string, privateKey: string): void {
    this.customProvider = new ethers.JsonRpcProvider(rpcUrl);
    this.customWallet = new ethers.Wallet(privateKey, this.customProvider);
  }

  /**
   * Gets the appropriate signer (custom or browser)
   * @returns {Promise<ethers.Signer>} The Ethereum signer
   */
  public async getSigner(): Promise<ethers.Signer> {
    if (this.customWallet) {
      return this.customWallet;
    }
    return getEthereumSigner();
  }

  /**
   * Creates an account using an Ethereum account
   * @returns {Promise<string>} The created username (Ethereum address)
   * @throws {Error} If account creation fails
   */
  public async createAccountWithEthereum(): Promise<string> {
    try {
      const signer = await this.getSigner();
      const address = await signer.getAddress();

      // Sign message to generate password
      const signature = await signer.signMessage(MESSAGE_TO_SIGN);
      const password = await generatePassword(signature);

      // Use address as username
      const username = address.toLowerCase();

      // Create account
      await this.walletManager.createAccount(username, password);

      return username;
    } catch (error) {
      console.error("Error creating account with Ethereum:", error);
      throw error;
    }
  }

  /**
   * Logs in with an Ethereum account
   * @returns {Promise<string|null>} Public key if login successful, null otherwise
   * @throws {Error} If login fails
   */
  public async loginWithEthereum(): Promise<string | null> {
    try {
      const signer = await this.getSigner();
      const address = await signer.getAddress();

      // Sign message to generate password
      const signature = await signer.signMessage(MESSAGE_TO_SIGN);
      const password = await generatePassword(signature);

      // Use address as username
      const username = address.toLowerCase();

      // Perform login
      return this.walletManager.login(username, password);
    } catch (error) {
      console.error("Error logging in with Ethereum:", error);
      throw error;
    }
  }
}
