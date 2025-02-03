import { ethers } from "ethers";
import { MESSAGE_TO_SIGN } from "../services/Ethereum";
import { EthereumService } from "../services/Ethereum";
import { AuthenticationError, ValidationError } from "../utils/errors";
import { GunAuthManager } from "./GunAuthManager";

export class EthereumManager {
  private gunAuthManager: GunAuthManager;
  private customProvider: ethers.JsonRpcProvider | null = null;
  private customWallet: ethers.Wallet | null = null;
  private ethereumService: EthereumService;

  constructor(gunAuthManager: GunAuthManager) {
    this.gunAuthManager = gunAuthManager;
    this.ethereumService = new EthereumService();
  }

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

  
  public async createAccount(): Promise<string> {
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

  public async login(): Promise<string> {
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
