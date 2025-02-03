import { ethers } from "ethers";
import { Shogun } from "../Shogun";
import { MESSAGE_TO_SIGN } from "../services/Ethereum";
import { EthereumService } from "../services/Ethereum";
import { AuthenticationError, ValidationError } from "../utils/errors";
import { GunAuthManager } from "./GunAuthManager";

/**
 * Manages Ethereum wallet functionality and authentication
 */
export class EthereumManager {
  private gunAuthManager: GunAuthManager;
  private customProvider: ethers.JsonRpcProvider | null = null;
  private customWallet: ethers.Wallet | null = null;
  private ethereumService: EthereumService;

  constructor(gunAuthManager: GunAuthManager) {
    this.gunAuthManager = gunAuthManager;
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
      if (!rpcUrl || typeof rpcUrl !== 'string') {
        throw new ValidationError("RPC URL non valido");
      }
      if (!privateKey || typeof privateKey !== 'string') {
        throw new ValidationError("Chiave privata non valida");
      }

      this.customProvider = new ethers.JsonRpcProvider(rpcUrl);
      this.customWallet = new ethers.Wallet(privateKey, this.customProvider);
    } catch (error) {
      throw new ValidationError(
        `Errore nella configurazione del provider: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
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
      const signer = await this.ethereumService.getEthereumSigner();
      if (!signer) {
        throw new AuthenticationError("Nessun signer Ethereum disponibile");
      }
      return signer;
    } catch (error) {
      throw new AuthenticationError(
        `Impossibile ottenere il signer Ethereum: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
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

      if (!address || !address.startsWith("0x")) {
        throw new ValidationError("Indirizzo Ethereum non valido");
      }

      const signature = await signer.signMessage(MESSAGE_TO_SIGN);
      const password = await this.ethereumService.generatePassword(signature);

      const username = address.toLowerCase();
      await this.gunAuthManager.createAccount(username, password);

      return username;
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
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
  public async loginWithEthereum(): Promise<string> {
    try {
      const signer = await this.getSigner();
      const address = await signer.getAddress();

      if (!address || !address.startsWith("0x")) {
        throw new ValidationError("Indirizzo Ethereum non valido");
      }

      const signature = await signer.signMessage(MESSAGE_TO_SIGN);
      const password = await this.ethereumService.generatePassword(signature);

      const username = address.toLowerCase();
      const result = await this.gunAuthManager.login(username, password);
      
      if (!result) {
        throw new AuthenticationError("Login fallito");
      }

      return result;
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
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
