import { WalletData } from "../../types/WalletResult";
import { ethers, Wallet,  } from "ethers";
import { GunStorage } from "../../core/storage/GunStorage";

// Importiamo SEA direttamente per accedere all'API di pair
import { IGunInstance } from "gun";
import { ISEAPair } from "gun";

interface ExtendedWallet extends Wallet {
  index: number;
  timestamp: number;
  entropy?: string;
}

interface StoredWalletData {
  encryptedJson: string;
  index?: number;
  timestamp?: number;
  addresses?: { [key: string]: AddressMetadata };
}

interface AddressMetadata {
  index: number;
  timestamp: number;
}

interface EncryptedWalletData extends StoredWalletData {
  encryptedJson: string;
  index: number;
  timestamp: number;
}

interface SeedData {
  seed: string;
}

export class EthereumHDKeyVault extends GunStorage<StoredWalletData | SeedData> {
  protected storagePrefix = "wallets";
  private static readonly ACCOUNTS_PATH = "sea_accounts";

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
  }

  /**
   * Restituisce la chiave di crittografia derivata dalla chiave privata dell'utente Gun.
   */
  private getEncryptionPassword(): string {
    if (!this.user || !this.user.is ) {
      throw new Error("Utente non autenticato o chiave privata non trovata");
    }
    return this.user._.sea.priv.slice(0, 32);
  }


  /**
   * Genera un wallet deterministico basato sul seed principale e un indice
   */
  private async deriveWallet(index: number): Promise<Wallet> {
    await this.ensureAuthenticated();

    try {
      
      // Crea un HD node dal seed master
      // Il seed è un hash quindi dobbiamo prima convertirlo in una frase mnemonica
      // o usarlo direttamente come entropia
      
      // Deriviamo una chiave privata unica per questo indice
      const path = `m/44'/60'/0'/0/${index}`;

      const pair = await this.SEA.pair(null, { seed: path })
      // convertiamo to eth private key
      const ethPrivateKey = this.convertToEthPk(pair.priv);

      const wallet = new ethers.Wallet(ethPrivateKey);
      
      // Aggiungiamo l'indice come proprietà
      (wallet as any).index = index;
      
      return wallet;
    } catch (error) {
      console.error(`Errore nella derivazione del wallet all'indice ${index}:`, error);
      throw new Error(`Impossibile derivare il wallet all'indice ${index}: ${error.message}`);
    }
  }

  private async getNextAccountIndex(): Promise<number> {
    console.log('getNextAccountIndex: Inizio recupero prossimo indice');
    await this.ensureAuthenticated();

    try {
      const addressesPath = `${EthereumHDKeyVault.ACCOUNTS_PATH}/addresses`;
      let maxIndex = -1;
      
      const addresses = await this.getPrivateData(addressesPath) as { [key: string]: AddressMetadata } | null;
      
      if (addresses) {
        // Trova l'indice più alto tra gli indirizzi esistenti
        for (const key in addresses) {
          if (addresses[key] && typeof addresses[key].index === 'number') {
            maxIndex = Math.max(maxIndex, addresses[key].index);
          }
        }
      }
      
      const nextIndex = maxIndex + 1;
      console.log('getNextAccountIndex: Prossimo indice calcolato:', nextIndex);
      return nextIndex;
    } catch (error) {
      console.error("getNextAccountIndex: Errore:", error);
      return 0;
    }
  }

  public getLegacyWallet(): Wallet {
    const pair = this.user._.sea;
    const pk = this.convertToEthPk(pair.priv);
    return new Wallet(pk);
  }

  public async createAccount(): Promise<WalletData> {
    console.log('createAccount: Inizio creazione nuovo account');
    await this.ensureAuthenticated();
    
    // Recupero del prossimo indice disponibile
    const index = await this.getNextAccountIndex();
    console.log('createAccount: Indice ottenuto:', index);

    // Generazione del wallet deterministico
    const wallet = await this.deriveWallet(index);
    console.log('createAccount: Wallet derivato:', { address: wallet.address, index });

    // Crittografia del wallet
    const encryptedJson = await wallet.encrypt(this.getEncryptionPassword());
    const timestamp = Date.now();
    
    // Preparazione dei dati da salvare
    const data: EncryptedWalletData = {
      encryptedJson,
      index,
      timestamp,
      addresses: {}
    };

    try {
      // Salvataggio dei dati del wallet
      const walletPath = `${EthereumHDKeyVault.ACCOUNTS_PATH}/${wallet.address.toLowerCase()}`;
      await this.savePrivateData(data, walletPath);
      
      // Aggiornamento dei metadati dell'indirizzo
      const addressMetadata: AddressMetadata = { index, timestamp };
      await this.saveWalletMetadata(wallet.address.toLowerCase(), addressMetadata);
      
      console.log('createAccount: Account creato con successo');

      // Restituzione del wallet completo con il path di derivazione come entropy
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        index,
        timestamp,
        entropy: `m/44'/60'/0'/0/${index}`
      };
    } catch (error) {
      console.error('createAccount: Errore nel salvataggio del wallet:', error);
      throw error;
    }
  }

  private async saveWalletMetadata(address: string, data: AddressMetadata): Promise<void> {
    console.log('saveWalletMetadata: Inizio salvataggio metadati');
    try {
      await this.ensureAuthenticated();
      
      const addressesPath = `${EthereumHDKeyVault.ACCOUNTS_PATH}/addresses/${address}`;
      await super.savePrivateDataWithRetry(data, addressesPath, 5, true);

      console.log('saveWalletMetadata: Salvataggio completato con successo');
    } catch (error) {
      console.error("saveWalletMetadata: Errore:", error);
      throw error;
    }
  }

  public async getWallets(): Promise<ExtendedWallet[]> {
    await this.ensureAuthenticated();

    try {
      const addressesPath = `${EthereumHDKeyVault.ACCOUNTS_PATH}/addresses`;
      const addresses = await this.getPrivateData(addressesPath) as { [key: string]: AddressMetadata } | null;
      const wallets: ExtendedWallet[] = [];
      
      if (addresses) {
        for (const address in addresses) {
          try {
            const walletData = await this.getPrivateData(`${EthereumHDKeyVault.ACCOUNTS_PATH}/${address}`) as EncryptedWalletData;
            
            if (walletData?.encryptedJson) {
              const wallet = await Wallet.fromEncryptedJson(
                walletData.encryptedJson,
                this.getEncryptionPassword()
              );
              
              const extendedWallet = {
                ...wallet,
                entropy: `m/44'/60'/0'/0/${addresses[address].index}`,
                index: addresses[address].index,
                timestamp: addresses[address].timestamp || Date.now()
              } as ExtendedWallet;
              
              wallets.push(extendedWallet);
            }
          } catch (error) {
            console.error(`Errore nel caricamento del wallet ${address}:`, error);
          }
        }
      }
      
      // Se non vengono trovati wallet, proviamo a recuperare quello all'indice 0
      if (wallets.length === 0) {
        try {
          const wallet = await this.getWalletByIndex(0);
          const extendedWallet = {
            ...wallet,
            entropy: `m/44'/60'/0'/0/0`,
            index: 0,
            timestamp: Date.now()
          } as ExtendedWallet;
          
          wallets.push(extendedWallet);
        } catch (error) {
          console.error('getWallets: Errore nel recupero del wallet all\'indice 0:', error);
        }
      }
      
      return wallets.sort((a, b) => a.index - b.index);
    } catch (error) {
      console.error("Errore nel recupero dei wallet:", error);
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
      console.error(`Errore nella decrittografia del wallet ${address}:`, error);
      return null;
    }
  }

  public async getWalletByIndex(index: number): Promise<Wallet> {
    const wallet = await this.deriveWallet(index);
    (wallet as any).index = index;
    return wallet;
  }

  public async getWallet(): Promise<Wallet> {
    await this.ensureAuthenticated();
    const wallets = await this.getWallets();
    if (wallets.length === 0) {
      // Se non ci sono wallet, ne creiamo uno all'indice 0
      return this.deriveWallet(0);
    }
    return new Wallet(wallets[0].privateKey);
  }

  protected async ensureAuthenticated(): Promise<void> {
    if (!this.user || !this.user.is) {
      throw new Error("Utente non autenticato");
    }

    if (!this.user._.sea) {
      throw new Error("Chiavi SEA non trovate");
    }

    if (!this.user._.sea.priv || !this.user._.sea.epub) {
      throw new Error("Chiavi di crittografia non disponibili");
    }
  }

  private base64UrlToHex(base64url: string): string {
    const padding = "=".repeat((4 - (base64url.length % 4)) % 4)
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding
    const binary = atob(base64)
    return binary
        .split("")
        .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
}

  public convertToEthPk(gunPrivateKey: string): string {
    if (!gunPrivateKey || typeof gunPrivateKey !== "string") {
      throw new Error("Chiave privata Gun non valida");
    }

    const pk = "0x" + this.base64UrlToHex(gunPrivateKey);

    try {
      return pk;
    } catch (error) {
      throw new Error("Impossibile generare una chiave privata Ethereum valida");
    }
  }

  public async deleteWallet(address: string): Promise<void> {
    try {
      await this.ensureAuthenticated();
      
      // Elimina wallet e metadati
      await this.deletePrivateData(`${EthereumHDKeyVault.ACCOUNTS_PATH}/${address.toLowerCase()}`);
      await this.deletePrivateData(`${EthereumHDKeyVault.ACCOUNTS_PATH}/addresses/${address.toLowerCase()}`);
      
      console.log(`Wallet ${address} eliminato con successo`);
    } catch (error) {
      console.error("Errore nell'eliminazione del wallet:", error);
      throw error;
    }
  }
} 