import Gun from "gun";
import Firegun from "./firegun";
import { WalletData } from "../interfaces/WalletResult";

/**
 * Interfaccia per le chiavi pubbliche
 */
export type PublicKeys = {
  gun?: {
    pub: string;
    epub: string;
    alias?: string;
    lastSeen?: number;
  };
  activityPub?: {
    publicKey: string;
    createdAt: number;
  };
  ethereum?: {
    address: string;
    timestamp: number;
  };
  stealth?: {
    pub: string;
    epub: string;
  };
  webAuthn?: {
    credentialId: string;
    lastUsed: number;
    deviceInfo?: {
      name: string;
      platform: string;
    };
  };
  externalWallet?: {
    internalWalletAddress: string;
    externalWalletAddress: string;
  };
  wallets?: {
    ethereum: {
      address: string;
      timestamp: number;
    }[];
  };
}

/**
 * Interfaccia che raccoglie tutti i tipi di chiavi private supportate
 */
export type Keys = {
  gun?: {
    pub: string;
    priv: string;
    epub: string;
    epriv: string;
  };
  activityPub?: {
    publicKey: string;
    privateKey: string;
    createdAt: number;
  };
  ethereum?: {
    address: string;
    privateKey: string;
    entropy?: string;
    timestamp?: number;
  };
  stealth?: {
    pub: string;
    priv: string;
    epub: string;
    epriv: string;
  };
  webAuthn?: {
    credentialId: string;
    deviceInfo: {
      name: string;
      platform: string;
    };
    username: string;
    password: string;
    timestamp: number;
  };
  externalWallet?: {
    internalWalletAddress: string;
    externalWalletAddress: string;
  };
  wallets?: {
    ethereum: WalletData[];  // Array di wallet
  };
}

export interface FiregunUser {
  alias: string;
  pair: GunKeyPair;
  is?: any;
  _?: any;
}

export interface GunKeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}

export type Ack =
  | {
      "@"?: string;
      err: undefined;
      ok: { "": number } | string;
      "#"?: string;
    }
  | {
      err: Error;
      ok: any;
    }
  | void;

export type Pubkey = {
  pub: string;
  epub?: string;
};

export type chatType = {
  _self: boolean;
  alias: string;
  msg: string;
  timestamp: string;
  id: string;
  status: string;
};

const zeroPad = (num: number, places: number) =>
  String(num).padStart(places, "0");

export const common = {
  /**
   * Genera il certificato pubblico per l'utente loggato.
   */
  async generatePublicCert(fg: Firegun): Promise<{ data: Ack[]; error: Ack[] }> {
    if (!fg.user || !fg.user.alias) {
      throw new Error("Utente non loggato");
    }
    try {
      // Se necessario, si può gestire il blacklist (attualmente commentato per via di bug conosciuti)
      // await fg.userPut("chat-blacklist", { t: "_" });

      let cert = await (Gun as any).SEA.certify(
        "*",
        [{ "*": "chat-with", "+": "*" }],
        fg.user.pair,
        null,
        {
          // block: 'chat-blacklist' // BUG noto: blacklist non funziona correttamente
        }
      );
      let ack = await fg.userPut("chat-cert", cert);
      return ack;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Restituisce una funzione per ordinare dinamicamente un array in base a una proprietà.
   * Esempio: arrays.sort(common.dynamicSort("timestamp"));
   */
  dynamicSort: (property: string) => {
    let sortOrder = 1;
    if (property[0] === "-") {
      sortOrder = -1;
      property = property.substr(1);
    }
    return function (a: any, b: any) {
      const result =
        a[property] < b[property]
          ? -1
          : a[property] > b[property]
          ? 1
          : 0;
      return result * sortOrder;
    };
  },

  /**
   * Converte il file selezionato in base64.
   */
  fileTobase64: async (
    fileElement: HTMLInputElement
  ): Promise<{
    info: { name: string; size: number; type: string };
    content: string | ArrayBuffer | null;
  }> => {
    return new Promise((resolve, reject) => {
      if (!fileElement.files || fileElement.files.length === 0) {
        reject(new Error("Nessun file selezionato"));
        return;
      }
      const file = fileElement.files[0];
      const reader = new FileReader();
      const fileInfo = {
        name: file.name,
        size: file.size,
        type: file.type,
      };
      reader.readAsDataURL(file);
      reader.onload = function () {
        resolve({ info: fileInfo, content: reader.result });
      };
      reader.onerror = function (error) {
        reject(error);
      };
    });
  },

  /**
   * Restituisce l'oggetto della data corrente.
   */
  getDate: () => {
    const currentdate = new Date();
    return {
      year: currentdate.getFullYear().toString(),
      month: zeroPad(currentdate.getMonth() + 1, 2),
      date: zeroPad(currentdate.getDate(), 2),
      hour: zeroPad(currentdate.getHours(), 2),
      minutes: zeroPad(currentdate.getMinutes(), 2),
      seconds: zeroPad(currentdate.getSeconds(), 2),
      milliseconds: zeroPad(currentdate.getMilliseconds(), 3), // Corretto il nome
    };
  },
};
