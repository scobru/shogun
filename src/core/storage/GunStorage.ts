import SEA from "../../sea/sea";
import { IGunUserInstance, ISEAPair, ISEA } from "gun";
import { IGunChain } from "gun";
import { IGunInstance } from "gun";

export abstract class GunStorage<T> {
  protected gun: IGunInstance;
  protected user: IGunUserInstance;
  protected SEA: typeof SEA;
  protected storagePrefix: string;
  protected appPrefix: string;
  protected APP_KEY_PAIR: ISEAPair;
  protected nodesPath: { private: string; public: string } = {
    private: "",
    public: "",
  };

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    this.gun = gun;
    this.user = this.gun.user();
    this.SEA = SEA;
    this.APP_KEY_PAIR = APP_KEY_PAIR;
    this.appPrefix = this.APP_KEY_PAIR.pub;
  }

  protected async savePrivateData(
    data: T,
    path: string = ""
  ): Promise<boolean> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    const processedData = data;

    return new Promise<boolean>((resolve, reject) => {
      const node = this.getPrivateNode(path);

      node.put(null, (ack: any) => {
        if (ack.err) {
          console.error("Error clearing data:", ack.err);
          reject(new Error(ack.err));
          return;
        }

        setTimeout(() => {
          node.put(processedData, (ack: any) => {
            if (ack.err) {
              console.error("Error saving data:", ack.err);
              reject(new Error(ack.err));
              return;
            }

            node.once((savedData: any) => {
              if (!savedData) {
                reject(new Error("Data verification failed - no data found"));
                return;
              }

              setTimeout(() => {
                resolve(true);
              }, 2000);
            });
          });
        }, 2000);
      });
    });
  }

  protected async savePublicData(
    data: any,
    path: string = ""
  ): Promise<boolean> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    const publicKey = this.user.is.pub;
    if (!publicKey) {
      throw new Error("Public key not found");
    }

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

    return new Promise((resolve, reject) => {
      const node = this.getPublicNode(path);
      node.put(processedData, (ack: any) => {
        if (ack.err) {
          reject(new Error(ack.err));
        } else {
          resolve(true);
        }
      });
    });
  }

  protected async getPrivateData(path: string = ""): Promise<T | null> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    return new Promise((resolve, reject) => {
      this.getPrivateNode(path).once((data: any) => {
        if (!data) {
          resolve(null);
          return;
        }

        try {
          if (typeof data === "string") {
            try {
              const parsed = JSON.parse(data);
              resolve(this.cleanGunMetadata(parsed) as T);
              return;
            } catch {
              resolve(data as T);
              return;
            }
          }

          const cleanedData = this.cleanGunMetadata(data);
          resolve(cleanedData as T);
        } catch (error) {
          console.error("Error processing data:", error);
          reject(error);
        }
      });
    });
  }

  protected cleanGunMetadata<T>(data: any): T {
    if (!data) return data;

    if (typeof data === "string") return data as T;

    if (typeof data === "object") {
      const cleaned = { ...data };
      delete cleaned._;
      return cleaned as T;
    }

    return data as T;
  }

  protected async getPublicData(
    publicKey: string,
    path: string = ""
  ): Promise<any> {
    const node = this.getPublicNode(path)
    return new Promise((resolve, reject) => {
      node
        .once((data: any) => {
          resolve(this.cleanGunMetadata(data));
        });
    });
  }

  protected async deletePrivateData(path: string = ""): Promise<void> {
    this.checkAuthentication();

    const maxAttempts = 3;
    let attempts = 0;

    const deleteNode = async () => {
      return new Promise<void>((resolve, reject) => {
        const node = this.getPrivateNode(path);
        node.put(null, (ack: any) => {
          if (ack.err) {
            reject(new Error(ack.err));
          } else {
            node.off();
            resolve();
          }
        });
      });
    };

    const verifyDeletion = async (): Promise<boolean> => {
      return new Promise((resolve) => {
        const node = this.getPrivateNode(path);
        node.once((data: any) => {
          resolve(!data || (typeof data === 'object' && Object.keys(data).length === 0));
        });
      });
    };

    while (attempts < maxAttempts) {
      try {
        await deleteNode();

        await new Promise(resolve => setTimeout(resolve, 1000));

        if (await verifyDeletion()) {
          return;
        }

        await this.savePrivateData({} as T, path);

        await new Promise(resolve => setTimeout(resolve, 1000));

        if (await verifyDeletion()) {
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Tentativo ${attempts + 1} fallito:`, error);
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    throw new Error("Impossibile eliminare i dati dopo multipli tentativi");
  }

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
      const maxVerifyAttempts = 3;
      let verifyInterval: NodeJS.Timeout;

      const cleanup = () => {
        clearTimeout(timeoutId);
        clearInterval(verifyInterval);
        node.off();
      };

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          cleanup();
          resolved = true;
          reject(new Error("Delete operation timed out"));
        }
      }, 15000);

      const node = this.gun
        .get(`~${publicKey}`)
        .get(this.appPrefix)
        .get(path || "");

      const verifyDeletion = () => {
        node.once((data: any) => {
          if (!data || (typeof data === 'object' && Object.keys(data).filter(k => k !== '_').length === 0)) {
            cleanup();
            if (!resolved) {
              resolved = true;
              resolve();
            }
          }
        });
      };

      node.put(null, (ack: any) => {
        if (ack.err) {
          cleanup();
          reject(new Error(ack.err));
        } else {
          verifyInterval = setInterval(() => {
            verifyAttempts++;
            if (verifyAttempts > maxVerifyAttempts) {
              cleanup();
              reject(new Error("Data verification failed - max attempts reached"));
              return;
            }
            verifyDeletion();
          }, 1000);
        }
      });
    });
  }

  protected isNullOrEmpty(data: any): boolean {
    if (data === null || data === undefined) return true;
    if (
      typeof data === "object" &&
      Object.keys(data).filter((k) => k !== "_").length === 0
    )
      return true;
    return false;
  }


  protected isAuthenticated(): boolean {
    return !!this.user.is;
  }


  protected getCurrentPublicKey(): string {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }
    return this.user.is.pub;
  }


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


  protected setPrivateNodePath(path: string): void {
    this.nodesPath.private = `${this.appPrefix}/${path}`.replace(
      /\/+/g,
      "/"
    );
  }


  protected setPublicNodePath(path: string): void {
    this.nodesPath.public = `${this.appPrefix}/${path}`.replace(
      /\/+/g,
      "/"
    );
  }


  protected getPrivateNode(
    path: string = ""
  ): IGunChain<any, any, IGunInstance, string> {
    this.setPrivateNodePath(path);
    return this.user.get(this.appPrefix).get(path);
  }


  protected getPublicNode(
    path: string = ""
  ): IGunChain<any, any, IGunInstance, string> {
    this.setPublicNodePath(path);
    const publicKey = this.user.is?.pub;
    if (!publicKey) throw new Error("Public key not found");
    return this.gun.get(`~${publicKey}`).get(this.appPrefix).get(path);
  }

  protected async ensureAuthenticated(): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }
  }

  protected areObjectsEquivalent(obj1: any, obj2: any): boolean {
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
    const keys1 = Object.keys(obj1).filter(k => k !== '#' && k !== '_').sort();
    const keys2 = Object.keys(obj2).filter(k => k !== '#' && k !== '_').sort();

    if (keys1.length !== keys2.length) return false;
    if (!keys1.every((key, index) => key === keys2[index])) return false;

    return keys1.every(key => this.areObjectsEquivalent(obj1[key], obj2[key]));
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

              // Se troviamo solo riferimenti, consideriamo i dati non ancora salvati
              if (typeof savedData === 'object' && Object.keys(savedData).every(key => key === '#' || key === '_')) {
                resolve(false);
                return;
              }

              const cleanedSaved = this.cleanGunMetadata(savedData);
              const isEquivalent = this.areObjectsEquivalent(cleanedSaved, dataToSave);
              resolve(isEquivalent);
            }
          };

          node.on(handler);

          // Timeout di sicurezza
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              node.off();
              resolve(false);
            }
          }, 5000);
        }, 3000);
      });
    };

    const clearExistingData = async (): Promise<void> => {
      return new Promise((resolve) => {
        const node = this.getPrivateNode(path);
        let resolved = false;

        const clearHandler = (ack: any) => {
          if (!resolved) {
            resolved = true;
            setTimeout(resolve, 2000);
          }
        };

        node.put(null, clearHandler);

        // Timeout di sicurezza
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }, 5000);
      });
    };

    while (attempts < maxRetries) {
      try {
        // Prima puliamo i dati esistenti
        await clearExistingData();

        // Poi salviamo i nuovi dati
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

        // Attendiamo un tempo più lungo per la propagazione
        await new Promise(resolve => setTimeout(resolve, Math.max(5000, 3000 * (attempts + 1))));

        // Verifichiamo più volte per essere sicuri
        let verificationAttempts = 0;
        const maxVerificationAttempts = 3;

        while (verificationAttempts < maxVerificationAttempts) {
          if (await verifyData()) {
            return;
          }
          verificationAttempts++;
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        attempts++;
        if (attempts < maxRetries) {
          // Aumentiamo significativamente il tempo di attesa tra i tentativi
          await new Promise(resolve => setTimeout(resolve, Math.max(8000, 5000 * attempts)));
        }
      } catch (error) {
        console.error(`Tentativo ${attempts + 1} fallito:`, error);
        lastError = error as Error;
        attempts++;
        if (attempts < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.max(8000, 5000 * attempts)));
        }
      }
    }

    throw new Error(`Impossibile salvare i dati dopo ${maxRetries} tentativi${lastError ? `: ${lastError.message}` : ''}`);
  }
}
