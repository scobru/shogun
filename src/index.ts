import { Shogun } from "./Shogun";
import { StealthManager } from "./managers/StealthManager";
import { EthereumManager } from "./managers/EthereumManager";
import { GunAuthManager } from "./managers/GunAuthManager";
import { ActivityPubManager } from "./managers/ActivityPubManager";
import { WebAuthnManager } from "./managers/WebAuthnManager";
import { WalletManager } from "./managers/WalletManager";


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

// export managers
export {
  EthereumManager,
  GunAuthManager,
  ActivityPubManager,
  WebAuthnManager,
  StealthManager,
  WalletManager
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
