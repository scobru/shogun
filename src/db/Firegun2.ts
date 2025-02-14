import Gun from "gun";

import "gun/sea";
import "gun/lib/radix";
import "gun/lib/radisk";
// import 'gun/lib/store';
import "gun/lib/rindexed";

import { FiregunUser, Ack, common, Keys, PublicKeys } from "./common";
// @ts-ignore
import { IGunChainReference } from "gun/types/chain";
// @ts-ignore
import { IGunCryptoKeyPair } from "gun/types/types";
// @ts-ignore
import { IGunStatic } from "gun/types/static";

import { ActivityPubManager } from "../managers/ActivityPubManager";

import { EthereumManager } from "../managers/EthereumManager";
import { ActivityPubKeys } from "../interfaces/ActivityPubKeys";

import { StealthManager } from "../managers/StealthManager";
import { StealthKeyPair } from "../interfaces/StealthKeyPair";

import { WebAuthnManager } from "../managers/WebAuthnManager";
import { WebAuthnResult, DeviceCredential } from "../interfaces/WebAuthnResult";

import { WalletManager } from "../managers/WalletManager";
import { WalletKeys } from "../interfaces/WalletResult";

import { ethers } from "ethers";

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
  keys: Keys;
  publicKeys: PublicKeys;
  activityPubManager: ActivityPubManager;
  ethereumManager: EthereumManager;
  stealthManager: StealthManager;
  webAuthnManager: WebAuthnManager;
  walletManager: WalletManager;
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
    this.stealthManager = new StealthManager();
    this.webAuthnManager = new WebAuthnManager();
    this.walletManager = new WalletManager();

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
   * @param username
   * @param password
   * @returns
   */
  async userNew(
    username: string,
    password: string,
    alias: string = ""
  ): Promise<{ err: string } | FiregunUser> {
    return new Promise((resolve, reject) => {
      this.gun.user().create(username, password, async (s: any) => {
        if ("err" in s) {
          reject(s);
        } else {
          this.gun.user().leave();
          let user = (await this.userLogin(username, password, alias)) as FiregunUser;

          try {
            // 1. Genera le chiavi Gun
            this.keys.gun = user?.pair;

            // 2. Genera le chiavi ActivityPub
            const activityPubKeys = await this.activityPubManager.createPair();
            this.keys.activityPub = activityPubKeys;

            // 3. Genera le chiavi Stealth
            const stealthKeys = await this.stealthManager.createPair();
            this.keys.stealth = stealthKeys;

            // 4. Salva le chiavi private nel nodo privato dell'utente
            await this.userSet(`keys`, this.keys, true);

            // 5. Prepara le chiavi pubbliche
            const publicKeys: PublicKeys = {
              gun: {
                pub: user.pair.pub,
                epub: user.pair.epub,
                alias: user.alias,
                lastSeen: Date.now()
              },
              activityPub: {
                publicKey: activityPubKeys.publicKey,
                createdAt: activityPubKeys.createdAt
              },
              stealth: {
                pub: stealthKeys.pub,
                epub: stealthKeys.epub
              }
            };

            // 6. Salva le chiavi pubbliche
            await this.Set(`~${user.pair.pub}`, publicKeys);

            resolve(user);
          } catch (error) {
            console.error("Error generating keys:", error);
            reject(error);
          }
        }
      });
    });
  }

  /**
   *
   * Log a user in
   *
   * @param username
   * @param password
   * @param repeat time to repeat the login before give up. Because the nature of decentralization, just because the first time login is failed, doesn't mean the user / password pair doesn't exist in the network
   * @returns
   */
  async userLogin(
    username: string,
    password: string,
    alias: string = "",
    repeat: number = 2
  ): Promise<{ err: string } | FiregunUser> {
    return new Promise((resolve, reject) => {
      this.gun.user().auth(username, password, async (s: any) => {
        if ("err" in s) {
          if (repeat > 0) {
            await this._timeout(1000);
            this.userLogin(username, password, alias, repeat - 1)
              .then((s) => resolve(s))
              .catch((s) => reject(s));
          } else {
            reject(s);
            this.userLogout();
          }
        } else {
          this.user = {
            alias: alias || username,
            pair: s.sea,
          };
          
          // Carica le chiavi salvate
          await this.loadStoredKeys();
          
          resolve(this.user);
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("fg.keypair", JSON.stringify(this.user));
          }
        }
      });
    });
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
    data: string | { [key: string]: {} },
    async = false,
    prefix = this.prefix
  ): Promise<{ data: Ack[]; error: Ack[] }> {
    console.log("userPut", path, data, async, prefix);

    if (!this.user.alias) {
      throw new Error("User not logged in");
    }

    path = `~${this.user.pair.pub}/${path}`;
    return await this.Put(path, data, async, prefix);
  }

  async userSet(
    path: string,
    data: string | { [key: string]: {} },
    async = false,
    prefix = this.prefix
  ): Promise<{ data: Ack[]; error: Ack[] }> {
    console.log("userSet", path, data, async, prefix);

    if (!this.user.alias) {
      throw new Error("User not logged in");
    }

    path = `~${this.user.pair.pub}/${path}`;
    return await this.Set(path, data as any, async, prefix);
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
          const element = data[key];
          if (typeof element === "object") {
            delete data[key];
            if (async) {
              let s = await this.Put(`${path}/${key}`, element as any, async);
              obj.data = [...obj.data, ...s.data];
              obj.error = [...obj.error, ...s.error];
            } else {
              promises.push(
                this.Put(`${path}/${key}`, element as any, async).then((s) => {
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

  // ETHEREUM MANAGER

  /**
   * Generates credentials for Ethereum
   */
  async generateCredentials(customAlias?:string): Promise<{
    username: string;
    password: string;
  }> {
    const credentials = await this.ethereumManager.generateCredentials();
    const alias = customAlias ? customAlias : credentials.username

    const user = await this.userNew(credentials.username,credentials.password, alias) as FiregunUser

    const internalWalletAddress = this.ethereumManager.convertToEthPk(user.pair.epriv)
    const externalWalletAddress = credentials.address

    this.publicKeys.externalWallet = {
      internalWalletAddress: internalWalletAddress,
      externalWalletAddress: externalWalletAddress,
    }

    this.keys.externalWallet = {
      internalWalletAddress: internalWalletAddress,
      externalWalletAddress: externalWalletAddress,
    }

    await this.userSet(`keys`, this.keys, true)
    await this.Set(`~${user.pair.pub}`, this.publicKeys)
    
    return credentials;
  }

  /**
   * Login with Ethereum wallet
   */
  async walletLogin(): Promise<string> {
    const credentials = await this.generateCredentials();
    const result = await this.userLogin(
      credentials.username,
      credentials.password
    );
    if ("err" in result) {
      throw new Error(result.err);
    }
    return result.pair.pub;
  }

  // Metodi per ActivityPub
  async createActivityPubPair(): Promise<ActivityPubKeys> {
    if (!this.user?.pair) {
      throw new Error("User not authenticated");
    }

    // Usa il manager solo per creare le chiavi
    const activityPubKeys = await this.activityPubManager.createPair();
    
    // Gestisce il salvataggio
    this.keys.activityPub = activityPubKeys;
    this.publicKeys.activityPub = {
      publicKey: activityPubKeys.publicKey,
      createdAt: activityPubKeys.createdAt
    };

    // Salva le modifiche
    await this.userSet(`keys`, this.keys, true);
    await this.Set(`~${this.user.pair.pub}`, this.publicKeys);

    return activityPubKeys;
  }

  async getActivityPubKeys(): Promise<ActivityPubKeys | null> {
    if (!this.user?.pair) {
      throw new Error("User not authenticated");
    }

    const keys = await this.userGet("keys") as Keys;
    if (!keys?.activityPub) {
      throw new Error("ActivityPub keys not found");
    }

    return keys.activityPub;
  }

  // Metodi per Ethereum
  async generateEthereumCredentials(): Promise<{
    address: string;
    username: string;
    password: string;
  }> {
    const credentials = await this.ethereumManager.generateCredentials();
    
    // Se l'utente è già loggato, salva le informazioni del wallet
    if (this.user?.pair) {
      const internalWalletAddress = this.ethereumManager.convertToEthPk(this.user.pair.epriv);
      
      // Aggiorna le chiavi private
      this.keys.ethereum = {
        address: credentials.address,
        privateKey: internalWalletAddress,
        timestamp: Date.now()
      };
      
      // Aggiorna le chiavi pubbliche
      this.publicKeys.ethereum = {
        address: credentials.address,
        timestamp: Date.now()
      };

      // Salva le modifiche
      await this.userSet(`keys`, this.keys, true);
      await this.Set(`~${this.user.pair.pub}`, this.publicKeys);
    }

    return credentials;
  }

  async ethereumLogin(): Promise<string> {
    const credentials = await this.generateEthereumCredentials();
    const result = await this.userLogin(credentials.username, credentials.password);
    if ('err' in result) {
      throw new Error(result.err);
    }
    return result.pair.pub;
  }

  setCustomEthereumProvider(rpcUrl: string, privateKey: string): void {
    this.ethereumManager.setCustomProvider(rpcUrl, privateKey);
  }

  async getEthereumSigner(): Promise<ethers.Signer> {
    return this.ethereumManager.getSigner();
  }

  convertToEthereumPrivateKey(gunPrivateKey: string): string {
    return this.ethereumManager.convertToEthPk(gunPrivateKey);
  }

  // Metodi per Stealth
  async createStealthPair(): Promise<StealthKeyPair> {
    return this.stealthManager.createPair();
  }

  async generateStealthAddress(recipientPublicKey: string): Promise<{
    stealthAddress: string;
    ephemeralPublicKey: string;
    recipientPublicKey: string;
  }> {
    if (!this.keys.stealth) {
      throw new Error("Stealth keys not found");
    }
    return this.stealthManager.generateStAdd(
      recipientPublicKey
    );
  }

  async openStealthAddress(stealthAddress: string, ephemeralPublicKey: string, stealthPair: StealthKeyPair): Promise<ethers.Wallet> {
    return this.stealthManager.openStAdd(stealthAddress, ephemeralPublicKey, stealthPair);
  }

  // Metodi per WebAuthn
  async loginWebAuthn(username: string): Promise<FiregunUser> {
    try {
      // 1. Prima autentica con WebAuthn
      const authResult = await this.webAuthnManager.authenticateUser(username);
      if (!authResult.success) {
        throw new Error(authResult.error || "WebAuthn authentication failed");
      }

      // 2. Se l'autenticazione WebAuthn è riuscita, effettua il login con le credenziali salvate
      const result = await this.userLogin(authResult.username!, authResult.password!);
      if ('err' in result) {
        throw new Error(result.err);
      }

      // 3. Aggiorna il timestamp dell'ultimo utilizzo del dispositivo
      if (this.user?.pair && authResult.credentialId) {
        if (this.publicKeys.webAuthn) {
          this.publicKeys.webAuthn.lastUsed = Date.now();
          await this.Set(`~${this.user.pair.pub}`, this.publicKeys);
        }
      }

      return result;
    } catch (error) {
      console.error("WebAuthn login failed:", error);
      throw error;
    }
  }

  // Metodo per registrare un nuovo dispositivo WebAuthn
  async registerWebAuthnDevice(
    username: string,
    deviceName?: string
  ): Promise<WebAuthnResult> {
    // 1. Genera le credenziali WebAuthn per il nuovo dispositivo
    const credentials = await this.generateWebAuthnCredentials(username, true, deviceName);
    
    if (!credentials.success) {
      throw new Error(credentials.error || "Failed to generate WebAuthn credentials");
    }

    return credentials;
  }

  async generateWebAuthnCredentials(
    username: string,
    isNewDevice: boolean = false,
    deviceName?: string
  ): Promise<WebAuthnResult> {
    const credentials = await this.webAuthnManager.generateCredentials(username, isNewDevice, deviceName);
    
    if (credentials.success && this.user?.pair) {
      // Salva le credenziali WebAuthn nelle chiavi private
      this.keys.webAuthn = {
        credentialId: credentials.credentialId!,
        deviceInfo: {
          name: deviceName || 'default',
          platform: navigator.platform
        },
        username: credentials.username!,
        password: credentials.password!,
        timestamp: Date.now()
      };

      // Salva le informazioni pubbliche
      this.publicKeys.webAuthn = {
        credentialId: credentials.credentialId!,
        lastUsed: Date.now(),
        deviceInfo: {
          name: deviceName || 'default',
          platform: navigator.platform
        }
      };

      // Salva le modifiche
      await this.userSet(`keys`, this.keys, true);
      await this.Set(`~${this.user.pair.pub}`, this.publicKeys);
    }

    return credentials;
  }

  async authenticateWebAuthnUser(username: string): Promise<WebAuthnResult> {
    return this.webAuthnManager.authenticateUser(username);
  }

  async getWebAuthnDevices(username: string): Promise<DeviceCredential[]> {
    return this.webAuthnManager.getRegisteredDevices(username);
  }

  async removeWebAuthnDevice(username: string, credentialId: string): Promise<boolean> {
    const removed = await this.webAuthnManager.removeDevice(username, credentialId);
    
    if (removed && this.user?.pair) {
      // Aggiorna le chiavi rimuovendo il dispositivo
      if (this.keys.webAuthn?.credentialId === credentialId) {
        delete this.keys.webAuthn;
      }
      
      if (this.publicKeys.webAuthn?.credentialId === credentialId) {
        delete this.publicKeys.webAuthn;
      }

      // Salva le modifiche
      await this.userSet(`keys`, this.keys, true);
      await this.Set(`~${this.user.pair.pub}`, this.publicKeys);
    }

    return removed;
  }

  // Metodi per Wallet
  async createNewWallet(): Promise<WalletKeys> {
    if (!this.user?.pair) {
      throw new Error("User not authenticated");
    }

    // Usa il manager solo per creare il wallet
    const walletData = await this.walletManager.createWallet(this.user.pair);
    
    // Gestisce il salvataggio
    if (!this.keys.wallets) {
      this.keys.wallets = { ethereum: [] };
    }
    if (!this.publicKeys.wallets) {
      this.publicKeys.wallets = { ethereum: [] };
    }

    // Aggiorna lo stato interno
    this.keys.wallets.ethereum.push(walletData);
    this.publicKeys.wallets.ethereum.push({
      address: walletData.address,
      timestamp: walletData.timestamp
    });

    // Salva le modifiche
    await this.userSet(`keys`, this.keys, true);
    await this.Set(`~${this.user.pair.pub}`, this.publicKeys);

    return {
      ethereum: [walletData]
    };
  }

  // Metodo per caricare le chiavi salvate durante il login
  private async loadStoredKeys(): Promise<void> {
    if (!this.user?.pair) {
      throw new Error("Utente non autenticato");
    }

    try {
      // Carica le chiavi private
      const storedKeys = await this.userGet("keys");
      if (storedKeys) {
        this.keys = this.validateKeys(storedKeys as Keys);
      }

      // Carica le chiavi pubbliche
      const publicPath = `~${this.user.pair.pub}`;
      const storedPublicKeys = await this.Get(publicPath);
      if (storedPublicKeys) {
        this.publicKeys = this.validatePublicKeys(storedPublicKeys as PublicKeys);
      }

      console.log("Chiavi caricate con successo");
    } catch (error) {
      console.error("Errore nel caricamento delle chiavi:", error);
      throw new Error(`Impossibile caricare le chiavi: ${
        error instanceof Error ? error.message : "Errore sconosciuto"
      }`);
    }
  }

  private validateKeys(keys: Keys): Keys {
    // Implementa la validazione delle chiavi
    if (!keys) {
      throw new Error("Chiavi non valide");
    }
    return keys;
  }

  private validatePublicKeys(publicKeys: PublicKeys): PublicKeys {
    // Implementa la validazione delle chiavi pubbliche
    if (!publicKeys) {
      throw new Error("Chiavi pubbliche non valide");
    }
    return publicKeys;
  }
}
