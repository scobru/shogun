import { IGunInstance, ISEAPair } from "gun";
import { WalletData, MnemonicData } from "../../types/WalletResult";
import { ethers, Wallet, HDNodeWallet } from "ethers";
import { GunStorage } from "../../core/storage/GunStorage";

interface ExtendedWallet extends Wallet {
  entropy: string;
  index: number;
  timestamp: number;
}

interface StoredWalletData {
  encryptedJson: string;
  index?: number;
  timestamp?: number;
}

interface WalletMetadata {
  index: number;
  timestamp: number;
}

interface EncryptedWalletData extends StoredWalletData {
  encryptedJson: string;
  index: number;
  timestamp: number;
}

interface EncryptedHDWalletData extends StoredWalletData {
  mnemonic: string;
}

interface AddressMetadata {
  index: number;
  timestamp: number;
}

interface AddressesMap {
  [address: string]: AddressMetadata;
}

interface StoredAddressesMap {
  addresses: AddressesMap;
}

export class EthereumHDKeyVault extends GunStorage<StoredWalletData> {
  protected storagePrefix = "wallets";
  private masterWallet?: HDNodeWallet;
  private static readonly MASTER_WALLET_PATH = "hd_master_wallet";
  private static readonly ACCOUNTS_PATH = "hd_accounts";
  private static readonly BASE_PATH = "m/44'/60'/0'/0";

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
    // Non usiamo APP_KEY_PAIR per la crittografia
  }

  /**
   * Restituisce la chiave di crittografia derivata dalla chiave privata dell'utente Gun.
   * Assicurati che l'utente sia autenticato (this.user._.sea.priv sia disponibile).
   */
  private getEncryptionPassword(): string {
    if (!this.user || !this.user._.sea || !this.user._.sea.priv) {
      throw new Error("Utente non autenticato o chiave privata non trovata");
    }
    return this.user._.sea.priv.slice(0, 32);
  }

  private async getMasterWallet(): Promise<HDNodeWallet> {
    if (this.masterWallet) return this.masterWallet;

    try {
      const encryptedData = await this.getPrivateData(EthereumHDKeyVault.MASTER_WALLET_PATH) as EncryptedHDWalletData | null;

      if (encryptedData?.mnemonic) {
        // Creiamo il nodo master direttamente dalla mnemonic
        const node = ethers.HDNodeWallet.fromMnemonic(
          ethers.Mnemonic.fromPhrase(encryptedData.mnemonic),
          `m`
        );
        this.masterWallet = node;
      } else {
        // Creiamo un nuovo nodo master con una nuova mnemonic
        const mnemonic = ethers.Mnemonic.fromEntropy(ethers.randomBytes(16));
        const node = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m`);
        this.masterWallet = node;

        // Salviamo il nodo master
        const encryptedJson = await this.masterWallet.encrypt(this.getEncryptionPassword());
        await this.savePrivateDataWithRetry(
          {
            encryptedJson,
            mnemonic: mnemonic.phrase,
            timestamp: Date.now()
          },
          EthereumHDKeyVault.MASTER_WALLET_PATH,
          10 // Aumentiamo i tentativi per il master wallet
        );
      }

      // Verifica finale che il wallet sia un nodo root
      if (this.masterWallet.depth !== 0) {
        throw new Error("Il master wallet non è un nodo root dopo l'inizializzazione");
      }

      return this.masterWallet;
    } catch (error) {
      console.error("Errore in getMasterWallet:", error);
      throw error;
    }
  }

  private async deriveWallet(index: number): Promise<Wallet> {
    const master = await this.getMasterWallet();

    try {
      if (master.depth !== 0) {
        throw new Error("Il nodo master deve essere il nodo root (depth 0)");
      }

      const fullPath = `${EthereumHDKeyVault.BASE_PATH}/${index}`;
      const derived = master.derivePath(fullPath);

      return new Wallet(derived.privateKey);
    } catch (error) {
      console.error(`Errore nella derivazione del wallet all'indice ${index}:`, error);
      throw new Error(`Impossibile derivare il wallet all'indice ${index}: ${error.message}`);
    }
  }

  private async getNextAccountIndex(): Promise<number> {
    await this.ensureAuthenticated();

    const accounts = (await this.getPrivateData(EthereumHDKeyVault.ACCOUNTS_PATH) as unknown as AddressesMap) || {};
    const indices = Object.values(accounts).map(meta => meta.index);

    if (indices.length === 0) return 0;
    return Math.max(...indices) + 1;
  }

  public async createAccount(): Promise<WalletData> {
    await this.ensureAuthenticated();

    const index = await this.getNextAccountIndex();
    const wallet = await this.deriveWallet(index);

    const encryptedJson = await wallet.encrypt(this.getEncryptionPassword());
    const data: EncryptedWalletData = {
      encryptedJson,
      index,
      timestamp: Date.now()
    };

    await this.saveWalletMetadata(data);
    await this.savePrivateDataWithRetry(data, `${this.storagePrefix}/${wallet.address.toLowerCase()}`);

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      entropy: `${EthereumHDKeyVault.BASE_PATH}/${index}`,
      index,
      timestamp: data.timestamp
    };
  }

  private async saveWalletMetadata(data: EncryptedWalletData): Promise<void> {
    try {
      const wallet = await Wallet.fromEncryptedJson(data.encryptedJson, this.getEncryptionPassword());
      const address = wallet.address.toLowerCase();

      // Salviamo il wallet completo con i suoi metadati
      await this.savePrivateDataWithRetry(
        data,
        `${this.storagePrefix}/${address}`,
        5
      );

      // Aggiorniamo la mappa degli indirizzi
      const addressesPath = `${EthereumHDKeyVault.ACCOUNTS_PATH}/addresses`;
      const rawAddresses = await this.getPrivateData(addressesPath);
      const existingAddresses: StoredAddressesMap = (rawAddresses as unknown as StoredAddressesMap) || { addresses: {} };

      if (!existingAddresses.addresses) {
        existingAddresses.addresses = {};
      }

      existingAddresses.addresses[address] = {
        index: data.index,
        timestamp: data.timestamp
      };

      // Salviamo la mappa aggiornata degli indirizzi
      await this.savePrivateDataWithRetry(
        existingAddresses,
        addressesPath,
        5
      );

      // Salviamo anche nel percorso degli account HD
      await this.savePrivateDataWithRetry(
        data,
        `${EthereumHDKeyVault.ACCOUNTS_PATH}/${address}`,
        5
      );
    } catch (error) {
      console.error("Error saving wallet metadata:", error);
      throw error;
    }
  }

  private async savePrivateDataWithRetry(
    data: any,
    path: string,
    maxRetries: number = 5,
    forceNewObject: boolean = false
  ): Promise<void> {

    await this.ensureAuthenticated();

    // Se richiesto, creiamo una copia pulita dell'oggetto
    const dataToSave = forceNewObject ? JSON.parse(JSON.stringify(data)) : data;

    
    await this.savePrivateData(dataToSave, path).catch((error) => {
      console.error("Error saving private data:", error);
      throw error;
    }).then(() => {
      console.log("Data saved successfully");
    });


  }



  private areObjectsEquivalent(obj1: any, obj2: any): boolean {
    // Ignora i riferimenti Gun
    if (obj1?.['#'] || obj2?.['#']) {
      return true;
    }

    // Se uno dei due è null o undefined, confronta direttamente
    if (obj1 == null || obj2 == null) {
      return obj1 === obj2;
    }

    // Se non sono oggetti, confronta direttamente
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
      return obj1 === obj2;
    }

    // Se sono array, controlla la lunghezza e ogni elemento
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (obj1.length !== obj2.length) return false;
      return obj1.every((item, index) => this.areObjectsEquivalent(item, obj2[index]));
    }

    // Se sono oggetti, confronta le chiavi e i valori
    const keys1 = Object.keys(obj1).filter(k => k !== '#').sort();
    const keys2 = Object.keys(obj2).filter(k => k !== '#').sort();

    if (keys1.length !== keys2.length) return false;
    if (!keys1.every((key, index) => key === keys2[index])) return false;

    return keys1.every(key => this.areObjectsEquivalent(obj1[key], obj2[key]));
  }

  public async getWallets(): Promise<ExtendedWallet[]> {
    await this.ensureAuthenticated();

    try {
      const addressesPath = `${EthereumHDKeyVault.ACCOUNTS_PATH}/addresses`;
      const rawAddresses = await this.getPrivateData(addressesPath);

      if (!rawAddresses || typeof rawAddresses !== 'object') {
        console.log('No addresses found in storage');
        return [];
      }

      const storedAddresses = rawAddresses as unknown as StoredAddressesMap;
      if (!storedAddresses.addresses) {
        console.log('No addresses map found in storage');
        return [];
      }

      const wallets: ExtendedWallet[] = [];

      for (const [address, metadata] of Object.entries(storedAddresses.addresses)) {
        try {
          if (!metadata || !metadata.index) {
            console.log(`Skipping invalid metadata for address ${address}`);
            continue;
          }

          const walletData = await this.getPrivateData(`${EthereumHDKeyVault.ACCOUNTS_PATH}/${address}`);
          if (!walletData?.encryptedJson) {
            console.log(`No encrypted data found for address ${address}`);
            continue;
          }

          const wallet = await Wallet.fromEncryptedJson(
            walletData.encryptedJson,
            this.getEncryptionPassword()
          );

          const extendedWallet = {
            ...wallet,
            entropy: `${EthereumHDKeyVault.BASE_PATH}/${metadata.index}`,
            index: metadata.index,
            timestamp: metadata.timestamp || Date.now()
          } as ExtendedWallet;

          wallets.push(extendedWallet);
          console.log(`Successfully loaded wallet for address ${address} with index ${metadata.index}`);
        } catch (error) {
          console.error(`Error loading wallet ${address}:`, error);
          continue;
        }
      }

      return wallets.sort((a, b) => a.index - b.index);
    } catch (error) {
      console.error("Error getting wallets:", error);
      throw error;
    }
  }

  public async getWalletByAddress(address: string): Promise<Wallet | null> {
    try {
      const walletData = await this.getPrivateData(`${EthereumHDKeyVault.ACCOUNTS_PATH}/${address.toLowerCase()}`) as EncryptedWalletData;
      if (!walletData) return null;

      const wallet = await Wallet.fromEncryptedJson(
        walletData.encryptedJson,
        this.getEncryptionPassword()
      );

      return new Wallet(wallet.privateKey);
    } catch (error) {
      console.error(`Error decrypting wallet ${address}:`, error);
      return null;
    }
  }

  public async getWalletByIndex(index: number): Promise<Wallet> {
    return this.deriveWallet(index);
  }

  /**
   * Metodo aggiunto per supportare la vecchia logica legacy.
   * Restituisce un wallet Ethereum basato sulla chiave privata legacy di Gun
   * (disponibile in this.user._.sea.epriv).
   */
  public async getLegacyWallet(): Promise<Wallet> {
    await this.ensureAuthenticated();
    if (!this.user._.sea || !this.user._.sea.epriv) {
      throw new Error("Chiave privata legacy non disponibile");
    }
    const gunLegacyKey = this.user._.sea.epriv;
    const ethPrivateKey = this.convertToEthPk(gunLegacyKey);
    return new Wallet(ethPrivateKey);
  }

  /**
   * Metodo aggiunto per supportare la vecchia logica.
   * Restituisce il primo wallet HD disponibile.
   */
  public async getWallet(): Promise<Wallet> {
    await this.ensureAuthenticated();
    const wallets = await this.getWallets();
    if (wallets.length === 0) {
      throw new Error("Nessun wallet HD trovato");
    }
    return new Wallet(wallets[0].privateKey);
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.user || !this.user.is) {
      throw new Error("Utente non autenticato");
    }

    if (!this.user._.sea) {
      throw new Error("Chiavi SEA non trovate");
    }
  }

  public convertToEthPk(gunPrivateKey: string): string {
    if (!gunPrivateKey || typeof gunPrivateKey !== "string") {
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
      delete accounts[address.toLowerCase()];
      await this.savePrivateDataWithRetry(accounts, EthereumHDKeyVault.ACCOUNTS_PATH);
    } catch (error) {
      console.error("Error deleting wallet:", error);
      throw error;
    }
  }
}
