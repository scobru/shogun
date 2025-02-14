import Gun from "gun";

import "gun/sea";
import "gun/lib/radix";
import "gun/lib/radisk";
// import 'gun/lib/store';
import "gun/lib/rindexed";

import { FiregunUser, Ack, common } from "./common";
// @ts-ignore
import { IGunChainReference } from "gun/types/chain";
// @ts-ignore
import { IGunCryptoKeyPair } from "gun/types/types";
// @ts-ignore
import { IGunStatic } from "gun/types/static";

import { EthereumManager } from "../managers/EthereumManager";

import { ActivityPubManager } from "../managers/ActivityPubManager";
import { ActivityPubKeys } from "../interfaces/ActivityPubKeys";
import { Wallet } from "ethers";
import { WebAuthnManager } from "../managers/WebAuthnManager";
import { WalletManager } from "../managers/WalletManager";
import { WalletData } from "../interfaces/WalletResult";
import { StealthKeyPair } from "../interfaces/StealthKeyPair";
import { StealthKeys } from "../interfaces/StealthKeyPair";
import { StealthManager } from "../managers/StealthManager";

// Aggiungi l'interfaccia per il risultato di SEA.derive
interface SEAKeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}

function randomAlphaNumeric(length: number): string {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export default class Firegun {
  prefix: string;
  dbname: string;
  gun: IGunChainReference;
  Gun: IGunStatic;
  peers: string[];
  user: FiregunUser;
  ev: {
    [key: string]: {
      handler: any;
    };
  };

  activityPubManager: ActivityPubManager;
  ethereumManager: EthereumManager;
  webAuthnManager: WebAuthnManager;
  walletManager: WalletManager;
  stealthManager: StealthManager;
  /**
   *
   * --------------------------------------
   * Create Firegun Instance
   *
   * @param peers list of gun Peers, default : []
   * @param dbname dbName, default : "fireDB"
   * @param localstorage whether to use localstorage or not (indexedDB)
   * @param prefix node prefix, default : "" (no prefix)
   * @param axe join axe network, default : false
   * @param port multicast port, default : 8765
   * @param gunInstance use an existing gunDB instance, default : null
   */
  constructor(option?: {
    peers?: string[];
    dbname?: string;
    localstorage?: boolean;
    prefix?: string;
    axe?: boolean;
    port?: number;
    gunInstance?: IGunChainReference | null;
  }) {
    if (option) {
      (option.peers = option.peers || []),
        (option.dbname = option.dbname || "fireDB"),
        (option.localstorage = option.localstorage || false),
        (option.prefix = option.prefix || ""),
        (option.axe = option.axe || false),
        (option.port = option.port || 8765),
        (option.gunInstance = option.gunInstance || null);
    }

    this.prefix = option?.prefix || "";
    this.peers = option?.peers || [];
    this.dbname = option?.dbname || "fireDB";

    this.activityPubManager = new ActivityPubManager();
    this.ethereumManager = new EthereumManager();
    this.webAuthnManager = new WebAuthnManager();
    this.walletManager = new WalletManager();
    this.stealthManager = new StealthManager();
    if (option?.gunInstance) {
      this.gun = option.gunInstance;
    } else {
      // @ts-ignore
      this.gun = Gun({
        file: option?.dbname,
        localStorage: option?.localstorage,
        axe: option?.axe,
        multicast: {
          port: option?.port,
        },
        peers: option?.peers,
      });
    }

    // @ts-ignore
    this.Gun = Gun;

    // Auto Login

    this.user = {
      alias: "",
      pair: {
        priv: "",
        pub: "",
        epriv: "",
        epub: "",
      },
    };
    if (typeof localStorage !== "undefined") {
      let user = localStorage.getItem("fg.keypair");
      user = user || "";
      if (user)
        try {
          let autoLoginUser = JSON.parse(user);
          this.loginPair(autoLoginUser.pair, autoLoginUser.alias).then(
            async () => {
              console.log("Checking Certificate...");
              try {
                await this.userGet("chat-cert");
                console.log("Checking Certificate...✔");
              } catch (error) {
                common.generatePublicCert(this);
              }
            }
          );
        } catch (error) {}
    }

    this.ev = {};
  }
  /**
   * Wait in ms
   * @param ms duration of timeout in ms
   * @returns
   */
  async _timeout(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Delete On Subscription
   * @param ev On subscription name, default : "default"
   */
  async Off(ev = "default") {
    if (this.ev[ev] && this.ev[ev].handler) {
      this.ev[ev].handler.off();
    } else {
      this.ev[ev] = {
        handler: null,
      };
    }
  }

  /**
   * Listen changes on path
   *
   * @param path node path
   * @param callback callback
   * @param prefix node prefix, default : ""
   */
  async Listen(
    path: string,
    callback: (result: { [key: string]: any } | string | undefined) => void,
    prefix: string = this.prefix
  ): Promise<void> {
    path = `${prefix}${path}`;
    let paths = path.split("/");
    let dataGun = this.gun;

    paths.forEach((path) => {
      dataGun = dataGun.get(path);
    });
    dataGun.map().once((s: any) => {
      callback(s);
    });
  }

  /**
   * New subscription on Path. When data on Path changed, callback is called.
   *
   * @param path node path
   * @param callback callback
   * @param ev On name as identifier, to be called by Off when finished
   * @param different Whether to fetch only differnce, or all of nodes
   * @param prefix node prefix, default : ""
   */
  async On(
    path: string,
    callback: (result: { [key: string]: any } | string | undefined) => void,
    ev: string = "default",
    different: boolean = true,
    prefix: string = this.prefix
  ): Promise<void> {
    path = `${prefix}${path}`;
    let paths = path.split("/");
    let dataGun = this.gun;

    paths.forEach((path) => {
      dataGun = dataGun.get(path);
    });

    let listenerHandler = (value: any, key: any, _msg: any, _ev: any) => {
      if (false) {
        console.log(key);
      }
      this.ev[ev] = {
        handler: _ev,
      };
      if (value) callback(JSON.parse(JSON.stringify(value)));
    };

    // @ts-ignore
    dataGun.on(listenerHandler, { change: different });
  }

  /**
   * ----------------------------------
   * Insert CONTENT-ADDRESSING Readonly Data.
   *
   * dev note : Sebenarnya bisa tambah lagi searchable path dengan RAD,
   * hanya saja RAD masih Memiliki BUG, dan tidak bekerja secara consistent
   * @param key must begin with #
   * @param data If object, it will be stringified automatically
   * @returns
   */
  async addContentAdressing(key: string, data: string | {}): Promise<Ack> {
    if (typeof data === "object") {
      data = JSON.stringify(data);
    }
    let hash = await this.Gun.SEA.work(data, null, undefined, {
      name: "SHA-256",
    });
    return new Promise((resolve) => {
      if (hash)
        this.gun
          .get(`${key}`)
          .get(hash)
          .put(<any>data, (s: any) => {
            resolve(<Ack>s);
          });
    });
  }

  /**
   * Generate Key PAIR from SEA module
   * @returns
   */
  async generatePair(): Promise<IGunCryptoKeyPair | undefined> {
    return new Promise(async (resolve) => {
      resolve(await this.Gun.SEA.pair());
    });
  }

  /**
   *
   * Login using SEA Pair Key, instead of using username and Password
   *
   * @param pair SEA Key Pair
   * @param alias if ommited, the value is Anonymous
   * @returns
   */
  async loginPair(
    pair: IGunCryptoKeyPair,
    alias: string = ""
  ): Promise<{ err: Error } | FiregunUser> {
    if (alias === "") {
      alias = pair.pub.slice(0, 8);
    }
    return new Promise((resolve, reject) => {
      this.gun.user().auth(pair as any, (s: any) => {
        if ("err" in s) {
          this.userLogout();
          reject(s.err);
        } else {
          this.user = {
            alias: alias,
            pair: s.sea,
          };
          resolve(this.user);
          localStorage.setItem("fg.keypair", JSON.stringify(this.user));
        }
      });
    });
  }

  /**
   *
   * Create a new user and Log him in
   *
   * @param alias
   * @param password
   * @param username
   * @returns
   */
  async userNew(
    alias: string,
    password: string,
    username?: string
  ): Promise<FiregunUser> {
    try {
      // Crea l'utente Gun di base
      const user = (await this.gun.user().create(
        alias,
        password
      )) as FiregunUser;

      if ("err" in user) {
        throw new Error(user.err);
      }

      // Login con le credenziali appena create
      await this.userLogin(alias, password, username);

      // Genera tutte le chiavi necessarie
      const [activityPub, ethereum, stealth, wallet, webAuthn] = await Promise.all([
        this.activityPubManager.createPair(),
        this.ethereumManager.generateCredentials(),
        this.stealthManager.createPair(),
        this.walletManager.createWallet(this.user.pair),
        this.webAuthnManager.authenticateUser('')
      ]);

      // Salva le chiavi nei nodi privati
      await Promise.all([
        this.userPut("activityPub", {
          publicKey: activityPub.publicKey,
          privateKey: activityPub.privateKey,
          createdAt: activityPub.createdAt
        }),
        this.userPut("ethereum", {
          address: ethereum.address,
          privateKey: ethereum.privateKey
        }),
        this.userPut("stealth", {
          pub: stealth.pub,
          priv: stealth.priv,
          epub: stealth.epub,
          epriv: stealth.epriv
        }),
        this.userPut("wallets/ethereum", [{
          address: wallet.address,
          privateKey: wallet.privateKey,
          entropy: wallet.entropy,
          timestamp: wallet.timestamp
        }])
      ]);

      // Salva le chiavi pubbliche
      await Promise.all([
        this.Put(`~${this.user.pair.pub}/activityPub`, {
          publicKey: activityPub.publicKey,
          createdAt: activityPub.createdAt
        }),
        this.Put(`~${this.user.pair.pub}/ethereum`, {
          address: ethereum.address
        }),
        this.Put(`~${this.user.pair.pub}/stealth`, {
          pub: stealth.pub,
          epub: stealth.epub
        }),
        this.Put(`~${this.user.pair.pub}/public/wallets/ethereum`, {
          address: wallet.address,
          timestamp: wallet.timestamp
        })
      ]);

      // Aggiorna la struttura dell'utente con i tipi corretti
      this.user = {
        ...this.user,
        rsa_pair: {
          priv: activityPub.privateKey,
          pub: activityPub.publicKey
        },
        wallet: {
          address: ethereum.address,
          privateKey: ethereum.privateKey
        },
        pair_stealth: {
          pub: stealth.pub,
          priv: stealth.priv,
          epub: stealth.epub,
          epriv: stealth.epriv
        },
        wallets: {
          ethereum: [{
            address: wallet.address,
            privateKey: wallet.privateKey,
            entropy: wallet.entropy,
            timestamp: wallet.timestamp
          }]
        }
      };

      return this.user;
    } catch (error) {
      console.error("Errore nella creazione dell'utente:", error);
      throw error;
    }
  }

  /**
   *
   * Log a user in
   *
   * @param alias
   * @param password
   * @param username
   * @returns
   */
  async userLogin(
    alias: string,
    password: string,
    username?: string
  ): Promise<FiregunUser> {
    try {
      const user = (await this.gun.user().auth(
        alias,
        password
      )) as FiregunUser;

      if ("err" in user) {
        throw new Error(user.err);
      }

      // Recupera tutte le chiavi
      const [
        activityPubKeysRaw,
        ethereumKeysRaw,
        stealthKeysRaw,
        walletsRaw,
        webauthnData
      ] = await Promise.all([
        this.userGet("activityPub"),
        this.userGet("ethereum"),
        this.userGet("stealth"),
        this.userGet("wallets/ethereum"),
        this.userGet("webauthn")
      ]);

      // Cast sicuro dei dati
      const activityPubKeys = activityPubKeysRaw as unknown as ActivityPubKeys;
      const ethereumKeys = ethereumKeysRaw as unknown as { address: string; privateKey: string };
      const stealthKeys = stealthKeysRaw as unknown as StealthKeyPair;
      const wallets = walletsRaw as unknown as WalletData[];

      // Aggiorna la struttura dell'utente
      this.user = {
        ...user,
        alias: username || alias,
        rsa_pair: activityPubKeys ? {
          priv: activityPubKeys.privateKey,
          pub: activityPubKeys.publicKey
        } : undefined,
        wallet: ethereumKeys ? {
          address: ethereumKeys.address,
          privateKey: ethereumKeys.privateKey
        } : undefined,
        pair_stealth: stealthKeys ? {
          pub: stealthKeys.pub,
          priv: stealthKeys.priv,
          epub: stealthKeys.epub,
          epriv: stealthKeys.epriv
        } : undefined,
        wallets: {
          ethereum: Array.isArray(wallets) ? wallets.map(w => ({
            address: w.address,
            privateKey: w.privateKey,
            entropy: w.entropy,
            timestamp: w.timestamp
          })) : []
        }
      };

      // Salva le credenziali per l'auto-login
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          "fg.keypair",
          JSON.stringify({
            pair: this.user.pair,
            alias: this.user.alias
          })
        );
      }

      return this.user;
    } catch (error) {
      console.error("Errore nel login:", error);
      throw error;
    }
  }

  /**
   * Log the user out
   */
  async userLogout() {
    this.gun.user().leave();
    this.user = {
      alias: "",
      pair: {
        priv: "",
        pub: "",
        epriv: "",
        epub: "",
      },
    };
  }

  /**
   *
   * Fetch data from userspace
   *
   * @param path node path
   * @param repeat time to repeat fetching before returning undefined
   * @param prefix Database Prefix
   * @returns
   */
  async userGet(
    path: string,
    repeat: number = 1,
    prefix: string = this.prefix
  ): Promise<
    | string
    | {
        [key: string]: {};
      }
    | {
        [key: string]: string;
      }
    | undefined
  > {
    if (this.user.alias) {
      path = `~${this.user.pair.pub}/${path}`;
      return await this.Get(path, repeat, prefix);
    } else {
      return undefined;
    }
  }

  /**
   * Load Multi Nested Data From Userspace
   * @param path node path
   * @param repeat time to repeat fetching before returning undefined
   * @param prefix Database Prefix
   * @returns
   */
  async userLoad(
    path: string,
    async = false,
    repeat: number = 1,
    prefix: string = this.prefix
  ): Promise<{
    data: { [s: string]: any };
    err: { path: string; err: string }[];
  }> {
    if (this.user.alias) {
      path = `~${this.user.pair.pub}/${path}`;
      return await this.Load(path, async, repeat, prefix);
    } else {
      return { data: {}, err: [{ path: path, err: "User not logged in" }] };
    }
  }

  /**
   *
   * Fetching data
   *
   * @param {string} path node path
   * @param {number} repeat time to repeat fetching before returning undefined
   * @param {string} prefix Database Prefix
   * @returns
   */
  async Get(
    path: string,
    repeat: number = 1,
    prefix: string = this.prefix
  ): Promise<
    undefined | string | { [key: string]: {} } | { [key: string]: string }
  > {
    let path0 = path;
    path = `${prefix}${path}`;
    let paths = path.split("/");
    let dataGun = this.gun;

    paths.forEach((path) => {
      dataGun = dataGun.get(path);
    });

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject({
          err: "timeout",
          ket: `TIMEOUT, Possibly Data : ${path} is corrupt`,
          data: {},
          "#": path,
        });
      }, 5000);
      dataGun.once(async (s: any) => {
        if (s) {
          s = JSON.parse(JSON.stringify(s));
          resolve(s);
        } else {
          if (repeat) {
            await this._timeout(1000);
            try {
              let data = await this.Get(path0, repeat - 1, prefix);
              resolve(data);
            } catch (error) {
              reject(error);
            }
          } else {
            reject({
              err: "notfound",
              ket: `Data Not Found,  Data : ${path} is undefined`,
              data: {},
              "#": path,
            });
          }
        }
      });
    });
  }

  /**
   *
   * Put data on userspace
   *
   * @param path
   * @param data
   * @returns
   */
  async userPut(
    path: string,
    data: string | { [key: string]: any },
    async = false,
    prefix = this.prefix
  ): Promise<{ data: Ack[]; error: Ack[] }> {
    return new Promise(async (resolve, reject) => {
      if (this.user.alias) {
        path = `~${this.user.pair.pub}/${path}`;
        resolve(await this.Put(path, data, async, prefix));
      } else {
        reject(<Ack>{ err: new Error("User Belum Login"), ok: undefined });
      }
    });
  }

  /**
   * Insert new Data into a node with a random key
   *
   * @param path
   * @param data
   * @param prefix
   * @param opt
   * @returns
   */
  async Set(
    path: string,
    data: { [key: string]: {} } | { [key: string]: string },
    async = false,
    prefix = this.prefix,
    opt: undefined | { opt: { cert: string } } = undefined
  ): Promise<{ data: Ack[]; error: Ack[] }> {
    return new Promise(async (resolve, reject) => {
      var token = randomAlphaNumeric(30);
      data.id = token;
      this.Put(`${path}/${token}`, data, async, prefix, opt)
        .then((s) => {
          resolve(s);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  /**
   * ----------------------------
   * Put Data to the gunDB Node
   *
   * @param path node path
   * @param data data to put
   * @param prefix node prefix
   * @param opt option (certificate)
   * @returns
   */
  async Put(
    path: string,
    data: null | string | { [key: string]: {} | string },
    async = false,
    prefix: string = this.prefix,
    opt: undefined | { opt: { cert: string } } = undefined
  ): Promise<{ data: Ack[]; error: Ack[] }> {
    path = `${prefix}${path}`;
    // if (async) { console.log(path) }
    let paths = path.split("/");
    let dataGun = this.gun;

    paths.forEach((path) => {
      dataGun = dataGun.get(path);
    });

    if (typeof data === "undefined") {
      data = { t: "_" };
    }
    let promises: Promise<Ack>[] = [];
    if (typeof data === "object") var obj: { data: Ack[]; error: Ack[] };
    obj = { data: [], error: [] };
    if (typeof data == "object")
      for (const key in data) {
        if (Object.hasOwnProperty.call(data, key)) {
          const element = data[
            key
          ] as "string | { [key: string]: string | {}; } | null";
          if (typeof element === "object") {
            delete data[key];
            if (async) {
              let s = await this.Put(`${path}/${key}`, element, async);
              obj.data = [...obj.data, ...s.data];
              obj.error = [...obj.error, ...s.error];
            } else {
              promises.push(
                this.Put(`${path}/${key}`, element, async).then((s) => {
                  obj.data = [...obj.data, ...s.data];
                  obj.error = [...obj.error, ...s.error];
                })
              );
            }
          }
        }
      }

    return new Promise((resolve, reject) => {
      Promise.allSettled(promises)
        .then(() => {
          // Handle Empty Object
          if (data && Object.keys(data).length === 0) {
            resolve(obj);
          } else {
            setTimeout(() => {
              obj.error.push({
                err: Error("TIMEOUT, Failed to put Data"),
                ok: path,
              });
              resolve(obj);
            }, 2000);
            dataGun.put(
              <any>data,
              (ack: any) => {
                if (typeof obj === "undefined") {
                  obj = { data: [], error: [] };
                }
                if (ack.err === undefined) {
                  obj.data.push(ack);
                } else {
                  obj.error.push({ err: Error(JSON.stringify(ack)), ok: path });
                }
                resolve(obj);
              },
              opt
            );
          }
        })
        .catch((s) => {
          obj.error.push({ err: Error(JSON.stringify(s)), ok: path });
          resolve(obj);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async purge(path: string) {
    return new Promise(async (resolve, reject) => {
      let data = await this.Get(path);
      let newData = JSON.parse(JSON.stringify(data));
      if (typeof newData === "object") {
        for (const key in newData) {
          if (key != "_" && key != ">" && key != "#" && key != ":")
            newData[key] = null;
        }
      }
      this.Put(path, newData)
        .then(() => {
          resolve("OK");
        })
        .catch((err) => {
          console.log(err);
          reject(JSON.stringify(err));
        });
    });
  }

  /**
   * Delete form user node
   *
   *
   * @param path path to delete
   * @param putNull
   *  - true (if you want to put null value)
   *  - false (if you want to delete the node with it's child)
   * @returns
   */
  async userDel(
    path: string,
    putNull: boolean = true
  ): Promise<{ data: Ack[]; error: Ack[] }> {
    return new Promise(async (resolve, reject) => {
      path = `~${this.user.pair.pub}/${path}`;
      this.Del(path, putNull)
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  /**
   * Delete node Path. It's not really deleted. It's just detached (tombstone). Data without parent.
   * @param path path to delete
   * @param putNull
   *  - true (if you want to put null value)
   *  - false (if you want to delete the node with it's child)
   */
  async Del(
    path: string,
    putNull: boolean = true,
    cert: string = ""
  ): Promise<{ data: Ack[]; error: Ack[] }> {
    return new Promise(async (resolve, reject) => {
      // var token = randomAlphaNumeric(50);
      try {
        let randomNode: any;

        let paths = path.split("/");
        let dataGun = this.gun;

        // Check if path is user
        if (putNull) {
          randomNode = null;
        } else {
          if (paths[0].indexOf("~") >= 0) {
            randomNode = this.gun.user().get("newNode").set({ t: "_" });
          } else {
            randomNode = this.gun.get("newNode").set({ t: "_" });
          }
        }

        paths.forEach((path) => {
          dataGun = dataGun.get(path);
        });

        if (cert) {
          dataGun.put(
            randomNode,
            (s: any) => {
              if (s.err === undefined) {
                resolve({
                  data: [
                    {
                      ok: "ok",
                      err: undefined,
                    },
                  ],
                  error: [],
                });
              } else {
                reject({
                  data: [
                    {
                      ok: "",
                      err: s.err,
                    },
                  ],
                  error: [],
                });
              }
            },
            {
              opt: {
                cert: cert,
              },
            }
          );
        } else {
          dataGun.put(randomNode, (s: any) => {
            if (s.err === undefined) {
              resolve({
                data: [
                  {
                    ok: "ok",
                    err: undefined,
                  },
                ],
                error: [],
              });
            } else {
              reject({
                data: [
                  {
                    ok: "",
                    err: s.err,
                  },
                ],
                error: [],
              });
            }
          });
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Load Multi Nested Data
   * @param path
   * @param repeat time to repeat fetching before returning undefined
   * @param prefix node Prefix
   * @returns
   */
  async Load(
    path: string,
    async = false,
    repeat: number = 1,
    prefix: string = this.prefix
  ): Promise<{
    data: { [s: string]: any };
    err: { path: string; err: string }[];
  }> {
    return new Promise((resolve, reject) => {
      let promises: Promise<any>[] = [];
      let obj: {
        data: { [s: string]: {} };
        err: { path: string; err: string }[];
      } = { data: {}, err: [] };
      this.Get(path, repeat, prefix)
        .then(async (s) => {
          if (typeof s === "object")
            for (const key in s) {
              if (key != "_" && key != "#" && key != ">") {
                var element;
                if (typeof s === "object") {
                  element = s[key];
                } else {
                  element = s;
                }
                if (typeof element === "object") {
                  if (async) {
                    try {
                      let s = await (<any>this.Load(`${path}/${key}`, async));
                      obj.data[key] = s;
                    } catch (error) {
                      (obj.err as any).push(error);
                    }
                  } else {
                    promises.push(
                      this.Load(`${path}/${key}`, async)
                        .then((s) => {
                          obj.data[key] = s;
                        })
                        .catch((s) => {
                          obj.err.push(s);
                        })
                    );
                  }
                } else {
                  obj.data[key] = element;
                }
              }
            }
          Promise.allSettled(promises)
            .then(() => {
              resolve(obj);
            })
            .catch((s) => {
              obj.err.push(s);
              resolve(obj);
            });
        })
        .catch((s) => {
          obj.err.push(s);
          resolve(obj);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  clearData() {
    var req = indexedDB.deleteDatabase(this.dbname);
    req.onsuccess = function () {
      console.log("Deleted database successfully");
      location.reload();
    };
    req.onerror = function () {
      console.log("Couldn't delete database");
    };
    req.onblocked = function () {
      console.log(
        "Couldn't delete database due to the operation being blocked"
      );
    };
    localStorage.removeItem("gun");
    localStorage.removeItem("fireDB");
    localStorage.removeItem("radata");
  }

  async loginWebAuthn(username: string): Promise<void> {
    const result = await this.webAuthnManager.authenticateUser(username);

    if (!result.success || !result.password) {
      throw new Error("Autenticazione WebAuthn fallita");
    }

    // Genera la coppia di chiavi Gun dalla password
    const pair = (await (this.Gun.SEA as any).derive({
      password: result.password,
      salt: username,
    })) as SEAKeyPair;

    // Effettua il login
    await this.loginPair(pair, username);
  }

  /**
   * Crea un nuovo utente usando WebAuthn
   * @param username Username dell'utente
   * @param deviceName Nome opzionale del dispositivo
   */
  async userNewWebAuthn(
    username: string,
    deviceName?: string
  ): Promise<FiregunUser> {
    try {
      // Genera le credenziali WebAuthn
      const webAuthnResult = await this.webAuthnManager.generateCredentials(
        username,
        deviceName
      );

      if (!webAuthnResult.success || !webAuthnResult.password) {
        throw new Error(
          webAuthnResult.error || "Registrazione WebAuthn fallita"
        );
      }

      // Usa la password generata da WebAuthn per creare l'utente Gun
      const user = await this.userNew(
        username,
        webAuthnResult.password,
        username
      );

      if ("err" in user) {
        throw new Error(user.err);
      }

      // Salva le credenziali WebAuthn
      if (webAuthnResult.credentialId && webAuthnResult.deviceInfo) {
        const webauthnData = {
          credentialId: webAuthnResult.credentialId,
          deviceInfo: webAuthnResult.deviceInfo,
          timestamp: Date.now(),
        };
        await this.userPut("webauthn", webauthnData);
      }

      return user as FiregunUser;
    } catch (error) {
      console.error("Errore nella registrazione WebAuthn:", error);
      throw error;
    }
  }

  /**
   * Effettua il login di un utente usando WebAuthn
   * @param username Username dell'utente
   */
  async userLoginWebAuthn(username: string): Promise<FiregunUser> {
    try {
      // Autentica l'utente con WebAuthn
      const webAuthnResult = await this.webAuthnManager.authenticateUser(
        username
      );

      if (!webAuthnResult.success || !webAuthnResult.password) {
        throw new Error(
          webAuthnResult.error || "Autenticazione WebAuthn fallita"
        );
      }

      // Usa la password generata da WebAuthn per il login Gun
      const user = await this.userLogin(
        username,
        webAuthnResult.password,
        username
      );

      if ("err" in user) {
        throw new Error(user.err);
      }

      // Aggiorna il timestamp dell'ultimo accesso
      if (webAuthnResult.credentialId) {
        const webauthnData = await this.userGet("webauthn");
        if (webauthnData && typeof webauthnData === "object") {
          const updatedData = {
            ...(webauthnData as object),
            lastUsed: Date.now(),
          };
          await this.userPut("webauthn", updatedData);
        }
      }

      return user as FiregunUser;
    } catch (error) {
      console.error("Errore nel login WebAuthn:", error);
      throw error;
    }
  }

  /**
   * Firma un messaggio usando WebAuthn
   * @param message Messaggio da firmare
   */
  async signMessageWebAuthn(message: string): Promise<ArrayBuffer> {
    if (!this.isAuthenticated()) {
      throw new Error("Utente non autenticato");
    }

    return this.webAuthnManager.signMessage(message);
  }

  /**
   * Verifica se l'utente è autenticato
   */
  private isAuthenticated(): boolean {
    return Boolean(this.user?.pair?.pub);
  }

  /**
   * Crea un nuovo wallet e lo salva nei nodi pubblici e privati
   */
  async createWallet(): Promise<WalletData> {
    try {
      if (!this.isAuthenticated()) {
        throw new Error("Utente non autenticato");
      }

      // Crea il wallet usando il WalletManager
      const wallet = await this.walletManager.createWallet(this.user.pair);

      // Inizializza la struttura dei wallet se non esiste
      if (!this.user.wallets) {
        this.user.wallets = { ethereum: [] };
      }

      // Aggiorna l'array dei wallet
      const updatedWallets = [...this.user.wallets.ethereum, wallet];
      
      // Salva il wallet completo nel nodo privato dell'utente
      await this.userPut("wallets/ethereum", updatedWallets);

      // Salva solo l'indirizzo nel nodo pubblico
      await this.Put(`~${this.user.pair.pub}/public/wallets/ethereum`, {
        address: wallet.address,
        timestamp: wallet.timestamp
      });

      // Aggiorna la struttura FiregunUser
      this.user.wallets.ethereum = updatedWallets;

      return wallet;
    } catch (error) {
      console.error("Errore nella creazione del wallet:", error);
      throw error;
    }
  }

  /**
   * Recupera i wallet dell'utente
   */
  async getWallets(): Promise<WalletData[]> {
    try {
      if (!this.isAuthenticated()) {
        throw new Error("Utente non autenticato");
      }

      const wallets = await this.userGet("wallets/ethereum");
      if (!wallets) {
        this.user.wallets = { ethereum: [] };
        return [];
      }

      // Converti in array se non lo è già
      const walletsArray = Array.isArray(wallets) ? wallets : [wallets];

      // Aggiorna la struttura FiregunUser
      this.user.wallets = {
        ethereum: walletsArray.map((w) => ({
          address: w.address,
          privateKey: w.privateKey,
          entropy: w.entropy,
          timestamp: w.timestamp,
        })),
      };

      return this.user.wallets.ethereum;
    } catch (error) {
      console.error("Errore nel recupero dei wallet:", error);
      throw error;
    }
  }

  /**
   * Firma un messaggio con un wallet specifico
   */
  async signWithWallet(
    message: string,
    walletAddress: string
  ): Promise<string> {
    try {
      if (!this.isAuthenticated()) {
        throw new Error("Utente non autenticato");
      }

      const wallets = await this.getWallets();
      const wallet = wallets.find(
        (w) => w.address.toLowerCase() === walletAddress.toLowerCase()
      );

      if (!wallet) {
        throw new Error("Wallet non trovato");
      }

      // Crea un'istanza di Wallet di ethers.js
      const ethersWallet = new Wallet(wallet.privateKey);
      return ethersWallet.signMessage(message);
    } catch (error) {
      console.error("Errore nella firma del messaggio:", error);
      throw error;
    }
  }
}
