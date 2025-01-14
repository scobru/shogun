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
  private accountData: AccountData | undefined = undefined;

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
      throw new Error('Username o accountData non definiti');
    }


    // Salviamo prima i wallet individualmente
    const walletPromises = Object.entries(this.accountData.wallets).map(([address, wallet]) => {
      return Promise.all([
        // Nel nodo utente
        new Promise<void>((resolve, reject) => {
          this.user.get('accountData').get('wallets').get(address).put(wallet, (ack: GunAck) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
        }),
        // Nel grafo pubblico
        new Promise<void>((resolve, reject) => {
          this.gun.get(`accounts/${this.username}/wallets/${address}`).put(wallet, (ack: GunAck) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
        })
      ]);
    });

    await Promise.all(walletPromises);

    // Poi salviamo l'account data
    const accountDataToSave = {
      username: this.accountData.username,
      selectedWallet: this.accountData.selectedWallet,
      wallets: this.accountData.wallets
    };

    return new Promise((resolve, reject) => {
      const attemptSave = async (attempt: number) => {
        try {
          await Promise.all([
            // Salva nel nodo utente
            new Promise<void>((res, rej) => {
              this.user.get('accountData').put(accountDataToSave, (ack: GunAck) => {
                if (ack.err) rej(ack.err);
                else res();
              });
            }),
            // Salva nel grafo pubblico
            new Promise<void>((res, rej) => {
              this.gun.get(`accounts/${this.username}`).put(accountDataToSave, (ack: GunAck) => {
                if (ack.err) rej(ack.err);
                else res();
              });
            })
          ]);

          // Attendi 2 secondi per la propagazione dei dati
          await new Promise(res => setTimeout(res, 2000));

          // Verifica che i dati siano stati salvati correttamente
          const savedData = await new Promise((res, rej) => {
            this.gun.get(`accounts/${this.username}`).once((data: any) => {
              if (!data) rej(new Error('Dati non trovati dopo il salvataggio'));
              else res(data);
            });
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

 

  async signUp(username: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.user.create(username, password, async (ack: GunAck) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }

        try {
          await this.login(username, password);

          if (!this.gunKeyPair) {
            throw new Error("Chiavi non trovate dopo il login");
          }

          // Creiamo il primo wallet
          const walletResult = await WalletManager.createWalletObj(this.gunKeyPair, this.accountData);
          if (walletResult instanceof Error) throw walletResult;

          const walletData = {
            address: walletResult.walletObj.address,
            entropy: walletResult.entropy,
            name: "Wallet Principale",
          };

          this.accountData = await WalletManager.addWallet(
            this.accountData!,
            walletData
          );

          await this.saveAccountData();
          resolve();
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

    const walletResult = await WalletManager.createWalletObj(this.gunKeyPair, this.accountData);
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

    console.log("Inizio rimozione wallet:", address);

    try {
      // Rimuoviamo localmente
      await WalletManager.removeWallet(this.accountData, address);
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

        // Se il wallet non è più presente e non è più selezionato, abbiamo finito
        if (!verifyData.selectedWallet || verifyData.selectedWallet !== address) {
          console.log("Rimozione wallet completata con successo");
          return;
        }

        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      throw new Error("Il wallet non è stato rimosso correttamente dopo i tentativi massimi");
    } catch (error) {
      console.error("Errore durante la rimozione del wallet:", error);
      throw error;
    }
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
