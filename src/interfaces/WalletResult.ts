import type { Wallet } from './Wallet';

export interface WalletResult {
  address: string;
  privateKey: string;
}

export interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  encryptedWallet: string;
}
