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
Verifica se WebAuthn è supportato nel browser corrente.
- **Returns**: `true` se WebAuthn è supportato, `false` altrimenti

#### createAccountWithWebAuthn
```typescript
async createAccountWithWebAuthn(alias: string): Promise<WalletResult>
```
Crea un nuovo account utilizzando WebAuthn per l'autenticazione.
- `alias`: Username dell'account
- **Returns**: Oggetto `WalletResult` contenente il wallet creato
- **Throws**: Error se WebAuthn non è supportato o se l'account esiste già

#### loginWithWebAuthn
```typescript
async loginWithWebAuthn(alias: string): Promise<string>
```
Effettua il login utilizzando WebAuthn.
- `alias`: Username dell'account
- **Returns**: Public key dell'utente autenticato
- **Throws**: Error se WebAuthn non è supportato o se le credenziali non sono valide

### WebAuthn Interfaces

#### WebAuthnResult
```typescript
interface WebAuthnResult {
  success: boolean;           // Indica se l'operazione è riuscita
  username?: string;          // Username dell'account
  password?: string;          // Password generata
  credentialId?: string;      // ID della credenziale WebAuthn
  error?: string;            // Messaggio di errore se presente
}
```

#### WebAuthnVerifyResult
```typescript
interface WebAuthnVerifyResult {
  success: boolean;                    // Indica se la verifica è riuscita
  authenticatorData?: ArrayBuffer;     // Dati dell'autenticatore
  signature?: ArrayBuffer;             // Firma della verifica
  error?: string;                     // Messaggio di errore se presente
}
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