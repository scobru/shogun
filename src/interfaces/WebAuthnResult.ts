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
  credentialId?: string;
  error?: string;
  deviceInfo?: DeviceInfo;
}

export interface WebAuthnVerifyResult {
  success: boolean;
  authenticatorData?: ArrayBuffer;
  signature?: ArrayBuffer;
  error?: string;
} 