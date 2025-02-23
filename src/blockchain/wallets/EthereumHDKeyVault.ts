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
  addresses?: { [key: string]: AddressMetadata };
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
  addresses: { [key: string]: AddressMetadata };
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
    console.log('getMasterWallet: Iniziando recupero master wallet');
    if (this.masterWallet) {
      console.log('getMasterWallet: Ritorno master wallet dalla cache');
      return this.masterWallet;
    }

    try {
      const masterPath = EthereumHDKeyVault.MASTER_WALLET_PATH;
      console.log(`getMasterWallet: Tentativo di recupero da ${masterPath}`);
      const encryptedData = await this.getPrivateData(masterPath) as EncryptedHDWalletData | null;
      console.log('getMasterWallet: Dati recuperati:', encryptedData);

      if (encryptedData?.mnemonic) {
        console.log('getMasterWallet: Creazione nodo da mnemonic esistente');
        const node = ethers.HDNodeWallet.fromMnemonic(
          ethers.Mnemonic.fromPhrase(encryptedData.mnemonic),
          `m`
        );
        this.masterWallet = node;
      } else {
        console.log('getMasterWallet: Creazione nuovo nodo master');
        const mnemonic = ethers.Mnemonic.fromEntropy(ethers.randomBytes(16));
        const node = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m`);
        this.masterWallet = node;

        const data = {
          mnemonic: mnemonic.phrase,
          timestamp: Date.now()
        };

        console.log('getMasterWallet: Salvataggio nuovo master wallet');
        await super.savePrivateDataWithRetry(
          data,
          masterPath,
          10,
          true
        );

        console.log('getMasterWallet: Verifica salvataggio');
        const savedData = await this.getPrivateData(masterPath) as EncryptedHDWalletData;
        if (!savedData?.mnemonic) {
          throw new Error("Failed to save master wallet mnemonic");
        }
        console.log('getMasterWallet: Verifica completata con successo');
      }

      if (this.masterWallet.depth !== 0) {
        throw new Error("Il master wallet non è un nodo root dopo l'inizializzazione");
      }

      console.log('getMasterWallet: Master wallet pronto');
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
    console.log('getNextAccountIndex: Inizio recupero prossimo indice');
    await this.ensureAuthenticated();

    try {
        const addressesPath = `${EthereumHDKeyVault.ACCOUNTS_PATH}/addresses`;
        let maxIndex = -1;
        let retryCount = 0;
        const maxRetries = 5;

        while (retryCount < maxRetries) {
            try {
                console.log(`getNextAccountIndex: Tentativo ${retryCount + 1} di lettura`);
                await this.ensureAuthenticated();

                // Leggiamo direttamente dal nodo addresses
                const addresses = await new Promise<any>((resolve) => {
                    const node = this.getPrivateNode(addressesPath);
                    let foundData = false;
                    let result: { [key: string]: AddressMetadata } = {};

                    node.map().once((data: any, key: string) => {
                        if (key !== '_' && key !== '#' && data && typeof data === 'object') {
                            foundData = true;
                            console.log(`getNextAccountIndex: Trovato indirizzo ${key} con dati:`, data);
                            result[key] = data;
                            if (data.index !== undefined && typeof data.index === 'number') {
                                maxIndex = Math.max(maxIndex, data.index);
                                console.log(`getNextAccountIndex: Aggiornato maxIndex a ${maxIndex}`);
                            }
                        }
                    });

                    setTimeout(() => {
                        console.log(`getNextAccountIndex: Dati trovati:`, result);
                        resolve(result);
                    }, 5000);
                });

                if (maxIndex >= 0) {
                    console.log(`getNextAccountIndex: Trovato indice massimo ${maxIndex}`);
                    break;
                }

                console.log(`getNextAccountIndex: Nessun indice valido trovato al tentativo ${retryCount + 1}`);
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            } catch (error) {
                console.error(`getNextAccountIndex: Errore al tentativo ${retryCount + 1}:`, error);
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
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

  public async createAccount(): Promise<WalletData> {
    console.log('createAccount: Inizio creazione nuovo account');
    await this.ensureAuthenticated();

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('createAccount: Recupero prossimo indice');
    const index = await this.getNextAccountIndex();
    console.log('createAccount: Indice ottenuto:', index);

    console.log('createAccount: Derivazione wallet');
    const wallet = await this.deriveWallet(index);
    console.log('createAccount: Wallet derivato:', { address: wallet.address, index });

    const encryptedJson = await wallet.encrypt(this.getEncryptionPassword());
    const data: EncryptedWalletData = {
      encryptedJson,
      index,
      timestamp: Date.now()
    };
    console.log('createAccount: Dati wallet preparati:', { address: wallet.address, index, timestamp: data.timestamp });

    console.log('createAccount: Salvataggio metadati');
    await this.saveWalletMetadata(data);
    console.log('createAccount: Metadati salvati con successo');

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('createAccount: Verifica finale indici');
    const allWallets = await this.getWallets();
    console.log('createAccount: Wallet esistenti:', allWallets.map(w => ({ address: w.address, index: w.index })));

    const result = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      entropy: `${EthereumHDKeyVault.BASE_PATH}/${index}`,
      index,
      timestamp: data.timestamp
    };
    console.log('createAccount: Ritorno risultato:', { address: result.address, index: result.index });
    return result;
  }

  private async saveWalletMetadata(data: EncryptedWalletData): Promise<void> {
    console.log('saveWalletMetadata: Inizio salvataggio metadati');
    try {
        await this.ensureAuthenticated();
        
        const wallet = await Wallet.fromEncryptedJson(data.encryptedJson, this.getEncryptionPassword());
        const address = wallet.address.toLowerCase();
        console.log(`saveWalletMetadata: Processando wallet ${address} con indice ${data.index}`);

        // Salviamo prima il wallet completo
        const walletPath = `${EthereumHDKeyVault.ACCOUNTS_PATH}/${address}`;
        await super.savePrivateDataWithRetry(data, walletPath, 5, true);

        // Attendiamo per la propagazione
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Salviamo l'indirizzo direttamente nel nodo addresses
        const addressesPath = `${EthereumHDKeyVault.ACCOUNTS_PATH}/addresses/${address}`;
        const addressData: AddressMetadata = {
            index: data.index,
            timestamp: data.timestamp
        };

        // Salviamo i dati dell'indirizzo
        await super.savePrivateDataWithRetry(addressData, addressesPath, 5, true);

        // Verifica finale
        const savedWallet = await this.getPrivateData(walletPath);
        const savedAddress = await this.getPrivateData(addressesPath);

        if (!savedWallet || !savedAddress) {
            throw new Error(`Verifica del salvataggio fallita per ${address}`);
        }

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
        const wallets: ExtendedWallet[] = [];
        
        // Recuperiamo tutti gli indirizzi
        await new Promise<void>((resolve) => {
            this.getPrivateNode(addressesPath).map().once(async (data: any, key: string) => {
                try {
                    if (key === '_' || key === '#' || !data || typeof data !== 'object') {
                        return;
                    }

                    console.log(`Processing wallet data for address ${key}:`, data);
                    
                    const walletData = await this.getPrivateData(`${EthereumHDKeyVault.ACCOUNTS_PATH}/${key}`);
                    if (!walletData?.encryptedJson) {
                        console.log(`No encrypted data found for address ${key}`);
                        return;
                    }

                    const wallet = await Wallet.fromEncryptedJson(
                        walletData.encryptedJson,
                        this.getEncryptionPassword()
                    );

                    const extendedWallet = {
                        ...wallet,
                        entropy: `${EthereumHDKeyVault.BASE_PATH}/${data.index}`,
                        index: data.index,
                        timestamp: data.timestamp || Date.now()
                    } as ExtendedWallet;

                    wallets.push(extendedWallet);
                    console.log(`Successfully loaded wallet for address ${key} with index ${data.index}`);
                } catch (error) {
                    console.error(`Error loading wallet ${key}:`, error);
                }
            });

            // Diamo tempo per caricare tutti i wallet
            setTimeout(resolve, 10000);
        });

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

  protected async ensureAuthenticated(): Promise<void> {
    if (!this.user || !this.user.is) {
        throw new Error("Utente non autenticato");
    }

    if (!this.user._.sea) {
        throw new Error("Chiavi SEA non trovate");
    }

    // Verifica aggiuntiva delle chiavi necessarie
    if (!this.user._.sea.priv || !this.user._.sea.epub) {
        throw new Error("Chiavi di crittografia non disponibili");
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

  protected async savePrivateDataWithRetry(
    data: any,
    path: string,
    maxRetries: number = 5,
    forceNewObject: boolean = false
  ): Promise<void> {
    await this.ensureAuthenticated();

    const dataToSave = forceNewObject ? JSON.parse(JSON.stringify(data)) : data;
    let attempts = 0;
    let lastError: Error | null = null;

    const verifyData = async (): Promise<boolean> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const node = this.getPrivateNode(path);
                let resolved = false;

                const handler = (savedData: any) => {
                    if (!resolved) {
                        resolved = true;
                        node.off();

                        if (!savedData) {
                            resolve(false);
                            return;
                        }

                        const cleanedSaved = this.cleanGunMetadata(savedData);
                        const isEquivalent = this.areObjectsEquivalent(cleanedSaved, dataToSave);
                        resolve(isEquivalent);
                    }
                };

                node.once(handler);

                // Timeout di sicurezza
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        node.off();
                        resolve(false);
                    }
                }, 5000);
            }, 2000);
        });
    };

    while (attempts < maxRetries) {
        try {
            // Salviamo i dati
            await new Promise<void>((resolve, reject) => {
                const node = this.getPrivateNode(path);
                let resolved = false;

                const saveHandler = (ack: any) => {
                    if (!resolved) {
                        resolved = true;
                        if (ack.err) {
                            reject(new Error(ack.err));
                        } else {
                            resolve();
                        }
                    }
                };

                node.put(dataToSave, saveHandler);

                // Timeout di sicurezza
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        reject(new Error("Save operation timed out"));
                    }
                }, 10000);
            });

            // Attendiamo per la propagazione
            await new Promise(resolve => setTimeout(resolve, Math.max(3000, 2000 * attempts)));

            // Verifichiamo il salvataggio
            if (await verifyData()) {
                return;
            }

            attempts++;
            if (attempts < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, Math.max(3000, 2000 * attempts)));
            }
        } catch (error) {
            console.error(`Tentativo ${attempts + 1} fallito:`, error);
            lastError = error as Error;
            attempts++;
            if (attempts < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, Math.max(3000, 2000 * attempts)));
            }
        }
    }

    throw new Error(`Impossibile salvare i dati dopo ${maxRetries} tentativi${lastError ? `: ${lastError.message}` : ''}`);
  }
}
