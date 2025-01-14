import "gun/sea";
import Gun from "gun/gun";
import type {
  GunInstance,
  GunKeyPair,
  GunOptions,
  GunAck,
  AccountData,
  WalletData,
} from "./types";
import type { Wallet } from "ethers";
import { Hedgehog } from "./Hedgehog";
import { WalletManager } from "./WalletManager";

export class GunHedgehog extends Hedgehog {
  private gun: GunInstance;
  private user: any;
  private gunKeyPair: GunKeyPair | null = null;
  override username: string | null = null;
  private accountData: AccountData | undefined = undefined;
  private walletCache: Map<string, Wallet> = new Map();

  constructor() {
    super();

    // Configurazione di default per Gun
    const defaultOptions: Partial<GunOptions> = { };

    // Creiamo l'istanza di Gun
    try {
      this.gun = new Gun(defaultOptions) as unknown as GunInstance;
      this.user = this.gun.user();

      // Richiamiamo eventuali sessioni precedenti
      this.user.recall({ sessionStorage: true });

      this.ready = true;
    } catch (error) {
      console.error("Errore nell'inizializzazione di Gun:", error);
      throw error;
    }
  }

  private async loadAccountData(): Promise<void> {
    if (!this.username) {
      throw new Error("Username non impostato");
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Timeout nel caricamento dei dati dell'account"));
      }, 15000);

      const accountRef = this.gun.get(`accounts/${this.username}`);
      
      accountRef.on(async (data: any) => {
        if (!data) return;

        try {
          // Se wallets è un riferimento, lo seguiamo
          if (data.wallets && typeof data.wallets === 'object' && data.wallets['#']) {
            const walletsRef = accountRef.get('wallets');
            await new Promise<void>((resolveWallets) => {
              walletsRef.on((wallets: any) => {
                if (!wallets) return;
                
                // Verifica se abbiamo tutti i dati dei wallet
                const hasAllWalletData = Object.entries(wallets).every(([_, wallet]: [string, any]) => {
                  return wallet && wallet.address && wallet.entropy;
                });

                if (hasAllWalletData) {
                  this.accountData = {
                    ...data,
                    wallets
                  };
                  clearTimeout(timeoutId);
                  resolveWallets();
                  resolve();
                }
              });
            });
          } else if (data.wallets) {
            // I wallet sono inline
            const hasAllWalletData = Object.entries(data.wallets).every(([_, wallet]: [string, any]) => {
              return wallet && wallet.address && wallet.entropy;
            });

            if (hasAllWalletData) {
              this.accountData = data;
              clearTimeout(timeoutId);
              resolve();
            }
          }
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    });
  }

  private async saveAccountData(): Promise<void> {
    if (!this.username || !this.accountData) {
      throw new Error('Username o accountData non definiti');
    }

    // Prepara i dati da salvare
    const accountDataToSave = {
      username: this.accountData.username,
      selectedWallet: this.accountData.selectedWallet,
      wallets: this.accountData.wallets
    };

    return new Promise((resolve, reject) => {
      const attemptSave = async (attempt: number) => {
        try {
          // Salva nel nodo utente
          await new Promise<void>((res, rej) => {
            this.user.get('accountData').put(accountDataToSave, (ack: GunAck) => {
              if (ack.err) rej(new Error(ack.err));
              else res();
            });
          });

          // Attendi che i dati siano disponibili
          await new Promise((res, rej) => {
            let checked = false;
            const checkData = () => {
              this.user.get('accountData').once((data: any) => {
                if (data && data.username === this.username && data.wallets) {
                  checked = true;
                  res(data);
                } else if (attempt < 3) {
                  setTimeout(checkData, 1000);
                } else {
                  rej(new Error('Dati non salvati correttamente'));
                }
              });
            };
            checkData();
          });

          resolve();
        } catch (saveError) {
          if (attempt < 3) {
            setTimeout(() => attemptSave(attempt + 1), 1000);
          } else {
            reject(saveError);
          }
        }
      };

      attemptSave(1);
    });
  }

