export interface WalletData {
  address: string;
  privateKey: string;
  entropy?: string;
  timestamp: number;
  derivationPath?: string;
  index?: number;
}

export interface MnemonicData {
  phrase: string;
  timestamp: number;
} 