import { Wallet } from "ethers";
import { WalletData } from "./WalletResult";
import { GunKeyPair as ImportedGunKeyPair } from "./GunKeyPair";

export type { Wallet };
export type { UserKeys } from "./UserKeys";
export type { WalletResult } from "./WalletResult";
export type { WebAuthnResult, WebAuthnVerifyResult } from "./WebAuthnResult";
export type { EthereumProvider } from "./EthereumProvider";
export type {
  StealthKeyPair,
  StealthKeys,
  StealthAddressResult,
  StealthKeyPairWrapper,
} from "./StealthKeyPair";
export type { GunAck } from "./Gun";
export type { Callback } from "./Callback";
export type { ActivityPubKeys } from "./ActivityPubKeys";

export interface FiregunUser {
  alias: string;
  pair: ImportedGunKeyPair;
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
    ethereum: WalletData[];
  };
};

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
};
