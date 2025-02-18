import { ethers } from "ethers";
import { AuthenticationError, ValidationError } from "../../utils/gun/errors";
import { GunStorage } from "../../core/storage/GunStorage";
import { EthereumProvider, GunKeyPair } from "../../types";
import { IGunInstance, ISEAPair } from "gun";

/**
 * JSON-RPC Connector for Ethereum Blockchain Integration
 * 
 * Provides secure Ethereum interaction layer with GunDB storage integration.
 * Handles wallet management, authentication, and cryptographic operations.
 */
export class JsonRpcConnector extends GunStorage<GunKeyPair> {
  /** @internal Storage namespace for Ethereum data */
  protected storagePrefix = "ethereum";
  
  /** @internal Custom JSON-RPC provider instance */
  private customProvider: ethers.JsonRpcProvider | null = null;
  
  /** @internal Wallet instance for custom provider */
  private customWallet: ethers.Wallet | null = null;
  
  /** @internal Fixed message for cryptographic signing */
  private MESSAGE_TO_SIGN = "I Love Shogun!";
  
  /** @internal Operation timeout in milliseconds */
  private readonly OPERATION_TIMEOUT = 60000;

  /**
   * Initialize JSON-RPC connector
   * @param gun - GunDB instance
   * @param APP_KEY_PAIR - SEA cryptographic pair for GunDB
   */
  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
  }

  /**
   * Configure custom JSON-RPC provider
   * @param rpcUrl - RPC endpoint URL
   * @param privateKey - Wallet private key
   * @throws {ValidationError} For invalid parameters
   * @example
   * connector.setCustomProvider("https://mainnet.infura.io/v3/KEY", "0x...");
   */
  public setCustomProvider(rpcUrl: string, privateKey: string): void {
    try {
      if (!rpcUrl || typeof rpcUrl !== "string") {
        throw new ValidationError("RPC URL non valido");
      }
      if (!privateKey || typeof privateKey !== "string") {
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
   * Get active signer instance
   * @returns {Promise<ethers.Signer>} Ethers.js Signer
   * @throws {AuthenticationError} If no signer available
   * @example
   * const signer = await connector.getSigner();
   * const address = await signer.getAddress();
   */
  public async getSigner(): Promise<ethers.Signer> {
    try {
      if (this.customWallet) {
        return this.customWallet;
      }
      const signer = await this.getEthereumSigner();
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
   * Create new Ethereum account
   * @returns {Promise<GunKeyPair>} Generated key pair
   * @throws {AuthenticationError} On authentication failure
   * @throws {Error} On operation timeout
   * @example
   * const account = await connector.createAccount();
   */
  public async createAccount(): Promise<GunKeyPair> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Operation timed out"));
      }, this.OPERATION_TIMEOUT);

      try {
        const signer = await this.getSigner();
        const address = await signer.getAddress();

        if (!address || !address.startsWith("0x")) {
          throw new Error("Invalid Ethereum address");
        }

        const signature = await signer.signMessage(this.MESSAGE_TO_SIGN);
        const password = await this.generatePassword(signature);
        const username = address.toLowerCase();

        let retryCount = 0;
        const maxRetries = 3;

        const attemptCreate = async (): Promise<void> => {
          return new Promise((resolveCreate, rejectCreate) => {
            this.user.create(username, password, async (ack: any) => {
              if (ack.err) {
                if (retryCount < maxRetries) {
                  retryCount++;
                  console.log(`Retry create attempt ${retryCount}/${maxRetries}`);
                  await new Promise(r => setTimeout(r, 2000));
                  return resolveCreate(attemptCreate());
                }
                return rejectCreate(new Error(ack.err));
              }

              try {
                await this.login();
                const pair = this.user._.sea;
                await this.savePrivateData(pair, "ethereum");
                await this.savePublicData({ address }, "ethereum");
                resolveCreate();
              } catch (error) {
                rejectCreate(error);
              }
            });
          });
        };

        await attemptCreate();
        clearTimeout(timeoutId);
        resolve(this.user._.sea);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Authenticate with Ethereum wallet
   * @returns {Promise<string>} Public key of authenticated user
   * @throws {ValidationError} For invalid Ethereum address
   * @throws {AuthenticationError} On auth failure
   * @example
   * const pubKey = await connector.login();
   */
  public async login(): Promise<string> {
    try {
      const signer = await this.getSigner();
      const address = await signer.getAddress();

      if (!address || !address.startsWith("0x")) {
        throw new ValidationError("Indirizzo Ethereum non valido");
      }

      const signature = await signer.signMessage(this.MESSAGE_TO_SIGN);
      const password = await this.generatePassword(signature);
      const username = address.toLowerCase();

      let retryCount = 0;
      const maxRetries = 3;
      
      const attemptLogin = async (): Promise<string> => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error("Login timeout"));
          }, 15000);

          this.user.auth(username, password, async (ack: any) => {
            clearTimeout(timeoutId);
            
            if (ack.err) {
              if (ack.err.includes("Wrong user or password") && retryCount < maxRetries) {
                retryCount++;
                console.log(`Retry login attempt ${retryCount}/${maxRetries}`);
                await new Promise(r => setTimeout(r, 2000));
                return resolve(await attemptLogin());
              }
              reject(new Error(ack.err));
              return;
            }
            
            if (!ack.sea) {
              reject(new Error("Invalid authentication response"));
              return;
            }
            
            resolve(this.user.is?.pub || "");
          });
        });
      };

      return attemptLogin();
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

  /**
   * Generate deterministic password from signature
   * @param signature - Cryptographic signature
   * @returns {Promise<string>} 64-character hex string
   * @throws {Error} For invalid signature
   * @example
   * const password = await connector.generatePassword(signature);
   */
  public async generatePassword(signature: string): Promise<string> {
    if (!signature) {
      throw new Error("Firma non valida");
    }
    const hash = ethers.keccak256(ethers.toUtf8Bytes(signature));
    return hash.slice(2, 66); // Rimuovi 0x e usa i primi 32 bytes
  }

  /**
   * Verify message signature
   * @param message - Original signed message
   * @param signature - Cryptographic signature
   * @returns {Promise<string>} Recovered Ethereum address
   * @throws {Error} For invalid inputs
   * @example
   * const signer = await connector.verifySignature(msg, sig);
   */
  public async verifySignature(
    message: string,
    signature: string
  ): Promise<string> {
    try {
      if (!message || !signature) {
        throw new Error("Messaggio o firma non validi");
      }
      return ethers.verifyMessage(message, signature);
    } catch (error) {
      throw new Error("Messaggio o firma non validi");
    }
  }

  /**
   * Get browser-based Ethereum signer
   * @returns {Promise<ethers.Signer>} Browser provider signer
   * @throws {Error} If MetaMask not detected
   * @example
   * const signer = await connector.getEthereumSigner();
   */
  public async getEthereumSigner(): Promise<ethers.Signer> {
    if (!JsonRpcConnector.isMetaMaskAvailable()) {
      throw new Error(
        "Metamask non trovato. Installa Metamask per continuare."
      );
    }

    try {
      const ethereum = window.ethereum as EthereumProvider;
      await ethereum.request({
        method: "eth_requestAccounts",
      });

      const provider = new ethers.BrowserProvider(ethereum);
      return provider.getSigner();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Errore nell'accesso a MetaMask: ${error.message}`);
      }
      throw new Error("Errore sconosciuto nell'accesso a MetaMask");
    }
  }

  static isMetaMaskAvailable(): boolean {
    const ethereum = window.ethereum as EthereumProvider | undefined;
    return (
      typeof window !== "undefined" &&
      typeof ethereum !== "undefined" &&
      ethereum?.isMetaMask === true
    );
  }
}
