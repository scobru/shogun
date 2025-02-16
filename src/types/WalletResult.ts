export interface WalletData {
  address: string;
  privateKey: string;
  entropy: string;
  timestamp: number;
  index?: number;
}

export interface MnemonicData {
  phrase: string;
  timestamp: number;
}

export interface WalletResult {
  walletObj: WalletData;
  entropy: string;
}

export interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}
