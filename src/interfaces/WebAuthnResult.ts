export interface DeviceInfo {
  deviceId: string;
  timestamp: number;
  name?: string;
  platform?: string;
}

export interface WebAuthnResult {
  success: boolean;
  username?: string;
  password?: string;
  signature?: ArrayBuffer;
  credentialId?: string;
  deviceInfo?: {
    deviceId: string;
    timestamp: number;
    name: string;
    platform: string;
  };
  error?: string;
}

export interface WebAuthnVerifyResult {
  success: boolean;
  authenticatorData?: ArrayBuffer;
  signature?: ArrayBuffer;
  error?: string;
} 

export interface DeviceCredential {
  deviceId: string;
  timestamp: number;
  name?: string;
  platform?: string;
}

export interface WebAuthnCredentials {
  salt: string;
  timestamp: number;
  credentials: { [credentialId: string]: DeviceCredential };
}