import type { Wallet } from "ethers";
import { ISEAPair } from "gun";

export interface GunInstance {
  user(): any;
  get(path: string): any;
  off(): void;
}

export interface GunKeyPair {
  pub: string;
  priv: string;
  epriv: string;
  epub: string;
}

export interface GunOptions {
  file?: string;
  web?: any;
  s3?: {
    key: string;
    secret: string;
    bucket: string;
    region?: string;
    fakes3?: any;
  };
  peers?: string[] | Record<string, {}>;
  radisk?: boolean;
  localStorage?: boolean;
  uuid?: () => string;
  memory?: boolean;
  axe?: boolean;
  multicast?: boolean;
  ws?: boolean;
  super?: boolean;
  timeout?: number;
  [key: string]: any;
}

export interface GunAck {
  err?: string;
}

export interface AccountData {
  username: string;
  wallets: { [address: string]: WalletData };
  encryptedStealthKeys: string;
  selectedWallet: string | null;
}

export interface WalletData {
  address: string;
  entropy: string;
  name: string;
}

export interface WalletResult {
  walletObj: Wallet;
  entropy: string;
}

export interface AuthData {
  keyPair: GunKeyPair;
  passwordHash?: string;
}

export interface StorageProvider {
  // Funzioni per l'autenticazione
  getAuth(username: string): Promise<AuthData | null>;
  setAuth(username: string, auth: AuthData): Promise<void>;
  createAuth(username: string, password: string): Promise<AuthData>;
  
  // Funzioni per i dati utente
  getUserData(username: string): Promise<AccountData | null>;
  setUserData(username: string, data: AccountData): Promise<void>;
  
  // Funzione opzionale per la pulizia delle risorse
  cleanup?(): Promise<void>;
}
