import type { Wallet } from './Wallet';

export interface WalletResult {
  walletObj: Wallet;
  entropy: string;
}
