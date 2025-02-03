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

export interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}

export interface StealthKeys {
  stealthKeyPair: {
    pub: string;
    priv: string;
    epub: string;
    epriv: string;
  };
} 
