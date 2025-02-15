import { Shogun } from "./Shogun";
import { StealthChain } from "./features/stealth/StealthChain";
import { EthereumConnector } from "./connector/EthereumConnector";
import { GunAuthManager } from "./managers/GunAuthManager";
import { ActivityPubManager } from "./managers/ActivityPubManager";
import { WebAuthnManager } from "./managers/WebAuthnManager";
import { EthereumWalletGenerator } from "./generator/EthereumWalletGenerator";
import UnstoppableChat from "./features/unstoppable";


import {
  EthereumProvider,
  StealthKeys,
  WebAuthnResult,
  WebAuthnVerifyResult,
  GunKeyPair,
  Wallet,
  WalletResult,
  ActivityPubKeys,
  GunAck,
  Callback,
  StealthKeyPair,
  UserKeys,
  StealthAddressResult,
  StealthKeyPairWrapper,
} from "./interfaces";
import { SEA } from "gun";

export { Shogun };

// export services

// export managers
export {
  EthereumConnector,
  GunAuthManager,
  ActivityPubManager,
  WebAuthnManager,
  StealthChain,
  EthereumWalletGenerator,
  UnstoppableChat,
};


// export interfaces
export {
  GunAck,
  Callback,
  StealthKeyPair,
  EthereumProvider,
  StealthKeys,
  WebAuthnResult,
  WebAuthnVerifyResult,
  GunKeyPair,
  Wallet,
  WalletResult,
  ActivityPubKeys,
  UserKeys,
  StealthAddressResult,
  StealthKeyPairWrapper,
};

// Dev only
export const generatePair = async (): Promise<GunKeyPair> => {
  const pair = await SEA.pair();
  return pair;
};
