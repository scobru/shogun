export interface StealthKeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
} 

export interface StealthKeyPairWrapper {
  stealthKeyPair: StealthKeyPair;
  [key: string]: any;
}

/**
 * Result of stealth address generation
 */
export interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}