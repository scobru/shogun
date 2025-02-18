import { Shogun } from "./Shogun";
import { StealthChain } from "./extensions/stealth/StealthChain";
import { JsonRpcConnector } from "./blockchain/connectors/JsonRpcConnector";
import { GunAuth } from "./core/auth/GunAuth";
import { ActivityPub } from "./extensions/activitypub/ActivityPub";
import { WebauthnAuth } from "./core/auth/WebauthnAuth";
import { EthereumHDKeyVault } from "./blockchain/wallets/EthereumHDKeyVault";
import UnstoppableChat from "./extensions/messages/unstoppable";

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
} from "./types";

import { SEA } from "gun";

// export managers
export {
  Shogun,
  StealthChain,
  JsonRpcConnector,
  GunAuth,
  ActivityPub,
  WebauthnAuth,
  EthereumHDKeyVault,
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
