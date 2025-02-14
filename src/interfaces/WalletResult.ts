export interface WalletData {
  address: string;
  privateKey: string;
  entropy?: string;
  timestamp: number;
}

export interface WalletKeys {
  ethereum?: WalletData[];
}

export interface WalletResult {
  success: boolean;
  error?: string;
  wallet?: WalletData;
}

export interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}
