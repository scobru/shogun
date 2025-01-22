import { Wallet } from './Wallet';

export interface WalletResult {
  walletObj: Wallet;
  entropy: string;
}

export interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}
