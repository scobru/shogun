export interface PasskeyAuthData {
  username: string;
  credentialID: string;
  publicKey: string;  // Sempre memorizzato come stringa base64
  encryptedGunKeys: string;
  counter: number;
}

export interface PasskeyCredential {
  id: string;
  response: {
    publicKey?: Uint8Array;
    userHandle?: string;
  };
} 