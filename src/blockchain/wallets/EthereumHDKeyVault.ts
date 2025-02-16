import { IGunInstance, ISEAPair, SEA } from "gun";
import { WalletData, MnemonicData } from "../../types/WalletResult";
import { ethers, Wallet, HDNodeWallet, Mnemonic } from "ethers";
import { GunStorage } from "../../core/storage/GunStorage";

interface ExtendedWallet extends Wallet {
  entropy: string;
  index: number;
  timestamp: number;
}

export class EthereumHDKeyVault extends GunStorage<WalletData> {
  protected storagePrefix = "wallets";
  private hdNode?: HDNodeWallet;
  private static readonly MNEMONIC_PATH = 'hd_mnemonic';
  private static readonly ACCOUNTS_PATH = 'hd_accounts';

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
  }

  private async getHdRoot(password?: string): Promise<HDNodeWallet> {
    if (this.hdNode) return this.hdNode;

    try {
      const rawData = await this.getPrivateData(EthereumHDKeyVault.MNEMONIC_PATH);
      const savedMnemonic = rawData as unknown as MnemonicData;
      let phrase: string;

      if (savedMnemonic?.phrase) {
        if (!Mnemonic.isValidMnemonic(savedMnemonic.phrase)) {
          throw new Error("Invalid saved mnemonic");
        }
        phrase = savedMnemonic.phrase;
      } else {
        const entropy = ethers.randomBytes(16);
        const mnemonic = Mnemonic.fromEntropy(entropy, password, ethers.wordlists.en);
        phrase = mnemonic.phrase;
        
        const mnemonicData: MnemonicData = {
          phrase: phrase,
          timestamp: Date.now()
        };
        
        await this.savePrivateDataWithRetry(mnemonicData, EthereumHDKeyVault.MNEMONIC_PATH);
      }
      
      // Ottieni il nodo master (root) a partire dalla seed phrase, specificando "m"
      const master = HDNodeWallet.fromPhrase(phrase, "m");
      // Deriva il nodo base per gli account Ethereum: "m/44'/60'/0'/0"
      this.hdNode = master.derivePath("m/44'/60'/0'/0");
      return this.hdNode;
    } catch (error) {
      console.error("Error in getHdRoot:", error);
      throw error;
    }
  }

  private deriveHDPath(root: HDNodeWallet, index: number): HDNodeWallet {
    try {
      // Deriva il nodo utilizzando un percorso relativo (non iniziare con "m")
      return root.derivePath(`${index}`);
    } catch (error) {
      console.error("Error deriving HD path:", error);
      throw error;
    }
  }

  private async verifyGunPassword(password: string): Promise<boolean> {
    if (!this.user.is) {
      throw new Error("Utente non autenticato");
    }

    try {
      const pair: ISEAPair = {
        pub: this.user.is.pub,
        epub: this.user.is.epub,
        priv: '',
        epriv: ''
      };

      const proof = await SEA.work(password, pair);
      const userAuth = (this.user.is as any).auth;

      if (!userAuth || typeof userAuth !== 'string') {
        return false;
      }

      const decrypted = await SEA.decrypt(userAuth, proof as string);
      return !!decrypted;
    } catch (error) {
      console.error("Errore nella verifica della password:", error);
      return false;
    }
  }

  public async createAccount(password?: string): Promise<WalletData> {
    await this.ensureAuthenticated();
    
    try {
      const root = await this.getHdRoot(password);
      const index = await this.getNextAccountIndex();
      
      // Deriva il wallet all'indice specificato dal nodo base
      const hdWallet = this.deriveHDPath(root, index);
      
      const walletData: WalletData = {
        address: hdWallet.address,
        privateKey: hdWallet.privateKey,
        entropy: `m/44'/60'/0'/0/${index}`,
        index: index,
        timestamp: Date.now()
      };
      
      // Salva i dati dell'account
      const accounts = (await this.getPrivateData(EthereumHDKeyVault.ACCOUNTS_PATH)) || {};
      accounts[walletData.address.toLowerCase()] = walletData;
      await this.savePrivateDataWithRetry(accounts, EthereumHDKeyVault.ACCOUNTS_PATH);
      
      return walletData;
    } catch (error) {
      console.error("Error creating account:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to create account");
    }
  }

  public async getWallets(): Promise<ExtendedWallet[]> {
    await this.ensureAuthenticated();

    try {
      const root = await this.getHdRoot();
      const accounts = (await this.getPrivateData(EthereumHDKeyVault.ACCOUNTS_PATH)) || {};

      return Object.values(accounts).map((a: any) => {
        const hdWallet = this.deriveHDPath(root, a.index);
        return this.extendWallet(hdWallet, a.index, a.timestamp);
      });
    } catch (error) {
      console.error("Error getting wallets:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to retrieve wallets");
    }
  }

  public async getLegacyWallet(): Promise<Wallet> {
    await this.ensureAuthenticated();
    const pk = this.convertToEthPk(this.user._.sea.epriv);
    return new Wallet(pk);
  }

  public async getWallet(): Promise<Wallet> {
    await this.ensureAuthenticated();
    const root = await this.getHdRoot();
    const hdWallet = this.deriveHDPath(root, 0);
    return new Wallet(hdWallet.privateKey);
  }

  public async getWalletByAddress(address: string): Promise<Wallet | null> {
    const wallets = await this.getWallets();
    const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    return wallet || null;
  }

  public async getWalletByIndex(index: number): Promise<Wallet> {
    const root = await this.getHdRoot();
    const hdWallet = this.deriveHDPath(root, index);
    return new Wallet(hdWallet.privateKey);
  }

  private async getNextAccountIndex(): Promise<number> {
    const accounts = (await this.getPrivateData(EthereumHDKeyVault.ACCOUNTS_PATH)) || {};
    return Object.keys(accounts).length;
  }

  private extendWallet(wallet: HDNodeWallet, index: number, timestamp: number): ExtendedWallet {
    const baseWallet = new Wallet(wallet.privateKey);
    return {
      ...baseWallet,
      entropy: `m/44'/60'/0'/0/${index}`,
      index,
      timestamp
    } as ExtendedWallet;
  }

  private async saveWalletMetadata(data: WalletData): Promise<void> {
    const accounts = (await this.getPrivateData(EthereumHDKeyVault.ACCOUNTS_PATH)) || {};
    accounts[data.address] = data;
    await this.savePrivateDataWithRetry(accounts, EthereumHDKeyVault.ACCOUNTS_PATH);
  }

  private async savePrivateDataWithRetry(
    data: any,
    path: string,
    maxRetries: number = 3
  ): Promise<void> {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.savePrivateData(data, path);
        const saved = await this.getPrivateData(path);
        if (saved) return;
      } catch (error) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    throw lastError || new Error(`Failed to save data after ${maxRetries} attempts`);
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }
  }

  public convertToEthPk(gunPrivateKey: string): string {
    if (!gunPrivateKey || typeof gunPrivateKey !== 'string') {
      throw new Error("Chiave privata Gun non valida");
    }

    const hash = ethers.keccak256(ethers.toUtf8Bytes(gunPrivateKey));

    try {
      new Wallet(hash);
      return hash;
    } catch (error) {
      throw new Error("Impossibile generare una chiave privata Ethereum valida");
    }
  }

  public async deleteWallet(address: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const accounts = (await this.getPrivateData(EthereumHDKeyVault.ACCOUNTS_PATH)) || {};
      delete accounts[address];
      await this.savePrivateDataWithRetry(accounts, EthereumHDKeyVault.ACCOUNTS_PATH);
    } catch (error) {
      console.error("Error deleting wallet:", error);
      throw error;
    }
  }
}
