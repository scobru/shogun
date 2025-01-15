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

let d = true; // debug

export class GunHedgehog extends Hedgehog {
  private gun: GunInstance;
  private user: any;
  private gunKeyPair: GunKeyPair | null = null;
  override username: string | null = null;
  private accountData: AccountData | undefined = undefined;
  private walletCache: Map<string, Wallet> = new Map();

  constructor(options: Partial<GunOptions> = {}) {
    super();

    // Configurazione di default per Gun

    // Merge delle opzioni mantenendo quelle passate dall'utente
    const gunOptions = {  ...options };

    // Creiamo l'istanza di Gun
    try {
      this.gun = new Gun(gunOptions) as unknown as GunInstance;
      this.user = this.gun.user();

      // Disabilitiamo il recall per i test
      const isTestMode = !gunOptions.file && gunOptions.memory === true;
      if (isTestMode) {
        this.user.leave();
      } else {
        // Richiamiamo eventuali sessioni precedenti solo se non siamo in modalità test
        this.user.recall({ sessionStorage: true });
      }

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

    if (d) console.log("Caricamento dati account per:", this.username);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Timeout nel caricamento dei dati dell'account"));
      }, 15000);

      const accountRef = this.gun.get('accounts').get(this.username);
      let resolved = false;

      const processData = async (data: any) => {
        if (resolved) return;
        if (d) console.log("Dati account ricevuti:", data);

        try {
          // Se non ci sono dati ma abbiamo accountData in memoria, usiamo quello
          if (!data && this.accountData) {
            if (d) console.log("Usando dati in memoria");
            resolved = true;
            clearTimeout(timeoutId);
            resolve();
            return;
          }

          // Se non ci sono dati e non abbiamo accountData, è un errore
          if (!data || !data.username || data.username !== this.username) {
            if (d) console.log("Dati non validi:", data);
            return;
          }

          // Carica i wallet
          const walletsRef = accountRef.get('wallets');
          const wallets = await new Promise<any>((res) => {
            walletsRef.once((data) => res(data));
          });

          if (!wallets) {
            // Se non ci sono wallet ma abbiamo dati in memoria, usiamo quelli
            if (this.accountData?.wallets) {
              if (d) console.log("Nessun wallet trovato, uso i dati in memoria");
              this.accountData = {
                username: data.username,
                selectedWallet: data.selectedWallet || Object.keys(this.accountData.wallets)[0],
                wallets: { ...this.accountData.wallets }
              };
              resolved = true;
              clearTimeout(timeoutId);
              resolve();
              return;
            }
            return;
          }

          // Raccogli gli indirizzi dei wallet
          const addresses = Object.keys(wallets).filter(key => key !== '_');
          let loadedWallets: { [key: string]: WalletData } = {};

          // Carica i dati di ogni wallet
          for (const address of addresses) {
            const walletData = await new Promise<any>((res) => {
              walletsRef.get(address).once((data) => res(data));
            });

            if (walletData && walletData.address && walletData.entropy && walletData.name) {
              loadedWallets[address] = {
                address: walletData.address,
                entropy: walletData.entropy,
                name: walletData.name
              };
            }
          }

          // Se non abbiamo trovato wallet ma abbiamo dati in memoria, usiamo quelli
          if (Object.keys(loadedWallets).length === 0 && this.accountData?.wallets) {
            if (d) console.log("Nessun wallet trovato, uso i dati in memoria");
            loadedWallets = { ...this.accountData.wallets };
          }

          // Aggiorna accountData
          this.accountData = {
            username: data.username,
            selectedWallet: data.selectedWallet || Object.keys(loadedWallets)[0],
            wallets: loadedWallets
          };

          if (d) console.log("Dati account caricati:", this.accountData);
          resolved = true;
          clearTimeout(timeoutId);
          resolve();
        } catch (error) {
          if (d) console.error("Errore in processData:", error);
          if (!resolved) {
            clearTimeout(timeoutId);
            reject(error);
          }
        }
      };

