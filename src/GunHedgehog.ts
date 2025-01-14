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
  private username: string | null = null;
  private accountData: AccountData | null = null;

  constructor() {
    super();

    // Configurazione di default per Gun
    const defaultOptions: Partial<GunOptions> = { localStorage: true};

    // Creiamo l'istanza di Gun
    try {
      console.log("Inizializzazione Gun con opzioni:", defaultOptions);
      this.gun = new Gun(defaultOptions) as unknown as GunInstance;
      this.user = this.gun.user();

      // Richiamiamo eventuali sessioni precedenti
      this.user.recall({ sessionStorage: true });

      this.ready = true;
      console.log("Gun inizializzato con successo");
    } catch (error) {
      console.error("Errore nell'inizializzazione di Gun:", error);
      throw error;
    }
  }

  private async loadAccountData(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.username) {
        reject(new Error("Username non impostato"));
        return;
      }

      this.gun
        .get("accounts")
        .get(this.username)
        .once((data: any) => {
          if (!data) {
            this.accountData = {
              username: this.username!,
              wallets: {},
              selectedWallet: null,
            };
          } else {
            // Verifichiamo che i dati abbiano la struttura corretta
            if (typeof data !== "object" || !data.username || !data.wallets) {
              reject(new Error("Dati dell'account non validi"));
              return;
            }
            this.accountData = data;
          }
          resolve();
        });
    });
  }

  private async saveAccountData(): Promise<void> {
    if (!this.username || !this.accountData) {
      throw new Error("Nessun account da salvare");
    }

    console.log('Salvataggio dati:', this.accountData);
    
    return new Promise((resolve, reject) => {
      const maxRetries = 3;
      let currentRetry = 0;
      
      const attemptSave = async () => {
        try {
          currentRetry++;
          
          // Salviamo i dati dell'account nel nodo utente
          await new Promise<void>((res, rej) => {
            this.user.get('accountData').put(this.accountData, (ack: any) => {
              if (ack.err) rej(new Error(ack.err));
              else res();
            });
          });

          // Salviamo i dati dell'account nel grafo pubblico
          await new Promise<void>((res, rej) => {
            this.gun.get('accounts').get(this.username!).put(this.accountData, (ack: any) => {
              if (ack.err) rej(new Error(ack.err));
              else res();
            });
          });

          console.log('Dati salvati con successo');
          resolve();
        } catch (error) {
          console.log(`Tentativo di salvataggio ${currentRetry} fallito:`, error);
          
          if (currentRetry < maxRetries) {
            setTimeout(() => attemptSave(), 2000);
          } else {
            reject(new Error(`Impossibile salvare i dati dopo ${maxRetries} tentativi`));
          }
        }
      };
      
      attemptSave();
    });
  }

  private async verifyAccountData(
    username: string,
    walletAddress: string
  ): Promise<boolean> {
    console.log("Verifica dati salvati...");

    try {
      // Verifica nel grafo pubblico
      const publicData = await new Promise<AccountData>((resolve, reject) => {
        this.gun.get(`accounts/${username}`).once((data: any) => {
          console.log("Dati pubblici ricevuti:", data);
          if (!data || !data.username || !data.selectedWallet) {
            reject(new Error("Dati pubblici non validi"));
            return;
          }
          resolve(data as AccountData);
        });
      });

      // Verifica nel nodo utente
      const userData = await new Promise<AccountData>((resolve, reject) => {
        this.user.get("accountData").once((data: any) => {
          console.log("Dati utente ricevuti:", data);
          if (!data || !data.username || !data.selectedWallet) {
            reject(new Error("Dati utente non validi"));
            return;
          }
          resolve(data as AccountData);
        });
      });

      // Verifica il wallet specifico nel grafo pubblico
      const publicWallet = await new Promise<WalletData>((resolve, reject) => {
        this.gun
          .get(`accounts/${username}/wallets/${walletAddress}`)
          .once((data: any) => {
            console.log("Wallet pubblico ricevuto:", data);
            if (!data || !data.address || !data.entropy || !data.name) {
              reject(new Error("Wallet pubblico non valido"));
              return;
            }
            resolve(data as WalletData);
          });
      });

      // Verifica il wallet specifico nel nodo utente
      const userWallet = await new Promise<WalletData>((resolve, reject) => {
        this.user
          .get("accountData")
          .get("wallets")
          .get(walletAddress)
          .once((data: any) => {
            console.log("Wallet utente ricevuto:", data);
            if (!data || !data.address || !data.entropy || !data.name) {
              reject(new Error("Wallet utente non valido"));
              return;
            }
            resolve(data as WalletData);
          });
      });

      // Verifica che il wallet sia selezionato correttamente
      if (
        publicData.selectedWallet !== walletAddress ||
        userData.selectedWallet !== walletAddress
      ) {
        console.log("Wallet non selezionato correttamente");
        return false;
      }

      // Verifica che i dati del wallet corrispondano
      if (
        publicWallet.address !== walletAddress ||
        userWallet.address !== walletAddress
      ) {
        console.log("Indirizzo wallet non corrispondente");
        return false;
      }

      if (
        publicWallet.entropy !== userWallet.entropy ||
        publicWallet.name !== userWallet.name
      ) {
        console.log(
          "I dati del wallet non corrispondono tra pubblico e utente"
        );
        return false;
      }

      console.log("Verifica completata con successo");
      return true;
    } catch (error) {
      console.error("Errore durante la verifica:", error);
      return false;
    }
  }

  async signUp(username: string, password: string): Promise<Wallet> {
    // Reset utente
    if (this.user.is) {
      console.log("Reset utente esistente...");
      this.user.leave();
      this.user = this.gun.user();
    }

    console.log("Creazione nuovo utente...");
    // Creiamo l'utente e aspettiamo il completamento
    await new Promise<void>((resolve, reject) => {
      this.user.create(username, password, (ack: GunAck) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }
        resolve();
      });
    });

    console.log("Autenticazione utente...");
    // Autentichiamo e aspettiamo il callback
    await new Promise<void>((resolve, reject) => {
      this.user.auth(username, password, (ack: GunAck) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }
        resolve();
      });
    });

    // Attendiamo un attimo che le chiavi siano caricate
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log("Verifica chiavi...");
    // Verifichiamo le chiavi
    this.gunKeyPair = this.user._.sea;
    this.username = username;

    if (!this.gunKeyPair) {
      throw new Error("Chiavi non trovate");
    }

    console.log("Creazione wallet...");
    // Creiamo il wallet
    const walletResult = await WalletManager.createWalletObj(this.gunKeyPair);
    if (walletResult instanceof Error) throw walletResult;

    // Salviamo i dati
    this.accountData = {
      username,
      wallets: {},
      selectedWallet: walletResult.walletObj.address,
    };

    const walletData: WalletData = {
      address: walletResult.walletObj.address,
      entropy: walletResult.entropy,
      name: "Wallet Principale",
    };

    console.log("Salvataggio dati account...");
    this.accountData = await WalletManager.addWallet(
      this.accountData,
      walletData
    );

    // Salviamo i dati e verifichiamo
    let retries = 3;
    while (retries > 0) {
      try {
        await this.saveAccountData();
        console.log("Dati salvati, attendo conferma...");

        // Verifichiamo i dati
        const verified = await this.verifyAccountData(
          username,
          walletResult.walletObj.address
        );
        if (verified) {
          console.log("Verifica dati completata con successo");
          break;
        }

        throw new Error("Verifica dati fallita");
      } catch (error) {
        console.log(`Tentativo di salvataggio fallito (${retries}):`, error);
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    this.wallet = walletResult.walletObj;
    console.log("Signup completato con successo");
    return this.wallet;
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

    this.accountData = await WalletManager.addWallet(
      this.accountData,
      walletData
    );
    await this.saveAccountData();

    this.wallet = walletResult.walletObj;
    return this.wallet;
  }

  async switchWallet(address: string): Promise<boolean> {
    if (!this.username || !this.accountData) {
      throw new Error("Devi fare il login prima di cambiare wallet");
    }

    const success = await WalletManager.setSelectedWallet(
      this.accountData,
      address
    );
    if (success) {
      await this.saveAccountData();

      if (this.gunKeyPair) {
        const walletResult = await WalletManager.createWalletObj(
          this.gunKeyPair
        );
        if (walletResult instanceof Error) throw walletResult;
        this.wallet = walletResult.walletObj;
      }
    }
    return success;
  }

  async removeWallet(address: string): Promise<void> {
    if (!this.username || !this.accountData) {
      throw new Error("Devi fare il login prima di rimuovere un wallet");
    }

    await WalletManager.removeWallet(this.accountData, address);
    await this.saveAccountData();
  }

  async login(username: string, password: string): Promise<Wallet> {
    return new Promise((resolve, reject) => {
      this.user.auth(username, password, async (ack: GunAck) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }

        try {
          // Attendiamo un attimo che le chiavi siano caricate
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Salviamo la coppia di chiavi
          this.gunKeyPair = this.user._.sea;
          this.username = username;

          if (!this.gunKeyPair) {
            throw new Error("Chiavi GUN non trovate");
          }

          // Carichiamo i dati dell'account
          try {
            await this.loadAccountData();
          } catch (loadError) {
            // Se non riusciamo a caricare i dati, creiamo un nuovo account
            this.accountData = {
              username,
              wallets: {},
              selectedWallet: null,
            };
          }

          // Se non ci sono wallet, ne creiamo uno nuovo
          if (
            !this.accountData ||
            Object.keys(this.accountData.wallets).length === 0
          ) {
            const newWalletResult = await WalletManager.createWalletObj(
              this.gunKeyPair
            );
            if (newWalletResult instanceof Error) throw newWalletResult;

            const walletData = {
              address: newWalletResult.walletObj.address,
              entropy: newWalletResult.entropy,
              name: "Wallet Principale",
            };

            this.accountData = await WalletManager.addWallet(
              this.accountData!,
              walletData
            );

            try {
              await this.saveAccountData();
            } catch (saveError: any) {
              throw new Error(
                `Errore nel salvataggio dei dati: ${saveError.message}`
              );
            }

            this.wallet = newWalletResult.walletObj;
          } else {
            // Altrimenti recuperiamo il wallet selezionato
            const selectedWallet = WalletManager.getSelectedWallet(
              this.accountData
            );
            if (!selectedWallet) {
              throw new Error("Nessun wallet selezionato trovato");
            }

            const walletResult = await WalletManager.createWalletObj(
              this.gunKeyPair
            );
            if (walletResult instanceof Error) throw walletResult;
            this.wallet = walletResult.walletObj;
          }

          resolve(this.wallet);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async logout() {
    if (this.username) {
      this.accountData = null;
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
