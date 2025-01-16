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
import SEA from "gun/sea";

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

    if (d) console.log("Caricamento dati account per:", this.username);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Timeout nel caricamento dei dati dell'account"));
      }, 30000);

      const accountRef = this.gun.get('accounts').get(this.username);
      let hasResolved = false;

      const processData = async (data: any) => {
        if (!data) {
          console.log("Nessun dato ricevuto");
          return;
        }

        console.log("Account data ricevuto:", data);

        if (data.username !== this.username) {
          console.log("Username non corrispondente");
          return;
        }

        // Se i dati contengono un riferimento ai wallet, seguilo
        if (data.wallets && data.wallets['#']) {
          const walletsRef = this.gun.get(data.wallets['#']);
          return new Promise<void>((resolveWallets) => {
            walletsRef.once(async (walletsData: any) => {
              if (!walletsData) {
                console.log("Nessun dato wallet trovato");
                return;
              }

              // Crea una copia profonda dei dati
              const accountData = {
                username: data.username,
                selectedWallet: data.selectedWallet,
                wallets: {} as { [key: string]: WalletData }
              };

              // Carica i dati di ogni wallet
              const walletPromises = Object.entries(walletsData)
                .filter(([key]) => key !== '_')
                .map(async ([address, walletRef]: [string, any]) => {
                  if (!walletRef['#']) return;
                  
                  return new Promise<void>((resolveWallet) => {
                    this.gun.get(walletRef['#']).once((walletData: any) => {
                      if (walletData && walletData.address && walletData.entropy) {
                        accountData.wallets[address] = walletData;
                      }
                      resolveWallet();
                    });
                  });
                });

              await Promise.all(walletPromises);

              if (Object.keys(accountData.wallets).length > 0) {
                this.accountData = accountData;
                if (!hasResolved) {
                  hasResolved = true;
                  clearTimeout(timeoutId);
                  resolve();
                }
              }
            });
          });
        }

        // Se i wallet sono inline
        if (data.wallets && typeof data.wallets === 'object') {
          const accountData = JSON.parse(JSON.stringify({
            username: data.username,
            selectedWallet: data.selectedWallet,
            wallets: data.wallets
          }));

          if (Object.keys(accountData.wallets).length > 0) {
            this.accountData = accountData;
            if (!hasResolved) {
              hasResolved = true;
              clearTimeout(timeoutId);
              resolve();
            }
            return;
          }
        }

        // Se abbiamo dati in memoria, li manteniamo
        if (this.accountData?.wallets && Object.keys(this.accountData.wallets).length > 0) {
          console.log("Usando dati dalla memoria");
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeoutId);
            resolve();
          }
          return;
        }

        console.log("Nessun wallet trovato");
      };

      accountRef.on(processData);
      accountRef.once(processData);
    });
  }

  private async saveAccountData(ack?: GunAck): Promise<void> {
    if (!this.username || !this.accountData) {
      throw new Error("Dati account non disponibili");
    }

    console.log("Account data prima del salvataggio:", this.accountData);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Timeout nel salvataggio dei dati dell'account"));
      }, 30000);

      // Prima salviamo ogni wallet individualmente
      const walletsRef = this.gun.get('accounts').get(this.username).get('wallets');
      const walletPromises = Object.entries(this.accountData!.wallets).map(([address, walletData]) => {
        return new Promise<void>((resolveWallet, rejectWallet) => {
          const walletRef = walletsRef.get(address);
          const retryAttempts = 3;
          let currentAttempt = 0;

          const attemptSave = () => {
            currentAttempt++;
            walletRef.put(walletData, (ack: any) => {
              if (ack.err) {
                if (currentAttempt < retryAttempts) {
                  console.log(`Tentativo ${currentAttempt} fallito per ${address}, riprovo...`);
                  setTimeout(attemptSave, 1000);
                } else {
                  rejectWallet(new Error(`Errore nel salvare il wallet ${address} dopo ${retryAttempts} tentativi: ${ack.err}`));
                }
                return;
              }

              // Verifica che il wallet sia stato salvato correttamente
              let verifyAttempts = 0;
              const verifyData = () => {
                verifyAttempts++;
                walletRef.once((savedData: any) => {
                  if (!savedData || !savedData.address || !savedData.entropy) {
                    if (verifyAttempts < retryAttempts) {
                      console.log(`Verifica ${verifyAttempts} fallita per ${address}, riprovo...`);
                      setTimeout(verifyData, 1000);
                    } else {
                      rejectWallet(new Error(`Dati wallet non salvati correttamente per ${address} dopo ${retryAttempts} verifiche`));
                    }
                    return;
                  }
                  resolveWallet();
                });
              };
              verifyData();
            });
          };
          attemptSave();
        });
      });

      // Attendiamo che tutti i wallet siano salvati
      Promise.all(walletPromises)
        .then(() => {
          // Verifica che tutti i wallet siano stati salvati
          return new Promise<void>((resolveVerify, rejectVerify) => {
            let verifyAttempts = 0;
            const maxVerifyAttempts = 3;

            const verifyWallets = () => {
              verifyAttempts++;
              walletsRef.once((walletsData: any) => {
                if (!walletsData) {
                  if (verifyAttempts < maxVerifyAttempts) {
                    console.log(`Verifica wallet ${verifyAttempts} fallita, riprovo...`);
                    setTimeout(verifyWallets, 1000);
                    return;
                  }
                  rejectVerify(new Error("Nessun dato wallet trovato dopo il salvataggio"));
                  return;
                }

                const savedAddresses = Object.keys(walletsData).filter(key => key !== '_');
                const expectedAddresses = Object.keys(this.accountData!.wallets);

                if (savedAddresses.length !== expectedAddresses.length) {
                  if (verifyAttempts < maxVerifyAttempts) {
                    console.log(`Verifica numero wallet ${verifyAttempts} fallita, riprovo...`);
                    setTimeout(verifyWallets, 1000);
                    return;
                  }
                  rejectVerify(new Error(`Numero di wallet salvati non corretto: ${savedAddresses.length} vs ${expectedAddresses.length}`));
                  return;
                }

                resolveVerify();
              });
            };
            verifyWallets();
          });
        })
        .then(() => {
          // Poi salviamo i dati dell'account con i riferimenti ai wallet
          const accountData = {
            username: this.accountData!.username,
            selectedWallet: this.accountData!.selectedWallet,
            wallets: walletsRef
          };

          let saveAttempts = 0;
          const maxSaveAttempts = 3;

          const saveAccount = () => {
            saveAttempts++;
            this.gun.get('accounts')
              .get(this.username)
              .put(accountData, (ack: any) => {
                if (ack.err) {
                  if (saveAttempts < maxSaveAttempts) {
                    console.log(`Salvataggio account ${saveAttempts} fallito, riprovo...`);
                    setTimeout(saveAccount, 1000);
                    return;
                  }
                  clearTimeout(timeoutId);
                  reject(new Error(`Errore nel salvare i dati account dopo ${maxSaveAttempts} tentativi: ${ack.err}`));
                  return;
                }

                // Verifica finale che i dati siano stati salvati
                let verifyAttempts = 0;
                const verifyAccount = () => {
                  verifyAttempts++;
                  this.gun.get('accounts')
                    .get(this.username)
                    .once((savedData: any) => {
                      if (!savedData || !savedData.username || !savedData.wallets) {
                        if (verifyAttempts < maxSaveAttempts) {
                          console.log(`Verifica account ${verifyAttempts} fallita, riprovo...`);
                          setTimeout(verifyAccount, 1000);
                          return;
                        }
                        clearTimeout(timeoutId);
                        reject(new Error("Dati account non salvati correttamente"));
                        return;
                      }

                      console.log("Salvataggio dati account completato per:", this.username, this.accountData);
                      clearTimeout(timeoutId);
                      resolve();
                    });
                };
                verifyAccount();
              });
          };
          saveAccount();
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
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

        try {
          // Effettua il login e attendi che sia completato
          await new Promise<void>((res, rej) => {
            this.user.auth(username, password, (ack: GunAck) => {
              if (ack.err) rej(new Error(ack.err));
              else res();
            });
          });

          // Aumentato il timeout per assicurarsi che le chiavi siano disponibili
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Verifica che le chiavi siano effettivamente disponibili
          let attempts = 0;
          while (!this.user._.sea && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }

          // Imposta i dati dell'utente
          this.username = username;
          this.gunKeyPair = await this.user._.sea;

          if (!this.gunKeyPair) {
            throw new Error("Chiavi non trovate dopo il login");
          }

          // generate 2 sea pairs
          const seaPair1 = await SEA.pair();
          const seaPair2 = await SEA.pair();

          const stealthKeysObj = {
            viewingPair: seaPair1,
            spendingPair: seaPair2
          };

          // encrypt the stealth keys with the gun key pair
          const encryptedStealthKeys = await SEA.encrypt(stealthKeysObj, this.gunKeyPair);

          // Inizializza l'account data
          this.accountData = {
            username: this.username,
            wallets: {},
            encryptedStealthKeys: encryptedStealthKeys,
            selectedWallet: null
          };

          // Crea il primo wallet
          const walletResult = await WalletManager.createWalletObj(this.gunKeyPair);
          if (walletResult instanceof Error) throw walletResult;

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

    // Ricarica i dati dell'account per assicurarsi di avere lo stato più recente
    await this.loadAccountData();
    if (!this.accountData) {
      throw new Error("Dati dell'account non trovati dopo il caricamento");
    }

    // Salva una copia dei wallet esistenti
    const existingWallets = JSON.parse(JSON.stringify(this.accountData.wallets));
    if (d) console.log("Wallet esistenti:", existingWallets);

    const walletResult = await WalletManager.createWalletObj(this.gunKeyPair);
    if (walletResult instanceof Error) throw walletResult;

    const walletData: WalletData = {
      address: walletResult.walletObj.address,
      entropy: walletResult.entropy,
      name: name,
    };

    if (d) console.log("Nuovo wallet creato:", walletData);

    // Aggiorna l'account data usando il WalletManager
    this.accountData = await WalletManager.addWallet(this.accountData, walletData);

    if (d) console.log("Account data prima del salvataggio:", this.accountData);

    // Salva i dati e attendi che siano effettivamente salvati
    await this.saveAccountData();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Attendi la propagazione

    // Verifica che i dati siano stati salvati correttamente
    await this.loadAccountData();

    if (!this.accountData) {
      throw new Error("Dati dell'account persi dopo il salvataggio");
    }

    // Verifica che tutti i wallet esistenti siano ancora presenti
    for (const [address, wallet] of Object.entries(existingWallets)) {
      if (!this.accountData.wallets[address]) {
        if (d) console.error("Wallet perso durante il salvataggio:", address);
        // Ripristina il wallet perso e tutti gli altri wallet esistenti
        this.accountData.wallets = {
          ...existingWallets,
          [walletData.address]: walletData
        };
        await this.saveAccountData();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Attendi la propagazione
        break;
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

    try {
      // Ricarica i dati dell'account per assicurarsi di avere lo stato più recente
      await this.loadAccountData();
      if (!this.accountData) {
        throw new Error("Dati dell'account non trovati dopo il caricamento");
      }

      // Salva una copia dei wallet esistenti
      const existingWallets = JSON.parse(JSON.stringify(this.accountData.wallets));
      const walletCount = Object.keys(existingWallets).length;
      if (d) console.log("Numero wallet prima della rimozione:", walletCount);

      if (walletCount <= 1) {
        throw new Error("Non puoi rimuovere l'ultimo wallet");
      }

      // Rimuoviamo localmente
      const updatedData = await WalletManager.removeWallet(this.accountData, address);
      this.accountData = updatedData;
      if (d) console.log("Wallet rimosso localmente, nuovo stato:", this.accountData);

      // Salviamo i dati aggiornati e attendiamo la propagazione
      await this.saveAccountData();


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
          // Ripristina tutti i wallet tranne quello da rimuovere
          const walletsToKeep = Object.entries(existingWallets)
            .filter(([a]) => a !== address)
            .reduce((acc, [a, w]) => ({ ...acc, [a]: w }), {});
          this.accountData.wallets = walletsToKeep;
          await this.saveAccountData();
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
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

          // Carichiamo i dati dell'account
          await this.loadAccountData();

          if (!this.accountData) {
            throw new Error("Dati dell'account non trovati");
          }

          if (d) console.log("Dati account caricati:", this.accountData);

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

          if (d) console.log("Carico wallet:", walletAddress);

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
