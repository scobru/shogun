# SHOGUN API Reference

## 👛 WalletManager

### Constructor

```typescript
constructor(options?: {
  peers?: string[],          // Custom Gun peers
  localStorage?: boolean,    // Enable/disable localStorage
  radisk?: boolean,         // Enable/disable radisk
  gun?: Gun                 // Existing Gun instance
})
```
Creates a new WalletManager instance. Initializes Gun, user and managers for Ethereum and StealthChain.

**Parameters:**
- `options`: Optional configuration object
  - `peers`: Array of Gun peer URLs (default: predefined peers)
  - `localStorage`: Whether to use localStorage (default: false)
  - `radisk`: Whether to use radisk storage (default: false)
  - `gun`: Existing Gun instance to use instead of creating a new one

**Default Configuration:**
```typescript
{
  peers: [
    "https://gun-manhattan.herokuapp.com/gun",
    "https://peer.wallie.io/gun",
    "https://gun-relay.scobrudot.dev/gun"
  ],
  localStorage: false,
  radisk: false
}
```

### Account Methods

#### createAccount
```typescript
async createAccount(alias: string, passphrase: string, callback?: (error?: Error) => void): Promise<void>
```
Creates a new GunDB account.
- `alias`: Account username
- `passphrase`: Account password
- `callback`: Optional callback for error handling

#### login
```typescript
async login(alias: string, passphrase: string): Promise<string>
```
Performs login with specified credentials.
- `alias`: Account username
- `passphrase`: Account password
- **Returns**: Public key of authenticated user

#### logout
```typescript
logout(): void
```
Logs out current user.

#### loginWithPrivateKey
```typescript
async loginWithPrivateKey(privateKey: string): Promise<string>
```
Performs login using an Ethereum private key.
- `privateKey`: Ethereum private key
- **Returns**: Account public key

### Wallet Management

#### saveWallet
```typescript
async saveWallet(wallet: Wallet, publicKey: string, storageType?: StorageType): Promise<void>
```
Saves a wallet to specified storage.
- `wallet`: Wallet to save
- `publicKey`: Associated public key
- `storageType`: Storage type (GUN, LOCAL, BOTH)

#### saveWalletToGun
```typescript
async saveWalletToGun(wallet: Wallet, publicKey: string): Promise<void>
```
Saves a wallet to Gun.
- `wallet`: Wallet to save
- `publicKey`: Associated public key

#### retrieveWallets
```typescript
async retrieveWallets(publicKey: string): Promise<Wallet[]>
```
Retrieves all wallets from Gun.
- `publicKey`: User's public key
- **Returns**: Array of wallets

#### retrieveWalletLocally
```typescript
async retrieveWalletLocally(publicKey: string): Promise<Wallet | null>
```
Retrieves a wallet from localStorage.
- `publicKey`: User's public key
- **Returns**: Found wallet or null

#### deleteWallet
```typescript
async deleteWallet(publicKey: string, walletAddress: string): Promise<void>
```
Deletes a specific wallet.
- `publicKey`: User's public key
- `walletAddress`: Address of wallet to delete

#### convertToEthPk
```typescript
async convertToEthPk(gunPrivateKey: string): Promise<string>
```
Converts a Gun private key to Ethereum format.
- `gunPrivateKey`: Gun private key in base64Url format
- **Returns**: Private key in hex format

#### createWalletObj
```typescript
static async createWalletObj(gunKeyPair: GunKeyPair): Promise<WalletResult>
```
Creates a new wallet from a Gun key pair.
- `gunKeyPair`: Gun key pair
- **Returns**: Object containing wallet and entropy

#### createWalletFromSalt
```typescript
static async createWalletFromSalt(gunKeyPair: GunKeyPair, salt: string): Promise<Wallet>
```
Creates a wallet from salt and Gun key pair.
- `gunKeyPair`: Gun key pair
- `salt`: Salt for derivation
- **Returns**: New wallet

### Data Management

#### exportAllData
```typescript
async exportAllData(publicKey: string): Promise<string>
```
Exports all user data.
- `publicKey`: User's public key
- **Returns**: JSON containing all data

#### importAllData
```typescript
async importAllData(jsonData: string, publicKey: string): Promise<void>
```
Imports user data.
- `jsonData`: JSON data to import
- `publicKey`: User's public key

