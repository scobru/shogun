import { ethers } from "ethers";
import { WalletManager } from "./WalletManager";
import { MESSAGE_TO_SIGN } from "./services/ethereum";
import { EthereumService } from "./services/ethereum";
import { AuthenticationError, ValidationError } from "./utils/errors";

/**
 * Manages Ethereum wallet functionality and authentication
 */
export class EthereumManager {
  private walletManager: WalletManager;
  private customProvider: ethers.JsonRpcProvider | null = null;
  private customWallet: ethers.Wallet | null = null;
  private ethereumService: EthereumService;

  /**
   * Creates an EthereumManager instance
   * @param {WalletManager} walletManager - Instance of WalletManager
   */
  constructor(walletManager: WalletManager) {
    this.walletManager = walletManager;
    this.ethereumService = new EthereumService();
  }

  /**
   * Sets a custom provider with private key
   * @param {string} rpcUrl - RPC URL for the provider
   * @param {string} privateKey - Private key for the wallet
   * @throws {ValidationError} Se la chiave privata non è valida
   */
  public setCustomProvider(rpcUrl: string, privateKey: string): void {
    try {
      this.customProvider = new ethers.JsonRpcProvider(rpcUrl);
      this.customWallet = new ethers.Wallet(privateKey, this.customProvider);
    } catch (error) {
      throw new ValidationError("Chiave privata non valida");
    }
  }

  /**
   * Gets the appropriate signer (custom or browser)
   * @returns {Promise<ethers.Signer>} The Ethereum signer
   * @throws {AuthenticationError} Se non è possibile ottenere il signer
   */
  public async getSigner(): Promise<ethers.Signer> {
    try {
      if (this.customWallet) {
        return this.customWallet;
      }
      return await this.ethereumService.getEthereumSigner();
    } catch (error) {
      throw new AuthenticationError("Impossibile ottenere il signer Ethereum");
    }
  }

  /**
   * Creates an account using an Ethereum account
   * @returns {Promise<string>} The created username (Ethereum address)
   * @throws {AuthenticationError} Se la creazione dell'account fallisce
   */
  public async createAccountWithEthereum(): Promise<string> {
    try {
      const signer = await this.getSigner();
      const address = await signer.getAddress();

      // Sign message to generate password
      const signature = await signer.signMessage(MESSAGE_TO_SIGN);
      const password = await this.ethereumService.generatePassword(signature);

      // Use address as username
      const username = address.toLowerCase();

      // Create account
      await this.walletManager.createAccount(username, password);

      return username;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError(
        `Errore durante la creazione dell'account Ethereum: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }

  /**
   * Logs in with an Ethereum account
   * @returns {Promise<string|null>} Public key if login successful, null otherwise
   * @throws {AuthenticationError} Se il login fallisce
   */
  public async loginWithEthereum(): Promise<string | null> {
    try {
      const signer = await this.getSigner();
      const address = await signer.getAddress();

      // Sign message to generate password
      const signature = await signer.signMessage(MESSAGE_TO_SIGN);
      const password = await this.ethereumService.generatePassword(signature);

      // Use address as username
      const username = address.toLowerCase();

      // Perform login
      return this.walletManager.login(username, password);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError(
        `Errore durante il login con Ethereum: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }
}