  override async signUp(username: string, password: string): Promise<Wallet> {
    return new Promise((resolve, reject) => {
      this.user.create(username, password, async (ack: GunAck) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }

        try {
          // Effettua il login e attendi che sia completato
          await new Promise<void>((res, rej) => {
            this.user.auth(username, password, (ack: GunAck) => {
              if (ack.err) rej(new Error(ack.err));
              else res();
            });
          });

          // Attendi che le chiavi siano disponibili
          await new Promise(resolve => setTimeout(resolve, 500));

          // Imposta i dati dell'utente
          this.username = username;
          this.gunKeyPair = await this.user._.sea;

          if (!this.gunKeyPair) {
            throw new Error("Chiavi non trovate dopo il login");
          }

          // Inizializza l'account data
          this.accountData = {
            username: this.username,
            wallets: {},
            selectedWallet: null
          };

          // Crea il primo wallet
          const walletResult = await WalletManager.createWalletObj(this.gunKeyPair);
          if (walletResult instanceof Error) throw walletResult;

          const walletData = {
            address: walletResult.walletObj.address,
            entropy: walletResult.entropy,
            name: "Wallet Principale",
          };

          // Aggiungi il wallet e imposta come selezionato
          this.accountData.wallets[walletResult.walletObj.address] = walletData;
          this.accountData.selectedWallet = walletResult.walletObj.address;

          // Salva il wallet nella cache
          this.walletCache.set(walletResult.walletObj.address, walletResult.walletObj);
          this.wallet = walletResult.walletObj;

          // Salva i dati e attendi la conferma
          await this.saveAccountData();
          
          resolve(walletResult.walletObj);
        } catch (error: any) {
          console.error("Errore durante il signup:", error);
          reject(error);
        }
      });
    });
  }

  async createWallet(name: string): Promise<void> {
    if (!this.username || !this.accountData || !this.gunKeyPair) {
      throw new Error("Devi fare il login prima di creare un wallet");
    }

    const walletResult = await WalletManager.createWalletObj(this.gunKeyPair);
    if (walletResult instanceof Error) throw walletResult;

    const walletData = {
      address: walletResult.walletObj.address,
      entropy: walletResult.entropy,
      name: name,
    };

    this.accountData = await WalletManager.addWallet(this.accountData, walletData);
    await this.saveAccountData();
  }

  async createNewWallet(name: string = "Nuovo Wallet"): Promise<Wallet> {
    if (!this.gunKeyPair || !this.username || !this.accountData) {
      throw new Error("Devi fare il login prima di creare un nuovo wallet");
    }

    const walletResult = await WalletManager.createWalletObj(this.gunKeyPair);
    if (walletResult instanceof Error) throw walletResult;

    const walletData: WalletData = {
      address: walletResult.walletObj.address,
      entropy: walletResult.entropy,
      name: name,
    };

    // Aggiorna l'account data e salva
    this.accountData = await WalletManager.addWallet(
      this.accountData,
      walletData
    );
    await this.saveAccountData();

    // Aggiorna la cache e il wallet corrente
    this.walletCache.set(walletResult.walletObj.address, walletResult.walletObj);
    this.wallet = walletResult.walletObj;

    return this.wallet;
  }

  private async getOrCreateWallet(address: string, entropy: string): Promise<Wallet> {
    // Controlla se il wallet è già in cache
    const cachedWallet = this.walletCache.get(address);
    if (cachedWallet) {
      return cachedWallet;
    }

    // Se non è in cache, lo ricrea
    if (!this.gunKeyPair) {
      throw new Error("Chiavi GUN non trovate");
    }

    const walletResult = await WalletManager.createWalletFromSalt(
      this.gunKeyPair,
      entropy
    );

    if (walletResult instanceof Error) {
      throw walletResult;
    }

    // Salva il nuovo wallet in cache
    this.walletCache.set(address, walletResult);
    return walletResult;
  }

  async switchWallet(address: string): Promise<boolean> {
    if (!this.username || !this.accountData) {
      throw new Error("Devi fare il login prima di cambiare wallet");
    }

    // Verifichiamo che il wallet esista
    const walletData = this.accountData.wallets[address];
    if (!walletData || !walletData.entropy) {
      return false;
    }

    // Impostiamo il wallet come selezionato
    this.accountData.selectedWallet = address;

    // Carichiamo o creiamo il wallet
    try {
      this.wallet = await this.getOrCreateWallet(address, walletData.entropy);
      await this.saveAccountData();
      return true;
    } catch (error) {
      console.error("Errore durante lo switch del wallet:", error);
      return false;
    }
  }

  async removeWallet(address: string): Promise<void> {
    if (!this.username || !this.accountData) {
      throw new Error("Devi fare il login prima di rimuovere un wallet");
    }

    console.log("Inizio rimozione wallet:", address);

    try {
      // Rimuoviamo localmente
      const updatedData = await WalletManager.removeWallet(this.accountData, address);
      this.accountData = updatedData;
      console.log("Wallet rimosso localmente");

      // Salviamo i dati aggiornati
      await this.saveAccountData();
      console.log("Dati account salvati");

      // Attendiamo un momento per la propagazione
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verifichiamo che i dati siano stati aggiornati
      const accountRef = this.gun.get(`accounts/${this.username}`);
      let maxRetries = 10;
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        const verifyData = await new Promise<any>((resolve) => {
          accountRef.once((data: any) => {
            console.log(`Tentativo ${retryCount + 1}/${maxRetries} - Dati verificati:`, JSON.stringify(data));
            resolve(data);
          });
        });

        if (!verifyData) {
          console.log("Dati non trovati, riprovo...");
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Verifica che il wallet sia stato rimosso correttamente
        const walletStillExists = verifyData.wallets && address in verifyData.wallets;
        const walletStillSelected = verifyData.selectedWallet === address;

        if (!walletStillExists && !walletStillSelected) {
          console.log("Rimozione wallet completata con successo");
          return;
        }

        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      throw new Error("Impossibile verificare la rimozione del wallet dopo i tentativi massimi");
    } catch (error) {
      console.error("Errore durante la rimozione del wallet:", error);
      throw error;
    }
  }

  override async login(username: string, password: string): Promise<Wallet> {
    return new Promise((resolve, reject) => {
      this.user.auth(username, password, async (ack: GunAck) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }

        try {
          // Attendiamo che le chiavi siano caricate
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Salviamo la coppia di chiavi
          this.gunKeyPair = this.user._.sea;
          this.username = username;

          if (!this.gunKeyPair) {
            throw new Error("Chiavi GUN non trovate");
          }

          // Carichiamo i dati dell'account
          await this.loadAccountData();

          if (!this.accountData) {
            throw new Error("Dati dell'account non trovati");
          }

          if (!this.accountData.wallets || Object.keys(this.accountData.wallets).length === 0) {
            // Se non ci sono wallet, ne creiamo uno nuovo
            const newWallet = await this.createNewWallet("Wallet Principale");
            return resolve(newWallet);
          }

          // Carichiamo il wallet selezionato o il primo disponibile
          const walletAddresses = Object.keys(this.accountData.wallets);
          const walletAddress = this.accountData.selectedWallet || walletAddresses[0];

          if (!walletAddress) {
            throw new Error("Nessun wallet trovato");
          }

          const walletData = this.accountData.wallets[walletAddress];
          if (!walletData || !walletData.entropy) {
            throw new Error("Dati del wallet non validi");
          }

          // Crea o recupera il wallet
          this.wallet = await this.getOrCreateWallet(walletAddress, walletData.entropy);

          // Se non c'era un wallet selezionato, impostiamo questo
          if (!this.accountData.selectedWallet) {
            this.accountData.selectedWallet = walletAddress;
            await this.saveAccountData();
          }

          resolve(this.wallet);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  override async logout() {
    if (this.username) {
      this.accountData = undefined;
    }
    this.user.leave();
    this.gunKeyPair = null;
    this.wallet = null;
    this.username = null;
  }

  getGunKeyPair(): GunKeyPair | null {
    return this.gunKeyPair;
  }

  getUser() {
    return this.user;
  }

  // Metodo per ottenere l'istanza di Gun (se necessario)
  getGunInstance(): GunInstance {
    return this.gun;
  }

  // Metodo per chiudere l'istanza di Gun
  async close(): Promise<void> {
    if (this.isLoggedIn()) {
      await this.logout();
    }
    this.gun.off();
  }
}
