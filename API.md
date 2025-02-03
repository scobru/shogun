# SHOGUN API Reference

## 🔑 WalletManager

### Constructor

```typescript
constructor(gunOptions: any, APP_KEY_PAIR: any)
```
Creates a new WalletManager instance. Initializes Gun, user authentication, and various managers.

**Parameters:**
- `gunOptions`: Gun configuration object
  - `peers`: Array of Gun peer URLs
  - `localStorage`: Enable/disable localStorage
  - `radisk`: Enable/disable radisk storage
  - `multicast`: Enable/disable multicast
- `APP_KEY_PAIR`: Application key pair for Gun authentication

### Core Methods

#### Account Management

```typescript
async createAccount(alias: string, passphrase: string): Promise<void>
```
Creates a new account with the specified credentials.
- `alias`: Username (must be valid)
- `passphrase`: Account password
- Throws `ValidationError` if alias is invalid

```typescript
async login(alias: string, passphrase: string): Promise<string>
```
Performs login with specified credentials.
- `alias`: Username
- `passphrase`: Account password
- Returns: Public key of authenticated user
- Throws `ValidationError` if alias is invalid

```typescript
logout(): void
```
Logs out the current user.

#### Wallet Operations

```typescript
static async createWalletObj(gunKeyPair: GunKeyPair): Promise<WalletResult>
```
Creates a new wallet from a Gun key pair.
- `gunKeyPair`: Gun key pair with public key
- Returns: Object containing wallet data and entropy
- Throws error if wallet creation fails

```typescript
static async createWalletFromSalt(gunKeyPair: GunKeyPair, salt: string): Promise<Wallet>
```
Creates a deterministic wallet from salt and Gun key pair.
- `gunKeyPair`: Gun key pair
- `salt`: Salt for wallet derivation
- Returns: Ethereum wallet instance
- Throws error if wallet creation fails

```typescript
async saveWallet(wallet: Wallet): Promise<void>
```
Saves a wallet to Gun storage.
- `wallet`: Ethereum wallet to save
- Validates Ethereum address and private key
- Throws `ValidationError` if validation fails

```typescript
async getWallet(): Promise<Wallet | null>
```
Retrieves the stored wallet.
- Returns: Ethereum wallet or null if not found

### Data Management

```typescript
async exportAllData(): Promise<string>
```
Exports all user data as JSON.
- Returns: JSON string containing:
  - Wallet data
  - Stealth keys
  - Gun key pair
  - Timestamp
  - Version
- Throws error if user not authenticated

```typescript
async importAllData(jsonData: string): Promise<void>
```
Imports user data from JSON export.
- `jsonData`: Previously exported JSON data
- Validates data format and version
- Imports Gun pair, wallet, and stealth keys
- Throws error if import fails

### WebAuthn Integration

```typescript
async createAccountWithWebAuthn(alias: string): Promise<WalletResult>
```
Creates an account using WebAuthn authentication.
- `alias`: Username
- Returns: Wallet result object
- Throws `WebAuthnError` if WebAuthn not supported
- Throws `NetworkError` for other failures

### ActivityPub Integration

```typescript
async getPrivateKey(username: string): Promise<string>
```
Retrieves ActivityPub private key for a user.
- `username`: User to get key for
- Returns: Private key string

```typescript
async saveActivityPubKeys(keys: ActivityPubKeys): Promise<void>
```
Saves ActivityPub key pair.
- `keys`: ActivityPub key pair to save

```typescript
async getActivityPubKeys(): Promise<ActivityPubKeys | null>
```
Retrieves stored ActivityPub keys.
- Returns: ActivityPub keys or null if not found

```typescript
async deleteActivityPubKeys(): Promise<void>
```
Deletes stored ActivityPub keys.

```typescript
async signActivityPubData(stringToSign: string, username: string): Promise<{ signature: string; signatureHeader: string }>
```
Signs data for ActivityPub.
- `stringToSign`: Data to sign
- `username`: User performing signing
- Returns: Signature and signature header

### Key Management

```typescript
async exportGunKeyPair(): Promise<string>
```
Exports current user's Gun key pair.
- Returns: JSON string of key pair

```typescript
async importGunKeyPair(keyPairJson: string): Promise<string>
```
Imports a Gun key pair.
- `keyPairJson`: JSON string of key pair
- Returns: Public key of imported pair

### Profile Management

```typescript
async updateProfile(displayName: string): Promise<void>
```
Updates user profile.
- `displayName`: New display name to set

```typescript
async changePassword(oldPassword: string, newPassword: string): Promise<void>
```
Changes user password.
- `oldPassword`: Current password
- `newPassword`: New password to set

## 📦 Interfaces

### WalletResult
```typescript
interface WalletResult {
  walletObj: {
    address: string;
    privateKey: string;
    entropy: string;
  };
  entropy: string;
}
```

### ActivityPubKeys
```typescript
interface ActivityPubKeys {
  publicKey: string;
  privateKey: string;
}
```

### GunKeyPair
```typescript
interface GunKeyPair {
  pub: string;
  priv: string;
  epub?: string;
  epriv?: string;
}
```

## 🔒 Error Types

- `ValidationError`: Input validation failures
- `WebAuthnError`: WebAuthn-specific errors
- `NetworkError`: Network and communication errors
- `AuthenticationError`: Authentication-related failures

## 🔐 Security Notes

1. Private keys are never stored in plain text
2. Entropy is used for deterministic wallet derivation
3. Web Crypto API used in browser, Node crypto in Node.js
4. Comprehensive validation for addresses and keys
5. Secure password change mechanism

## 🌐 Gun Data Structure

### Wallets
```
gun/
└── users/
    └── [publicKey]/
        └── wallet/
            ├── address
            ├── privateKey (encrypted)
            └── entropy
```

### ActivityPub Keys
```
gun/
└── users/
    └── [publicKey]/
        └── activityPubKeys/
            ├── publicKey
            └── privateKey (encrypted)
```

### Profiles
```
gun/
└── users/
    └── [publicKey]/
        └── profile/
            └── displayName
```

## 🔄 Best Practices

1. Always validate input data
2. Handle all async operations with try-catch
3. Clean up sensitive data after use
4. Use appropriate error types
5. Verify authentication state before operations
6. Implement proper error handling
7. Use secure key storage methods
8. Regular data backups using export/import 