      // Sottoscrizione principale per i dati dell'account
      accountRef.on(processData);
      accountRef.once(processData);
    });
  }

  private async saveAccountData(): Promise<void> {
    if (!this.username || !this.accountData) {
      throw new Error('Username o accountData non definiti');
    }

    if (d) console.log("Salvataggio dati account per:", this.username, this.accountData);

    const accountRef = this.gun.get('accounts').get(this.username);
    const walletsRef = accountRef.get('wallets');

    // Salva prima i wallet individualmente
    for (const [address, wallet] of Object.entries(this.accountData.wallets) as [string, WalletData][]) {
      if (d) console.log("Salvataggio wallet:", address);
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Timeout nel salvare il wallet ${address}`));
        }, 5000);

        walletsRef.get(address).put(wallet, (ack: GunAck) => {
          clearTimeout(timeoutId);
          if (ack.err) {
            reject(new Error(`Errore nel salvare il wallet ${address}: ${ack.err}`));
          } else {
            resolve();
          }
        });
      });
    }

    // Ora salva i dati dell'account con i riferimenti ai wallet
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout nel salvare i dati account'));
      }, 5000);

      const accountData = {
        username: this.accountData!.username,
        selectedWallet: this.accountData!.selectedWallet,
        wallets: { '#': `accounts/${this.username}/wallets` }
      };

      accountRef.put(accountData, async (ack: GunAck) => {
        clearTimeout(timeoutId);
        if (ack.err) {
          reject(new Error(`Errore nel salvare i dati account: ${ack.err}`));
          return;
        }

        try {
          // Verifica finale che tutti i wallet siano accessibili
          for (const address of Object.keys(this.accountData!.wallets)) {
            await new Promise<void>((res, rej) => {
              walletsRef.get(address).once((data: WalletData | null) => {
                if (!data || !data.address || !data.entropy) {
                  rej(new Error(`Wallet ${address} non trovato dopo il salvataggio`));
                } else {
                  res();
                }
              });
            });
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  override async signUp(username: string, password: string): Promise<Wallet> {
    if (d) console.log("signUp", username, password);
    
    return new Promise((resolve, reject) => {
      this.user.create(username, password, async (ack: GunAck) => {
        if (ack.err) {
          if (d) console.log("signUp", ack.err);
          reject(new Error(ack.err));
          return;
        }

        if (d) console.log("signUp", ack);

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

          if (d) console.log("signUp", this.gunKeyPair);

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

          if (d) console.log("signUp", walletResult);

          // Aggiungi il wallet ai dati dell'account
          const { walletObj, entropy } = walletResult;
          this.accountData.wallets[walletObj.address] = {
            address: walletObj.address,
            entropy: entropy,
            name: "Wallet Principale"
          };
          this.accountData.selectedWallet = walletObj.address;

          // Salva i dati e attendi che siano effettivamente salvati
          await this.saveAccountData();

          // Verifica che i dati siano stati salvati correttamente
          await this.loadAccountData();

          // Aggiungi il wallet alla cache
          this.walletCache.set(walletObj.address, walletObj);

          // Imposta il wallet corrente
          this.wallet = walletObj;

          resolve(walletObj);
        } catch (error) {
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

    if (d) console.log("Creazione nuovo wallet:", name);

    // Salva una copia dei wallet esistenti
    const existingWallets = { ...this.accountData.wallets };
    if (d) console.log("Wallet esistenti:", existingWallets);

    const walletResult = await WalletManager.createWalletObj(this.gunKeyPair);
    if (walletResult instanceof Error) throw walletResult;

    const walletData: WalletData = {
      address: walletResult.walletObj.address,
      entropy: walletResult.entropy,
      name: name,
    };

    if (d) console.log("Nuovo wallet creato:", walletData);

    // Aggiorna l'account data mantenendo i wallet esistenti
    this.accountData = {
      ...this.accountData,
      wallets: {
        ...existingWallets,
        [walletData.address]: walletData
      }
    };

    if (d) console.log("Account data prima del salvataggio:", this.accountData);

    // Salva i dati
    await this.saveAccountData();

    // Verifica che i dati siano stati salvati correttamente
    await this.loadAccountData();

    if (!this.accountData) {
      throw new Error("Dati dell'account persi dopo il salvataggio");
    }

    // Verifica che tutti i wallet esistenti siano ancora presenti
    for (const [address, wallet] of Object.entries(existingWallets)) {
      if (!this.accountData.wallets[address]) {
        if (d) console.error("Wallet perso durante il salvataggio:", address);
        // Ripristina il wallet perso
        this.accountData.wallets[address] = wallet;
        await this.saveAccountData();
      }
    }

    // Verifica che il nuovo wallet sia presente
    if (!this.accountData.wallets[walletResult.walletObj.address]) {
      throw new Error("Nuovo wallet non salvato correttamente");
    }

    // Aggiorna la cache e il wallet corrente
    this.walletCache.set(walletResult.walletObj.address, walletResult.walletObj);
    this.wallet = walletResult.walletObj;

    if (d) console.log("Stato finale account data:", this.accountData);
    if (d) console.log("Creazione wallet completata con successo");

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

    if (d) console.log("Inizio rimozione wallet:", address);

    try {
      // Salva una copia dei wallet esistenti
      const existingWallets = { ...this.accountData.wallets };
      const walletCount = Object.keys(existingWallets).length;
      if (d) console.log("Numero wallet prima della rimozione:", walletCount);

      if (walletCount <= 1) {
        throw new Error("Non puoi rimuovere l'ultimo wallet");
      }

      // Rimuoviamo localmente
      const updatedData = await WalletManager.removeWallet(this.accountData, address);
      this.accountData = updatedData;
      if (d) console.log("Wallet rimosso localmente, nuovo stato:", this.accountData);

      // Salviamo i dati aggiornati
      await this.saveAccountData();
      if (d) console.log("Dati account salvati");

      // Verifichiamo che i dati siano stati aggiornati
      await this.loadAccountData();

      if (!this.accountData) {
        throw new Error("Dati dell'account persi dopo il salvataggio");
      }

      // Verifica che il wallet sia stato effettivamente rimosso
      if (this.accountData.wallets[address]) {
        if (d) console.error("Il wallet non è stato rimosso:", address);
        throw new Error("Il wallet non è stato rimosso correttamente");
      }

      // Verifica che gli altri wallet siano ancora presenti
      for (const [addr, wallet] of Object.entries(existingWallets)) {
        if (addr !== address && !this.accountData.wallets[addr]) {
          if (d) console.error("Wallet perso durante la rimozione:", addr);
          // Ripristina il wallet perso
          this.accountData.wallets[addr] = wallet;
          await this.saveAccountData();
        }
      }

      // Verifica finale del numero di wallet
      const finalWalletCount = Object.keys(this.accountData.wallets).length;
      if (d) console.log("Numero wallet dopo la rimozione:", finalWalletCount);
      
      if (finalWalletCount !== walletCount - 1) {
        if (d) console.error("Conteggio wallet non corretto:", finalWalletCount);
        throw new Error("Conteggio wallet non corretto dopo la rimozione");
      }

      if (d) console.log("Rimozione wallet completata con successo");
    } catch (error) {
      if (d) console.error("Errore durante la rimozione del wallet:", error);
      throw error;
    }
  }

  override async login(username: string, password: string): Promise<Wallet> {
    return new Promise((resolve, reject) => {
      this.user.auth(username, password, async (ack: GunAck) => {
        if (ack.err) {
          if (d) console.log("Login fallito:", ack.err);
          reject(new Error(ack.err));
          return;
        }

        try {
          if (d) console.log("Login riuscito, attendo chiavi...");
          
          // Attendiamo che le chiavi siano caricate con un timeout più lungo
          let attempts = 0;
          while (!this.user._.sea && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }

          // Salviamo la coppia di chiavi
          this.gunKeyPair = this.user._.sea;
          this.username = username;

          if (!this.gunKeyPair) {
            throw new Error("Chiavi GUN non trovate dopo 10 secondi");
          }

          if (d) console.log("Chiavi caricate, carico i dati dell'account...");

          // Carichiamo i dati dell'account
          await this.loadAccountData();

          if (!this.accountData) {
            throw new Error("Dati dell'account non trovati");
          }

          if (d) console.log("Dati account caricati:", this.accountData);

          if (!this.accountData.wallets || Object.keys(this.accountData.wallets).length === 0) {
            if (d) console.log("Nessun wallet trovato, ne creo uno nuovo");
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

          if (d) console.log("Carico wallet:", walletAddress);

          const walletData = this.accountData.wallets[walletAddress];
          if (!walletData || !walletData.entropy) {
            throw new Error("Dati del wallet non validi");
          }

          // Crea o recupera il wallet
          this.wallet = await this.getOrCreateWallet(walletAddress, walletData.entropy);

          if (d) console.log("Wallet caricato:", this.wallet.address);

          // Se non c'era un wallet selezionato, impostiamo questo
          if (!this.accountData.selectedWallet) {
            this.accountData.selectedWallet = walletAddress;
            await this.saveAccountData();
          }

          resolve(this.wallet);
        } catch (error) {
          if (d) console.error("Errore durante il login:", error);
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
