import { IGunChain, IGunInstance, IGunUserInstance, ISEAPair } from "gun";

export abstract class GunStorage<T> {
  protected gun: IGunInstance;
  protected user: IGunUserInstance;
  protected abstract storagePrefix: string;
  private appPrefix: string;
  protected APP_KEY_PAIR: ISEAPair;
  protected nodesPath: { private: string; public: string } = {
    private: "",
    public: "",
  };

  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    this.gun = gun;
    this.user = this.gun.user();
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
        .get(this.appPrefix)
        .get(path || "");

      node.put(null, (ack: any) => {
        if (ack.err) {
          cleanup();
          reject(new Error(ack.err));
        } else {
          verifyInterval = setInterval(async () => {
            verifyAttempts++;
            if (verifyAttempts > maxVerifyAttempts) {
              cleanup();
              reject(
                new Error("Data verification failed - max attempts reached")
              );
              return;
            }

            node.once((data: any) => {
              if (data === null) {
                cleanup();
                if (!resolved) {
                  resolved = true;
                  resolve();
                }
              } else {
                console.warn(
                  `Attempt ${verifyAttempts}: Data still exists, waiting...`
                );
              }
            });
          }, 2000);
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
    this.nodesPath.private = `private/${this.appPrefix}/${path}`.replace(
      /\/+/g,
      "/"
    );
  }


  protected setPublicNodePath(path: string): void {
    this.nodesPath.public = `public/${this.appPrefix}/${path}`.replace(
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
}
