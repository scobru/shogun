export interface GunAck {
  err?: string;
  ok?: boolean;
}

export interface GunData {
  publicKey?: string;
  privateKey?: string;
  createdAt?: number;
}
