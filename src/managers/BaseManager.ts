import { IGunInstance, IGunUserInstance, ISEAPair } from "gun";

/**
 * Classe base astratta per i manager che utilizzano Gun
 */
export abstract class BaseManager<T> {
  protected gun: IGunInstance;
  protected user: IGunUserInstance;
  protected abstract storagePrefix: string;
  protected APP_KEY_PAIR: ISEAPair;

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
  protected async savePrivateData(data: T, path: string = ""): Promise<void> {
    await this.ensureAuthenticated();

    const processedData = Array.isArray(data) 
      ? { 
          _isArray: true,
          length: data.length,
          ...data.reduce((acc: any, item: any, index: number) => {
            acc[index] = item;
            return acc;
          }, {})
        }
      : data;

    const maxRetries = 3;
    let currentRetry = 0;

    const saveWithRetry = async (): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        let resolved = false;
        let verifyAttempts = 0;
        const maxVerifyAttempts = 5;

        const cleanup = () => {
          clearTimeout(timeoutId);
          clearInterval(verifyInterval);
        };

        const timeoutId = setTimeout(() => {
          if (!resolved) {
            cleanup();
            resolved = true;
            reject(new Error("Operation timed out"));
          }
        }, 30000);

        const node = this.user
          .get("private")
          .get(this.storagePrefix)
          .get(path);

        const verifyData = () => {
          if (resolved) return;
          verifyAttempts++;

          // Funzione per caricare i dati referenziati
          const loadReferencedData = async (ref: string): Promise<any> => {
            return new Promise((resolve) => {
              this.gun.get(ref).once((data: any) => {
                resolve(this.cleanGunMetadata(data));
              });
            });
          };

          // Funzione per caricare tutti i riferimenti in un oggetto
          const loadAllReferences = async (obj: any): Promise<any> => {
            if (!obj) return obj;
            if (typeof obj !== 'object') return obj;

            const result: any = Array.isArray(obj) ? [] : {};
            const promises: Promise<any>[] = [];

            for (const key in obj) {
              if (key === '_' || key === '#') continue;
              
              if (obj[key] && typeof obj[key] === 'object' && obj[key]['#']) {
                promises.push(
                  loadReferencedData(obj[key]['#']).then(data => {
                    result[key] = data;
                  })
                );
              } else {
                result[key] = obj[key];
              }
            }

            await Promise.all(promises);
            return result;
          };

          node.once(async (savedData: any) => {
            if (resolved) return;

            try {
              const cleanedData = this.cleanGunMetadata(savedData);
              const resolvedData = await loadAllReferences(cleanedData);
              
              console.log("Verifying data:", {
                attempt: verifyAttempts,
                isNull: processedData === null,
                savedDataExists: !!savedData,
                path: path,
                cleanedData: JSON.stringify(cleanedData),
                resolvedData: JSON.stringify(resolvedData),
                processedData: JSON.stringify(processedData),
                matches: this.compareData(resolvedData, processedData)
              });

              if (processedData === null) {
                if (this.isNullOrEmpty(resolvedData)) {
                  cleanup();
                  resolved = true;
                  resolve();
                  return;
                }
              } else if (savedData) {
                if (processedData._isArray) {
                  const isValid = this.compareArrayData(resolvedData, processedData);
                  if (isValid) {
                    cleanup();
                    resolved = true;
                    resolve();
                    return;
                  }
                } else if (this.compareData(resolvedData, processedData)) {
                  cleanup();
                  resolved = true;
                  resolve();
                  return;
                }
              }

              if (verifyAttempts >= maxVerifyAttempts) {
                cleanup();
                resolved = true;
                reject(new Error("Failed to verify data save"));
              }
            } catch (error) {
              console.error("Error during data verification:", error);
              if (verifyAttempts >= maxVerifyAttempts) {
                cleanup();
                resolved = true;
                reject(new Error("Failed to verify data save"));
              }
            }
          });
        };

        const verifyInterval = setInterval(verifyData, 3000);

        node.put(processedData, (ack: any) => {
          if (resolved) return;

          if (ack && (ack as any).err) {
            cleanup();
            resolved = true;
            reject(new Error((ack as any).err));
            return;
          }

          setTimeout(verifyData, 2000);
        });
      });
    };

    while (currentRetry < maxRetries) {
      try {
        await saveWithRetry();
        return;
      } catch (error) {
        currentRetry++;
        console.error(`Save attempt ${currentRetry} failed:`, error);
        await this.ensureAuthenticated();
        
        if (currentRetry === maxRetries) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, currentRetry) * 3000));
      }
    }
  }

  private compareArrayData(saved: any, processed: any): boolean {
    if (!saved || !processed || !processed._isArray) return false;
    
    // Verifica che sia un array
    if (!processed._isArray || typeof processed.length !== 'number') return false;
    
    // Verifica la lunghezza
    if (saved.length !== processed.length) return false;
    
    // Verifica ogni elemento
    for (let i = 0; i < processed.length; i++) {
      if (!this.compareData(saved[i], processed[i])) return false;
    }
    
    return true;
  }

  private compareData(a: any, b: any): boolean {
    // Gestione speciale per null/undefined
    if (a === null || a === undefined) return b === null || b === undefined;
    if (b === null || b === undefined) return false;
    
    // Se uno dei due è null e l'altro è un oggetto vuoto, consideriamoli uguali
    if ((a === null && Object.keys(b).length === 0) || 
        (b === null && Object.keys(a).length === 0)) {
      return true;
    }

    // Se non sono dello stesso tipo, non sono uguali
    if (typeof a !== typeof b) return false;

    // Per i tipi primitivi, confronto diretto
    if (typeof a !== 'object') return a === b;

    // Gestione speciale per array
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, idx) => this.compareData(val, b[idx]));
    }

    const keysA = Object.keys(a).filter(k => k !== '_' && k !== '_isArray');
    const keysB = Object.keys(b).filter(k => k !== '_' && k !== '_isArray');

    // Se hanno un numero diverso di chiavi, non sono uguali
    if (keysA.length !== keysB.length) {
      // Caso speciale: se stiamo confrontando con null/oggetto vuoto
      if ((keysA.length === 0 && !b) || (keysB.length === 0 && !a)) {
        return true;
      }
      return false;
    }

    // Confronta ricorsivamente tutte le chiavi
    return keysA.every(key => {
      if (!b.hasOwnProperty(key)) return false;
      return this.compareData(a[key], b[key]);
    });
  }

  /**
   * Salva i dati in modo pubblico
   */
  protected async savePublicData(data: any, path: string = ""): Promise<void> {
    if (!this.user.is) {
      throw new Error("User not authenticated");
    }

    const publicKey = this.user.is.pub;
    if (!publicKey) {
      throw new Error("Public key not found");
    }

    return new Promise((resolve, reject) => {
      let resolved = false;
      this.gun
        .get(`~${publicKey}`)
        .get("public")
        .get(this.storagePrefix)
        .get(path)
        .put(data, (ack: any) => {
          if (resolved) return;
          resolved = true;
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });

      // Timeout di sicurezza
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error("Operation timed out"));
        }
      }, 5000);
    });
  }

  /**
   * Pulisce i metadati di Gun da un oggetto
   */
  protected cleanGunMetadata<T>(data: any): T {
    if (!data) return data;
    
    // Se è un oggetto, rimuovi i metadati di Gun
    if (typeof data === 'object') {
      const cleaned = { ...data };
      delete cleaned._;
      return cleaned;
    }
    
    return data;
  }

  /**
   * Recupera i dati privati
   */
  protected async getPrivateData(path: string = ""): Promise<T | null> {
    // Verifichiamo l'autenticazione in modo più robusto
    await this.ensureAuthenticated();

    const maxRetries = 3;
    let currentRetry = 0;

    const getWithRetry = async (): Promise<T | null> => {
      return new Promise((resolve, reject) => {
        let resolved = false;
        let attempts = 0;
        const maxAttempts = 3;

        const cleanup = () => {
          clearTimeout(timeoutId);
          clearInterval(retryInterval);
        };

        const timeoutId = setTimeout(() => {
          if (!resolved) {
            cleanup();
            resolved = true;
            resolve(null);
          }
        }, 20000);

        const node = this.user
          .get("private")
          .get(this.storagePrefix)
          .get(path);

        const attemptGet = () => {
          if (resolved) return;
          attempts++;

          node.once((data: any) => {
            if (resolved) return;

            if (data) {
              cleanup();
              resolved = true;

              if (data._isArray && typeof data.length === 'number') {
                const arr = [];
                for (let i = 0; i < data.length; i++) {
                  if (data[i] !== undefined) {
                    arr.push(this.cleanGunMetadata(data[i]));
                  }
                }
                resolve(arr as T);
              } else {
                resolve(this.cleanGunMetadata(data));
              }
            } else if (attempts >= maxAttempts) {
              cleanup();
              resolved = true;
              resolve(null);
            }
          });
        };

        const retryInterval = setInterval(attemptGet, 2000);
        attemptGet();
      });
    };

    while (currentRetry < maxRetries) {
      try {
        const result = await getWithRetry();
        if (result !== null) {
          return result;
        }
        currentRetry++;

        // Riautentichiamo l'utente se necessario
        await this.ensureAuthenticated();

      } catch (error) {
        console.error(`Get attempt ${currentRetry + 1} failed:`, error);
        currentRetry++;
        
        // Riautentichiamo l'utente se necessario
        await this.ensureAuthenticated();
      }

      if (currentRetry === maxRetries) {
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, Math.pow(2, currentRetry) * 1000));
    }

    return null;
  }

  /**
   * Recupera i dati pubblici
   */
  protected async getPublicData(publicKey: string, path: string = ""): Promise<any> {
    return new Promise((resolve) => {
      let resolved = false;
      this.gun
        .get(`~${publicKey}`)
        .get("public")
        .get(this.storagePrefix)
        .get(path)
        .once((data: any) => {
          if (resolved) return;
          resolved = true;
          resolve(this.cleanGunMetadata(data));
        });

      // Timeout di sicurezza
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 5000);
    });
  }

  /**
   * Elimina i dati privati
   */
  protected async deletePrivateData(path: string = ""): Promise<void> {
    // Verifichiamo l'autenticazione
    await this.ensureAuthenticated();

    const maxRetries = 3;
    let currentRetry = 0;

    const deleteWithRetry = async (): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        let resolved = false;
        let verifyAttempts = 0;
        const maxVerifyAttempts = 5;

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

        const node = this.user
          .get("private")
          .get(this.storagePrefix)
          .get(path);

        // Funzione per verificare l'eliminazione
        const verifyDelete = () => {
          if (resolved) return;
          verifyAttempts++;

          node.once((data: any) => {
            if (resolved) return;

            console.log("Verifying deletion:", {
              attempt: verifyAttempts,
              hasData: !!data,
              path: path
            });

            // Se i dati sono null o undefined, l'eliminazione è riuscita
            if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
              cleanup();
              resolved = true;
              resolve();
              return;
            }

            if (verifyAttempts >= maxVerifyAttempts) {
              cleanup();
              resolved = true;
              reject(new Error("Failed to verify data deletion"));
            }
          });
        };

        // Verifica periodica
        const verifyInterval = setInterval(verifyDelete, 3000);

        // Eliminazione dati
        node.put(null, (ack: any) => {
          if (resolved) return;

          if (ack && (ack as any).err) {
            cleanup();
            resolved = true;
            reject(new Error((ack as any).err));
            return;
          }

          // Attendiamo un momento prima di iniziare la verifica
          setTimeout(verifyDelete, 1000);
        });
      });
    };

    while (currentRetry < maxRetries) {
      try {
        await deleteWithRetry();
        return;
      } catch (error) {
        currentRetry++;
        console.error(`Delete attempt ${currentRetry} failed:`, error);
        
        // Riautentichiamo l'utente se necessario
        await this.ensureAuthenticated();
        
        if (currentRetry === maxRetries) {
          throw error;
        }
        
        // Attesa esponenziale tra i tentativi
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, currentRetry) * 2000));
      }
    }
  }

  /**
   * Elimina i dati pubblici
   */
  protected async deletePublicData(path: string = ""): Promise<void> {
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
        .get(path);

      // Funzione per verificare l'eliminazione
      const verifyDelete = () => {
        if (resolved) return;
        verifyAttempts++;

        node.once((data: any) => {
          if (resolved) return;

          console.log("Verifying public data deletion:", {
            attempt: verifyAttempts,
            hasData: !!data,
            path: path
          });

          // Se i dati sono null o undefined, l'eliminazione è riuscita
          if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
            cleanup();
            resolved = true;
            resolve();
            return;
          }

          if (verifyAttempts >= maxVerifyAttempts) {
            cleanup();
            resolved = true;
            reject(new Error("Failed to verify public data deletion"));
          }
        });
      };

      // Verifica periodica
      const verifyInterval = setInterval(verifyDelete, 3000);

      // Eliminazione dati
      node.put(null, (ack: any) => {
        if (resolved) return;
        
        if (ack && (ack as any).err) {
          cleanup();
          resolved = true;
          reject(new Error((ack as any).err));
          return;
        }

        // Attendiamo un momento prima di iniziare la verifica
        setTimeout(verifyDelete, 1000);
      });
    });
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

  /**
   * Pulisce le risorse
   */
  public cleanup(): void {
    if (this.user) {
      this.user.leave();
    }
  }

  /**
   * Verifica e assicura che l'utente sia autenticato
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.user.is || !this.user._.sea) {
      console.log("User not authenticated, attempting to re-authenticate...");
      
      // Attendiamo un momento prima di tentare la riautenticazione
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!this.user.is || !this.user._.sea) {
        throw new Error("User not authenticated and re-authentication failed");
      }
    }
  }

  protected isNullOrEmpty(data: any): boolean {
    if (data === null || data === undefined) return true;
    if (typeof data === 'object' && Object.keys(data).filter(k => k !== '_').length === 0) return true;
    return false;
  }
}