#### checkLocalData
```typescript
async checkLocalData(publicKey: string): Promise<{hasWallet: boolean, hasStealthKeys: boolean, hasPasskey: boolean}>
```
Checks user's local data.
- `publicKey`: Public key to check
- **Returns**: Local data status

#### clearLocalData
```typescript
async clearLocalData(publicKey: string): Promise<void>
```
Clears all local data for a user.
- `publicKey`: Public key of data to clear

### Utility

#### getPublicKey
```typescript
getPublicKey(): string
```
Gets current user's public key.
- **Returns**: User's public key

#### getCurrentUserKeyPair
```typescript
getCurrentUserKeyPair(): GunKeyPair
```
Gets current user's key pair.
- **Returns**: Gun key pair

### Key Management

#### exportGunKeyPair
```typescript
async exportGunKeyPair(): Promise<string>
```
Exports current user's Gun key pair.
- **Returns**: JSON string of key pair

#### importGunKeyPair
```typescript
async importGunKeyPair(keyPairJson: string): Promise<string>
```
Imports a Gun key pair.
- `keyPairJson`: JSON string of key pair
- **Returns**: Imported account's public key

### WebAuthn Methods

#### isWebAuthnSupported
```typescript
isWebAuthnSupported(): boolean
```
Checks if WebAuthn is supported in the current browser.
- **Returns**: `true` if WebAuthn is supported, `false` otherwise
- **Note**: Also verifies Web Crypto API support

#### createAccountWithWebAuthn
```typescript
async createAccountWithWebAuthn(alias: string): Promise<WalletResult>
```
Creates a new account using WebAuthn for authentication.
- `alias`: Account username (3-64 characters, only letters, numbers, underscores and hyphens)
- **Returns**: `WalletResult` object containing the created wallet
- **Process**:
  1. Generates a random salt
  2. Creates WebAuthn credentials
  3. Generates password deterministically from username + salt
  4. Saves only the salt in Gun
- **Throws**:
  - If WebAuthn is not supported
  - If username is invalid
  - If account already exists
  - If timeout (60s) is exceeded

#### loginWithWebAuthn
```typescript
async loginWithWebAuthn(alias: string): Promise<string>
```
Performs login using WebAuthn.
- `alias`: Account username
- **Returns**: Authenticated user's public key
- **Process**:
  1. Retrieves salt from Gun
  2. Verifies WebAuthn authentication
  3. Regenerates password from username + salt
- **Throws**:
  - If WebAuthn is not supported
  - If username is invalid
  - If credentials are not found
  - If timeout (60s) is exceeded

### WebAuthn Interfaces

#### WebAuthnResult
```typescript
interface WebAuthnResult {
  success: boolean;           // Indicates if operation was successful
  username?: string;          // Account username
  password?: string;          // Password generated from username + salt
  credentialId?: string;      // WebAuthn credential ID
  error?: string;            // Error message if present
}
```

#### WebAuthnVerifyResult
```typescript
interface WebAuthnVerifyResult {
  success: boolean;                    // Indicates if verification was successful
  authenticatorData?: ArrayBuffer;     // Authenticator data
  signature?: ArrayBuffer;             // Verification signature
  error?: string;                     // Error message if present
}
```

### Costanti e Configurazione

```typescript
const TIMEOUT_MS = 60000;           // Timeout operazioni WebAuthn (60 secondi)
const MIN_USERNAME_LENGTH = 3;      // Lunghezza minima username
const MAX_USERNAME_LENGTH = 64;     // Lunghezza massima username
```

## 🕶 StealthChain

### Constructor

```typescript
constructor(gun: Gun)
```
Creates a new StealthChain instance.
- `gun`: Gun instance to use

### Methods

#### generateStealthKeys
```typescript
generateStealthKeys(cb: Callback<StealthKeyPair>): void
```
Generates a new stealth key pair.
- `cb`: Callback receiving key pair
- **Callback Result**: `StealthKeyPair`

#### generateStealthAddress
```typescript
generateStealthAddress(recipientPublicKey: string, cb: Callback<StealthAddressResult>): void
```
Generates a stealth address for a recipient.
- `recipientPublicKey`: Recipient's public key
- `cb`: Callback receiving result
- **Callback Result**: `StealthAddressResult`

