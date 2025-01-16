import Gun from "gun";
import "gun/sea";
import { createHash } from "crypto";

import { Wallet } from "./interfaces/Wallet";
import type { GunKeyPair } from "./interfaces/GunKeyPair";
import type { WalletResult } from "./interfaces/WalletResult";

// Estendo la definizione dei tipi di Gun
declare module "gun" {
  interface _GunRoot {
    sea: GunKeyPair;
  }
}

const SEA = Gun.SEA;

export class WalletManager {
  private gun: any;
  private user: any;

  constructor() {
    // Inizializza Gun con le opzioni corrette
    this.gun = Gun({
      localStorage: true,
    });
    this.user = this.gun.user();
  }

  /**
   * Ottiene il keyPair dell'utente corrente
   */
  public getCurrentUserKeyPair(): GunKeyPair {
    return this.user._.sea;
  }

  /**
   * Crea un account su GunDB usando un alias (username) e una passphrase.
   */
  public async createAccount(alias: string, passphrase: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.user.create(alias, passphrase, async (ack: any) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }
        try {
          // Dopo la creazione, effettua il login automaticamente
          await this.login(alias, passphrase);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Esegue il login su GunDB con alias e passphrase.
   * Ritorna la chiave pubblica Gun se il login va a buon fine, altrimenti null.
   */
  public async login(
    alias: string,
    passphrase: string
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.user.auth(alias, passphrase, (ack: any) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }
        resolve(this.user.is?.pub || null);
      });
    });
  }

  /**
   * Esegue il logout dall'utente GunDB corrente.
   */
  public logout(): void {
    this.user.leave();
  }

  /**
   * Ritorna la chiave pubblica dell'utente GunDB loggato.
   */
  public getPublicKey(): string | null {
    return this.user.is?.pub || null;
  }

  /**
   * Converte una chiave privata Gun (in base64Url) in un formato esadecimale
   * compatibile con Ethereum (64 hex, prefix "0x").
   */
  public async convertToEthPk(gunPrivateKey: string): Promise<string> {
    const base64UrlToHex = (base64url: string): string => {
      try {
        const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
        const base64 =
          base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
        const binary = atob(base64);
        const hex = Array.from(binary, (char) =>
          char.charCodeAt(0).toString(16).padStart(2, "0")
        ).join("");

        if (hex.length !== 64) {
          throw new Error("Lunghezza chiave privata non valida");
        }
        return hex;
      } catch (error) {
        console.error("Errore nella conversione base64Url to hex:", error);
        throw new Error("Impossibile convertire la chiave privata");
      }
    };

    const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
    return hexPrivateKey;
  }

  /**
   * Salva il wallet in localStorage (in formato JSON).
   * I wallet vengono salvati come array per supportare più wallet per utente.
   */
  public async saveWalletLocally(wallet: Wallet, alias: string): Promise<void> {
    try {
      // Recupera la lista esistente o crea un nuovo array
      const existingData = localStorage.getItem(`wallets_${alias}`);
      const wallets: Wallet[] = existingData ? JSON.parse(existingData) : [];

      // Aggiungi il nuovo wallet
      wallets.push(wallet);

      // Salva la lista aggiornata
      localStorage.setItem(`wallets_${alias}`, JSON.stringify(wallets));
    } catch (error) {
      console.error(
        "Errore nel salvataggio del wallet in localStorage:",
        error
      );
    }
  }

  /**
   * Salva il wallet su GunDB all'interno di `wallets/alias`.
   * I wallet vengono salvati come array per supportare più wallet per utente.
   */
  public async saveWalletToGun(wallet: Wallet, alias: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Recupera la lista esistente o crea un nuovo array
        this.gun.get(`wallets/${alias}`).once(async (data: any) => {
          const existingWallets = data
            ? Array.isArray(data)
              ? data
              : [data]
            : [];

          // Aggiungi il nuovo wallet
          existingWallets.push(wallet);

          // Salva la lista aggiornata
          this.gun.get(`wallets/${alias}`).put(existingWallets, (ack: any) => {
            if (ack.err) {
              reject(new Error(ack.err));
              return;
            }
            resolve();
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Salva le chiavi di visualizzazione e di spesa del ricevente in localStorage
   */
  public async saveStealthKeysLocally(
    alias: string,
    stealthKeys: { spendingKey: string; viewingKey: string }
  ): Promise<void> {
    localStorage.setItem(`stealthKeys_${alias}`, JSON.stringify(stealthKeys));
  }

  /**
   * Recupera le chiavi di visualizzazione e di spesa del ricevente da localStorage
   */
  public async retrieveStealthKeysLocally(
    alias: string
  ): Promise<{ spendingKey: string; viewingKey: string }> {
    const stealthKeys = localStorage.getItem(`stealthKeys_${alias}`);
    return stealthKeys ? JSON.parse(stealthKeys) : null;
  }

  /**
   * Salva le chiavi di visualizzazione e di spesa del ricevente
   */
  public async saveStealthKeys(
    alias: string,
    stealthKeys: { spendingKey: string; viewingKey: string }
  ): Promise<void> {
    this.gun.get(`stealthKeys/${alias}`).put(stealthKeys);
  }

  /**
   * Recupera le chiavi di visualizzazione e di spesa del ricevente
   */
  public async retrieveStealthKeys(
    alias: string
  ): Promise<{ spendingKey: string; viewingKey: string }> {
    return new Promise((resolve, reject) => {
      this.gun.get(`stealthKeys/${alias}`).once((data: any) => {
        if (!data || !data.spendingKey || !data.viewingKey) {
          reject(new Error("Chiavi stealth non trovate"));
          return;
        }
        resolve({
          spendingKey: data.spendingKey,
          viewingKey: data.viewingKey,
        });
      });
    });
  }

  /**
   * Recupera tutti i wallet di un utente.
   * Prima prova da localStorage, se non trova nulla cerca su GunDB.
   */
  public async retrieveWallets(alias: string): Promise<Wallet[]> {
    return new Promise<Wallet[]>((resolve) => {
      try {
        this.gun.get(`wallets/${alias}`).once((data: any) => {
          if (!data) {
            resolve([]);
            return;
          }

          // Converti in array se è un singolo wallet
          const wallets = Array.isArray(data) ? data : [data];
          resolve(wallets.map((w: any) => new Wallet(w.publicKey, w.entropy)));
        });
      } catch (error) {
        console.error("Errore nel recupero dei wallet:", error);
        resolve([]);
      }
    });
  }

  /**
   * Recupera un wallet specifico dato il suo indirizzo pubblico.
   */
  public async retrieveWalletByAddress(
    alias: string,
    publicKey: string
  ): Promise<Wallet | null> {
    const wallets = await this.retrieveWallets(alias);
    return wallets.find((w) => w.publicKey === publicKey) || null;
  }

  /**
   * Crea un nuovo wallet a partire dalla chiave pubblica Gun,
   * generando una "entropy" che poi useremo per creare un address stile Ethereum.
   */
  public static async createWalletObj(
    gunKeyPair: GunKeyPair
  ): Promise<WalletResult> {
    try {
      if (!gunKeyPair.pub) {
        throw new Error("Chiave pubblica mancante");
      }

      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 15);
      const salt = `${gunKeyPair.pub}_${timestamp}_${random}`;

      const wallet = await this.createWalletFromSalt(gunKeyPair, salt);
      // Salviamo l'entropia direttamente nel Wallet
      wallet.entropy = salt;

      return {
        walletObj: wallet,
        entropy: salt,
      };
    } catch (error: any) {
      throw new Error(`Errore nella creazione del wallet: ${error.message}`);
    }
  }

  /**
   * Dato un `salt` e il keyPair di Gun, genera una chiave derivata e ne fa l'hash
   * SHA-256 per ottenere un address da usare come "public key".
   */
  public static async createWalletFromSalt(
    gunKeyPair: GunKeyPair,
    salt: string
  ): Promise<Wallet> {
    try {
      // Deriva una chiave a partire da salt + chiave Gun
      const derivedKey = await SEA.work(salt, gunKeyPair);

      if (!derivedKey) {
        throw new Error("Impossibile generare la chiave derivata");
      }

      // Genera un address prendendo l'hash della derivedKey
      const hash = createHash("sha256")
        .update(Buffer.from(derivedKey as string, "utf8"))
        .digest("hex");

      return new Wallet("0x" + hash);
    } catch (error: any) {
      throw new Error(`Errore nella ricreazione del wallet: ${error.message}`);
    }
  }

  /**
   * Genera spending key e viewing key per il ricevente
   */
  public async generateStealthKeys(
    pair: GunKeyPair
  ): Promise<{ spendingKey: string; viewingKey: string }> {
    const viewingKeyPair = await SEA.pair();
    const spendingKeyPair = await SEA.pair();

    const stealthKeyPairs = {
      spendingKey: spendingKeyPair.epriv,
      viewingKey: viewingKeyPair.epriv,
    };

    // encrypt the viewing key with the spending key
    const encryptedViewingKey = await SEA.encrypt(stealthKeyPairs, pair);
    const decryptedKeys = await SEA.decrypt(encryptedViewingKey, pair);

    return {
      spendingKey: decryptedKeys.spendingKey,
      viewingKey: decryptedKeys.viewingKey,
    };
  }
}
