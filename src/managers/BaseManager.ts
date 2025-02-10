import { IGunChain, IGunInstance, IGunUserInstance, ISEAPair } from "gun";
import { IGunStaticNode } from "gun-util";

/**
 * Classe base astratta per i manager che utilizzano Gun
 */
export abstract class BaseManager<T> {
  protected gun: IGunInstance;
  protected user: IGunUserInstance;
  protected abstract storagePrefix: string;
  protected APP_KEY_PAIR: ISEAPair;
  protected nodesPath: { private: string; public: string } = { private: '', public: '' };

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    this.gun = gun;
    this.user = this.gun.user();
    this.APP_KEY_PAIR = APP_KEY_PAIR;
  }

  /**
   * Crea un nuovo account/coppia di chiavi
   */
  public abstract createAccount(...args: any[]): Promise<T>;

  /**
   * Salva i dati in modo privato
   */
  protected async savePrivateData(data: T, path: string = ""): Promise<boolean> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    // Se i dati sono un array, li convertiamo in un oggetto speciale
    const processedData = Array.isArray(data)
      ? {
          _isArray: true,
          length: data.length,
          ...data.reduce((acc: any, item: any, index: number) => {
            acc[index.toString()] = item;
            return acc;
          }, {}),
        }
      : data;

    return new Promise<boolean>((resolve, reject) => {
      const node = this.getPrivateNode(path);
      
      // Prima puliamo i dati esistenti
      node.put(null, (ack: any) => {
        if (ack.err) {
          console.error("Error clearing data:", ack.err);
          reject(new Error(ack.err));
          return;
        }
        
        // Aumentiamo il tempo di attesa tra la pulizia e il salvataggio
        setTimeout(() => {
          // Poi salviamo i nuovi dati con un callback di conferma
          node.put(processedData, (ack: any) => {
            if (ack.err) {
              console.error("Error saving data:", ack.err);
              reject(new Error(ack.err));
              return;
            }

            // Verifichiamo che i dati siano stati effettivamente salvati
            node.once((savedData: any) => {
              if (!savedData) {
                reject(new Error("Data verification failed - no data found"));
                return;
              }
              
              // Aggiungiamo un ulteriore ritardo per assicurare la propagazione
              setTimeout(() => {
                resolve(true);
              }, 2000);
            });
          });
        }, 2000); // Aumentiamo il tempo di attesa tra pulizia e salvataggio
      });
    });
  }

  /**
   * Salva i dati in modo pubblico
   */
  protected async savePublicData(data: any, path: string = ""): Promise<boolean> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    const publicKey = this.user.is.pub;
    if (!publicKey) {
      throw new Error("Public key not found");
    }

    return new Promise((resolve, reject) => {
      const node = this.getPublicNode(path);
      node.put(data, (ack: any) => {
        if (ack.err) {
          reject(new Error(ack.err));
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Recupera i dati privati
   */
  protected async getPrivateData(path: string = ""): Promise<T | null> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    return new Promise((resolve, reject) => {
      this.user
        .get("private")
        .get(this.storagePrefix)
        .get(path)
        .once((data: any) => {
          console.log("Raw data from Gun:", data);
          if (!data) {
            resolve(null);
            return;
          }

          try {
            const cleanedData = this.cleanGunMetadata<any>(data);
            console.log("Cleaned data:", cleanedData);

            // Se i dati sono un array speciale, li convertiamo in un array normale
            if (cleanedData && cleanedData._isArray) {
              const length = cleanedData.length;
              const array = [];
              for (let i = 0; i < length; i++) {
                const item = cleanedData[i.toString()];
                if (item !== undefined && item !== null) {
                  array.push(this.cleanGunMetadata(item));
                }
              }
              console.log("Processed array data:", array);
              resolve(array as T);
              return;
            }

            const processedData = this.processRetrievedData<T>(cleanedData);
            console.log("Processed data:", processedData);
            resolve(processedData);
          } catch (error) {
            console.error("Error processing data:", error);
            reject(error);
          }
        });
    });
  }

  /**
   * Processa i dati recuperati convertendo il formato speciale degli array nel formato originale
   */
  protected processRetrievedData<T>(data: any): T {
    if (!data) return data as T;

    // Se i dati hanno il flag _isArray, convertiamo in array
    if (data._isArray) {
      const length = data.length;
      const array: any[] = [];
      for (let i = 0; i < length; i++) {
        if (data[i] !== undefined) {
          const item = this.cleanGunMetadata(data[i]);
          if (item && Object.keys(item).length > 0) {
            array.push(item);
          }
        }
      }
      return array as T;
    }

    // Se è un oggetto, processiamo ricorsivamente le sue proprietà
    if (typeof data === "object") {
      const processed = { ...data };
      for (const key in processed) {
        if (processed[key] && typeof processed[key] === "object") {
          processed[key] = this.processRetrievedData<any>(processed[key]);
        }
      }
      return processed as T;
    }

    return data as T;
  }

  protected cleanGunMetadata<T>(data: any): T {
    if (!data) return data;
    if (typeof data === "object") {
      const cleaned = { ...data };
      delete cleaned._;
      delete cleaned['#'];
      return cleaned;
    }
    return data;
  }

  /**
   * Recupera i dati pubblici
   */
  protected async getPublicData(publicKey: string, path: string = ""): Promise<any> {
    return new Promise((resolve, reject) => {
      this.gun
        .get(`~${publicKey}`)
        .get("public")
        .get(this.storagePrefix)
        .get(path)
        .once((data: any) => {
          resolve(this.cleanGunMetadata(data));
        });
    });
  }

  /**
   * Elimina i dati privati
   */
  protected async deletePrivateData(path?: string): Promise<void> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    const publicKey = this.user.is.pub;
    if (!publicKey) {
      throw new Error("Public key not found");
    }

    return new Promise((resolve, reject) => {
      let resolved = false;
      let verifyAttempts = 0;
      const maxVerifyAttempts = 5;
      let verifyInterval: NodeJS.Timeout;

      const cleanup = () => {
        clearTimeout(timeoutId);
        clearInterval(verifyInterval);
      };

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          cleanup();
          resolved = true;
          reject(new Error("Delete operation timed out"));
        }
      }, 30000);

      const node = this.gun
        .get(`~${publicKey}`)
        .get("private")
        .get(this.storagePrefix)
        .get(path || "");

      node.put(null, (ack: any) => {
        if (ack.err) {
          cleanup();
          reject(new Error(ack.err));
        } else {
          // Verifica che i dati siano stati effettivamente eliminati
          verifyInterval = setInterval(async () => {
            verifyAttempts++;
            if (verifyAttempts > maxVerifyAttempts) {
              cleanup();
              reject(new Error("Data verification failed - max attempts reached"));
              return;
            }

            node.once((data: any) => {
              if (data === null) {
                // I dati sono stati eliminati con successo
                cleanup();
                if (!resolved) {
                  resolved = true;
                  resolve();
                }
              } else {
                console.warn(`Attempt ${verifyAttempts}: Data still exists, waiting...`);
              }
            });
          }, 2000); // Verifica ogni 2 secondi
        }
      });
    });
  }

  /**
   * Elimina i dati pubblici
   */
  protected async deletePublicData(path?: string): Promise<void> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    const publicKey = this.user.is.pub;
    if (!publicKey) {
      throw new Error("Public key not found");
    }

    return new Promise((resolve, reject) => {
      let resolved = false;
      let verifyAttempts = 0;
      const maxVerifyAttempts = 5;
      let verifyInterval: NodeJS.Timeout;

      const cleanup = () => {
        clearTimeout(timeoutId);
        clearInterval(verifyInterval);
      };

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          cleanup();
          resolved = true;
          reject(new Error("Delete operation timed out"));
        }
      }, 30000);

      const node = this.gun
        .get(`~${publicKey}`)
        .get("public")
        .get(this.storagePrefix)
        .get(path || "");

      node.put(null, (ack: any) => {
        if (ack.err) {
          cleanup();
          reject(new Error(ack.err));
        } else {
          // Verifica che i dati siano stati effettivamente eliminati
          verifyInterval = setInterval(async () => {
            verifyAttempts++;
            if (verifyAttempts > maxVerifyAttempts) {
              cleanup();
              reject(new Error("Data verification failed - max attempts reached"));
              return;
            }

            node.once((data: any) => {
              if (data === null) {
                // I dati sono stati eliminati con successo
                cleanup();
                if (!resolved) {
                  resolved = true;
                  resolve();
                }
              } else {
                console.warn(`Attempt ${verifyAttempts}: Data still exists, waiting...`);
              }
            });
          }, 2000); // Verifica ogni 2 secondi
        }
      });
    });
  }

  protected isNullOrEmpty(data: any): boolean {
    if (data === null || data === undefined) return true;
    if (typeof data === "object" && Object.keys(data).filter(k => k !== "_").length === 0) return true;
    return false;
  }

  /**
   * Verifica se l'utente è autenticato
   */
  protected isAuthenticated(): boolean {
    return !!this.user.is;
  }

  /**
   * Ottiene il public key dell'utente corrente
   */
  protected getCurrentPublicKey(): string {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }
    return this.user.is.pub;
  }

  /**
   * Verifica che l'utente sia autenticato, altrimenti lancia un'eccezione
   */
  protected checkAuthentication(): void {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }
  }

  public cleanup(): void {
    if (this.user) {
      this.user.leave();
    }
  }

  /**
   * Imposta il percorso del nodo privato
   */
  protected setPrivateNodePath(path: string): void {
    this.nodesPath.private = `private/${this.storagePrefix}/${path}`.replace(/\/+/g, '/');
  }

  /**
   * Imposta il percorso del nodo pubblico
   */
  protected setPublicNodePath(path: string): void {
    this.nodesPath.public = `public/${this.storagePrefix}/${path}`.replace(/\/+/g, '/');
  }

  /**
   * Ottiene il nodo Gun per il percorso privato specificato
   */
  protected getPrivateNode(path: string = ''): IGunChain<any, any, IGunInstance, string> {
    this.setPrivateNodePath(path);
    return this.user.get('private').get(this.storagePrefix).get(path);
  }

  /**
   * Ottiene il nodo Gun per il percorso pubblico specificato
   */
  protected getPublicNode(path: string = ''): IGunChain<any, any, IGunInstance, string> {
    this.setPublicNodePath(path);
    const publicKey = this.user.is?.pub;
    if (!publicKey) throw new Error('Public key not found');
    return this.gun.get(`~${publicKey}`).get('public').get(this.storagePrefix).get(path);
  }
}