#### openStealthAddress
```typescript
openStealthAddress(stealthAddress: string, ephemeralKey: string, cb: Callback<ethers.Wallet>): void
```
Opens a stealth address.
- `stealthAddress`: Stealth address to open
- `ephemeralKey`: Ephemeral key
- `cb`: Callback receiving wallet
- **Callback Result**: `ethers.Wallet`

#### saveStealthKeys
```typescript
saveStealthKeys(stealthKeyPair: StealthKeyPair, cb: Callback<void>): void
```
Saves stealth keys.
- `stealthKeyPair`: Key pair to save
- `cb`: Completion callback

#### retrieveStealthKeysFromRegistry
```typescript
retrieveStealthKeysFromRegistry(publicKey: string, cb: Callback<string>): void
```
Retrieves stealth keys from registry.
- `publicKey`: Public key to look up
- `cb`: Callback receiving keys

## ⛓️ EthereumManager

### Constructor

```typescript
constructor(walletManager: WalletManager)
```
Creates a new EthereumManager instance.
- `walletManager`: WalletManager instance

### Methods

#### setCustomProvider
```typescript
setCustomProvider(rpcUrl: string, privateKey: string): void
```
Sets a custom provider.
- `rpcUrl`: RPC provider URL
- `privateKey`: Wallet private key

#### createAccountWithEthereum
```typescript
async createAccountWithEthereum(): Promise<string>
```
Creates an account using an Ethereum account.
- **Returns**: Created username (Ethereum address)

#### loginWithEthereum
```typescript
async loginWithEthereum(): Promise<string | null>
```
Performs login using an Ethereum account.
- **Returns**: Public key if login successful

## 📝 Types and Interfaces

### StorageType
```typescript
enum StorageType {
  GUN,    // Decentralized storage
  LOCAL,  // Local storage
  BOTH    // Both storages
}
```

### StealthKeyPair
```typescript
interface StealthKeyPair {
  pub: string;    // Public key
  priv: string;   // Private key
  epub: string;   // Ephemeral public key
  epriv: string;  // Ephemeral private key
}
```

### StealthAddressResult
```typescript
interface StealthAddressResult {
  stealthAddress: string;      // Generated stealth address
  ephemeralPublicKey: string;  // Ephemeral public key
  recipientPublicKey: string;  // Recipient public key
}
```

### WalletResult
```typescript
interface WalletResult {
  walletObj: Wallet;  // Wallet object
  entropy: string;    // Used entropy
}
```

## 🔫 Gun Node Structure

### Wallets
```
gun/
└── wallets/
    └── [publicKey]/
        ├── address      # Wallet address
        ├── entropy      # Entropy for regeneration
        └── timestamp    # Last modification timestamp
```

### WebAuthn
```
gun/
└── shogun/
    └── webauthn-credentials/
        └── [username]/
            ├── salt        # Salt for credential generation
            ├── timestamp   # Creation timestamp
            └── lastUsed    # Last access timestamp
```

### Stealth Keys
```
gun/
└── stealthKeys/
    └── [publicKey]/
        ├── pub     # Stealth public key
        ├── priv    # Stealth private key (encrypted)
        ├── epub    # Ephemeral public key
        └── epriv   # Ephemeral private key (encrypted)
```

### Users
```
gun/
└── ~[publicKey]/  # ~ prefix for Gun users
    └── stealthKeys/
        ├── pub    # Public key
        ├── priv   # Private key (encrypted)
        ├── epub   # Ephemeral public key
        └── epriv  # Ephemeral private key (encrypted)
```

### Public Registry
```
gun/
└── stealthKeys/
    └── [publicKey]  # Ephemeral public key (epub)
```

### Security Notes

1. **Sensitive Data**
   - Private keys are always encrypted before storage
   - Salts are used to regenerate credentials instead of storing them
   - Passwords are never stored

2. **Data Access**
   - Wallets are accessible only by their owner
   - Stealth public keys are in the public registry
   - Private keys are encrypted with user's key

3. **Timestamps**
   - Each node includes a timestamp to track changes
   - Useful for synchronization and debugging 