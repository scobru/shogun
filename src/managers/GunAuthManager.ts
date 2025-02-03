import Gun, { IPolicy } from "gun";
import "gun/sea";
import { Wallet } from "ethers";
import type { GunKeyPair } from "../interfaces/GunKeyPair";
import type { GunAck } from "../interfaces/Gun";
import type { ActivityPubKeys } from "../interfaces/ActivityPubKeys";

const SEA = Gun.SEA;

interface Policy {
  "*": string;
  "+": string;
}

export class GunAuthManager {
  private gun: any;
  private user: any;
  private isAuthenticating = false;
  private APP_KEY_PAIR: { pub: string; priv: string };

  constructor(gunOptions: any, APP_KEY_PAIR: any) {
    this.gun = Gun(gunOptions);
    this.APP_KEY_PAIR = APP_KEY_PAIR;
    this.user = this.gun.user();
  }

  private async waitForAuth(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }

  public async checkUser(username: string, password: string): Promise<string> {
    return this.gun.get(`~@${username}`).once((user: any) => {
      if (user) {
        throw new Error("Username already taken");
      } else {
        this.user.create(username, password, ({ err, pub }: any) => {
          if (err) {
            throw new Error(err);
          } else {
            return pub;
          }
        });
      }
    });
  }

  public async onCreateSuccess(
    pub: string,
    username: string,
    password: string
  ) {
    const policy: Policy[] = [
      { "*": "profiles", "+": "*" },
    ];

    const expiresAt = Date.now() + 60 * 60 * 1000 * 2;

    const certificate = await SEA.certify(
      [pub],
      policy as IPolicy[],
      this.APP_KEY_PAIR,
      () => {},
      { expiry: expiresAt }
    );

    this.gun
      .get(`~${this.APP_KEY_PAIR?.pub as string}`)
      .get("profiles")
      .get(pub)
      .put({ username }, null, {
        opt: { cert: certificate },
      });

    await this.login(username, password);

    return this.user._.sea;
  }

  public async createAccount(alias: string, passphrase: string): Promise<GunKeyPair> {
    const pub = await this.checkUser(alias, passphrase);

    if (!pub) {
      throw new Error("User creation failed");
    }

    const userPair = await this.onCreateSuccess(pub, alias, passphrase);

    if (!userPair) {
      throw new Error("User creation failed");
    }

    if (this.user._.sea) {
      this.isAuthenticating = true;
      return userPair;
    } else {
      throw new Error("User creation failed");
    }
  }

  public async login(alias: string, passphrase: string): Promise<string> {
    try {
      if (this.isAuthenticating) {
        await this.waitForAuth();
        this.user.leave();
        await this.waitForAuth();
      }

      this.isAuthenticating = true;
      console.log("Starting login process for:", alias);

      return new Promise<string>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.isAuthenticating = false;
          this.user.leave();
          reject(new Error("Authentication timeout"));
        }, 30000);

