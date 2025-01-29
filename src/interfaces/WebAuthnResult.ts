export interface WebAuthnResult {
  success: boolean;
  username?: string;
  password?: string;
  credentialId?: string;
  error?: string;
}

export interface WebAuthnVerifyResult {
  success: boolean;
  authenticatorData?: ArrayBuffer;
  signature?: ArrayBuffer;
  error?: string;
} 