        this.user.auth(alias, passphrase, (ack: any) => {
          try {
            if (ack.err) {
              this.isAuthenticating = false;
              if (ack.err.includes("being created")) {
                setTimeout(async () => {
                  try {
                    const result = await this.login(alias, passphrase);
                    resolve(result);
                  } catch (error) {
                    reject(error);
                  }
                }, 2000);
                return;
              }
              reject(new Error(ack.err));
              return;
            }

            if (!this.user.is?.pub) {
              this.isAuthenticating = false;
              reject(new Error("Login failed: public key not found"));
              return;
            }

            console.log("Login completed successfully");
            this.isAuthenticating = false;
            resolve(this.user.is.pub);
          } catch (error) {
            reject(error);
          } finally {
            clearTimeout(timeoutId);
          }
        });
      });
    } catch (error) {
      this.isAuthenticating = false;
      this.user.leave();
      throw error;
    }
  }

  public logout(): void {
    if (this.user.is) {
      this.user.leave();
    }
    this.isAuthenticating = false;
  }

  public getPublicKey(): string {
    if (!this.user.is?.pub) {
      throw new Error("User not authenticated");
    }
    return this.user.is.pub;
  }

  public getCurrentUserKeyPair(): GunKeyPair {
    return this.user._.sea;
  }

  public getGun(): any {
    return this.gun;
  }

  public getUser(): any {
    return this.gun.user();
  }

  public async exportGunKeyPair(): Promise<string> {
    if (!this.user._.sea) {
      throw new Error("User not authenticated");
    }
    return JSON.stringify(this.user._.sea);
  }

  public async importGunKeyPair(keyPairJson: string): Promise<string> {
    try {
      const keyPair = JSON.parse(keyPairJson);

      if (!keyPair.pub || !keyPair.priv || !keyPair.epub || !keyPair.epriv) {
        throw new Error("Invalid key pair");
      }

      return new Promise((resolve, reject) => {
        this.user.auth(keyPair, (ack: any) => {
          if (ack.err) {
            reject(new Error(`Authentication error: ${ack.err}`));
            return;
          }
          if (!this.user.is?.pub) {
            reject(new Error("Authentication failed: public key not found"));
            return;
          }
          resolve(this.user.is.pub);
        });
      });
    } catch (error) {
      throw new Error(
        `Error importing key pair: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  public async updateProfile(displayName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.user.is?.pub) {
        return reject(new Error("Utente non autenticato"));
      }

      this.gun
        .get(`~${this.APP_KEY_PAIR.pub}`)
        .get("profiles")
        .get(this.getPublicKey())
        .put(
          { displayName },
          (ack: GunAck) => {
            if (ack.err) {
              reject(new Error(`Errore aggiornamento profilo: ${ack.err}`));
            } else {
              resolve();
            }
          },
          {
            opt: {
              cert: SEA.certify(
                [this.getPublicKey()],
                [{ "*": "profiles", "+": "*" }] as IPolicy[],
                this.APP_KEY_PAIR,
                () => {},
                { expiry: Date.now() + 60 * 60 * 1000 * 2 }
              ),
            },
          }
        );
    });
  }

  public async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const username = await this.getUsername();

        await this.login(username, oldPassword);

        this.user.auth(
          this.user._.sea,
          (ack: GunAck) => {
            if (ack.err) {
              reject(new Error(`Errore cambio password: ${ack.err}`));
            } else {
              resolve();
            }
          },
          {
            change: newPassword,
          }
        );
      } catch (error) {
        reject(
          new Error(
            `Errore durante il cambio password: ${
              error instanceof Error ? error.message : "Errore sconosciuto"
            }`
          )
        );
      }
    });
  }

  private async getUsername(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.user.get("alias").once((username: string) => {
        username
          ? resolve(username)
          : reject(new Error("Username non trovato"));
      });
    });
  }

  public async saveWalletToGun(
    wallet: Wallet,
    publicKey: string
  ): Promise<void> {
    console.log(`💾 Saving wallet for ${publicKey}:`, wallet);

    return new Promise((resolve, reject) => {
      let hasResolved = false;

      const walletData = {
        address: wallet.address,
        entropy: (wallet as any).entropy,
        timestamp: Date.now(),
      };

      console.log("📦 Wallet data to save:", walletData);

      const node = this.gun.get("wallets").get(publicKey);

      node.get("address").put(walletData.address);
      node.get("entropy").put(walletData.entropy);
      node.get("timestamp").put(walletData.timestamp);

      node.on((data: any) => {
        console.log("📥 Data received after save:", data);
        if (data && data.address === wallet.address && !hasResolved) {
          console.log("✅ Wallet saved successfully");
          hasResolved = true;
          resolve();
        }
      });

      setTimeout(() => {
        if (!hasResolved) {
          console.error("⌛ Timeout saving wallet");
          reject(new Error("Timeout saving wallet"));
        }
      }, 25000);
    });
  }

  /**
   * Salva i dati privati dell'utente
   */
  public async savePrivateData(data: any, path: string): Promise<void> {
    if (!this.user.is) {
      throw new Error("Utente non autenticato");
    }

    return new Promise((resolve, reject) => {
      this.user.get('profile').get('private').get(path).put(data, (ack: GunAck) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Recupera i dati privati dell'utente
   */
  public async getPrivateData(path: string): Promise<any> {
    if (!this.user.is) {
      throw new Error("Utente non autenticato");
    }

    return new Promise((resolve, reject) => {
      this.user.get('profile').get('private').get(path).once((data: any) => {
        if (!data) {
          resolve(null);
          return;
        }
        resolve(data);
      });
    });
  }

  /**
   * Salva i dati pubblici dell'utente
   */
  public async savePublicData(data: any, path: string): Promise<void> {
    if (!this.user.is) {
      throw new Error("Utente non autenticato");
    }

    return new Promise((resolve, reject) => {
      this.gun.get('profiles').get(this.user.is.pub).get(path).put(
        data,
        (ack: GunAck) => {
          if (ack.err) {
            reject(new Error(ack.err));
            return;
          }
          resolve();
        },
        {
          opt: {
            cert: SEA.certify(
              [this.getPublicKey()],
              [{ "*": "profiles", "+": "*" }] as IPolicy[],
              this.APP_KEY_PAIR,
              () => {},
              { expiry: Date.now() + 60 * 60 * 1000 * 2 }
            ),
          },
        }
      );
    });
  }

  /**
   * Recupera i dati pubblici dell'utente
   */
  public async getPublicData(publicKey: string, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.gun.get('profiles').get(publicKey).get(path).once((data: any) => {
        if (!data) {
          resolve(null);
          return;
        }
        resolve(data);
      });
    });
  }

  /**
   * Salva il wallet dell'utente
   */
  public async saveWallet(wallet: Wallet): Promise<void> {
    const walletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      entropy: (wallet as any).entropy,
      timestamp: Date.now(),
    };

    await this.savePrivateData(walletData, 'wallet');
    await this.savePublicData({ address: wallet.address }, 'wallet');
  }

  /**
   * Recupera il wallet dell'utente
   */
  public async getWallet(): Promise<Wallet | null> {
    const walletData = await this.getPrivateData('wallet');
    if (!walletData || !walletData.privateKey) return null;

    const wallet = new Wallet(walletData.privateKey);
    if (walletData.entropy) {
      Object.defineProperty(wallet, "entropy", {
        value: walletData.entropy,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return wallet;
  }

  /**
   * Salva le chiavi ActivityPub
   */
  public async saveActivityPubKeys(keys: ActivityPubKeys): Promise<void> {
    const privateData = {
      privateKey: keys.privateKey,
      createdAt: keys.createdAt,
    };

    const publicData = {
      publicKey: keys.publicKey,
      createdAt: keys.createdAt,
    };

    await this.savePrivateData(privateData, 'activityPubKeys');
    await this.savePublicData(publicData, 'activityPubKeys');
  }

  /**
   * Recupera le chiavi ActivityPub
   */
  public async getActivityPubKeys(): Promise<ActivityPubKeys | null> {
    const privateData = await this.getPrivateData('activityPubKeys');
    const publicData = await this.getPublicData(this.getPublicKey(), 'activityPubKeys');

    if (!privateData || !publicData) return null;

    return {
      privateKey: privateData.privateKey,
      publicKey: publicData.publicKey,
      createdAt: privateData.createdAt || publicData.createdAt || Date.now(),
    };
  }

  public async deletePrivateData(path: string): Promise<void> {
    await this.gun.get('profiles').get(this.getPublicKey()).get('private').get(path).put(null);
  }

  public async deletePublicData(path: string): Promise<void> {
    await this.gun.get('profiles').get(this.getPublicKey()).get(path).put(null);
  }
} 
