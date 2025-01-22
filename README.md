# SHOGUN - Decentralized Wallet Manager



**SHOGUN** is a decentralized wallet manager that uses Gun.js to handle wallets and private keys directly in the browser. It provides a complete authentication and key management system with stealth address support.

## ✨ Key Features

- 🔐 **Advanced Security**
  - Secure private key management
  - Stealth address support
  - End-to-end encryption

- 🌐 **Decentralization**
  - Distributed storage with Gun.js
  - P2P synchronization
  - No central server

- 🔄 **Portability**
  - Complete data import/export
  - Encrypted backups
  - Multi-device support

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/scobru/shogun
cd wallet-manager

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## 📚 Quick Start

### Basic Usage

```typescript
import { WalletManager, StorageType } from '@scobru/shogun'

// Initialize with default Gun configuration
const manager = new WalletManager();

// Create account
try {
  await manager.createAccount('username', 'password');
  console.log('Account created successfully!');
} catch (error) {
  console.error('Error creating account:', error);
}

// Login
try {
  const pubKey = await manager.login('username', 'password');
  console.log('Logged in with public key:', pubKey);
} catch (error) {
  console.error('Error logging in:', error);
}

// Create and save wallet
try {
  const gunKeyPair = manager.getCurrentUserKeyPair();
  const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);
  
  // Save wallet to both Gun and localStorage
  await manager.saveWallet(walletObj, pubKey, StorageType.BOTH);
  
  // Or save only to Gun
  await manager.saveWallet(walletObj, pubKey, StorageType.GUN);
  
  // Or save only locally
  await manager.saveWallet(walletObj, pubKey, StorageType.LOCAL);
  
  console.log('Wallet created:', walletObj);
} catch (error) {
  console.error('Error creating wallet:', error);
}

// Retrieve wallet
try {
  const wallet = await manager.retrieveWallet(pubKey, StorageType.BOTH);
  console.log('Retrieved wallet:', wallet);
} catch (error) {
  console.error('Error retrieving wallet:', error);
}
```

### Ethereum/MetaMask Integration

```typescript
// Initialize Ethereum manager
const ethereumManager = manager.getEthereumManager();

// Create account with MetaMask
try {
  const username = await ethereumManager.createAccountWithEthereum();
  console.log('Account created with address:', username);
} catch (error) {
  console.error('Error creating account:', error);
}

// Login with MetaMask
try {
  const pubKey = await ethereumManager.loginWithEthereum();
  console.log('Logged in with public key:', pubKey);
} catch (error) {
  console.error('Error logging in:', error);
}

// Set custom provider
ethereumManager.setCustomProvider(
  "https://your-rpc-url.com",
  "your-private-key"
);
```

### Stealth Addresses

```typescript
// Initialize StealthChain
const stealthChain = manager.getStealthChain();

// Generate stealth keys
stealthChain.generateStealthKeys((err, keys) => {
  if (err) {
    console.error('Error generating stealth keys:', err);
    return;
  }
  console.log('Stealth keys generated:', keys);
});

// Generate stealth address
stealthChain.generateStealthAddress(recipientPubKey, (err, result) => {
  if (err) {
    console.error('Error generating stealth address:', err);
    return;
  }
  console.log('Stealth address generated:', result);
});

// Open stealth address
stealthChain.openStealthAddress(stealthAddress, ephemeralPublicKey, (err, wallet) => {
  if (err) {
    console.error('Error opening stealth address:', err);
    return;
  }
  console.log('Stealth wallet opened:', wallet);
});
```

### Gun.js Integration

```typescript
// Get Gun instance for custom operations
const gun = manager.getGun();

// Get current user's keypair
const keyPair = manager.getCurrentUserKeyPair();

// Save wallet to Gun
await manager.saveWalletToGun(wallet, publicKey);

// Retrieve wallets from Gun
const wallets = await manager.retrieveWallets(publicKey);

// Listen for Gun events
gun.on('rtc:peer', (peer) => {
  console.log('New peer connected:', peer);
});

gun.on('rtc:data', (data) => {
  console.log('Data received:', data);
});
```

### Import/Export

```typescript
// Export all data
const backup = await manager.exportAllData('username');

// Import data
await manager.importAllData(backup, 'username');

// Export only keypair
const keypair = await manager.exportGunKeyPair();

// Import keypair
const pubKey = await manager.importGunKeyPair(keypairJson);
```

### Local Storage Management

```typescript
// Check local data
const status = await manager.checkLocalData('username');
console.log('Wallet exists:', status.hasWallet);
console.log('Stealth keys exist:', status.hasStealthKeys);

// Clear local data
await manager.clearLocalData('username');
```

## 🔒 Security Best Practices

1. **Key Management**
   - Never store private keys in plaintext
   - Always use `exportAllData` for backups
   - Verify data integrity on import
   - Clear sensitive data after use

2. **Authentication**
   - Use strong passwords
   - Implement 2FA where possible
   - Don't reuse passwords
   - Use MetaMask for enhanced security

3. **Storage**
   - Clean sensitive data when not needed
   - Use `clearLocalData` on logout
   - Always verify data with `checkLocalData`
   - Use encrypted storage for sensitive data

4. **Error Handling**
   - Handle timeouts (default: 30s for auth, 25s for data operations)
   - Implement proper error recovery
   - Validate all input data
   - Handle network disconnections

## �� API Reference

### Enums

```typescript
enum StorageType {
  GUN,    // Store in GunDB only
  LOCAL,  // Store in localStorage only
  BOTH    // Store in both GunDB and localStorage
}
```

### Interfaces

```typescript
interface WalletResult {
  walletObj: Wallet;
  entropy: string;
}

interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}
```

### WalletManager

```typescript
class WalletManager {
  constructor()

  // Authentication
  async createAccount(alias: string, passphrase: string): Promise<void>
  async login(alias: string, passphrase: string): Promise<string>
  logout(): void

  // Wallet Creation (Static Methods)
  static async createWalletObj(gunKeyPair: GunKeyPair): Promise<WalletResult>
  static async createWalletFromSalt(gunKeyPair: GunKeyPair, salt: string): Promise<Wallet>

  // Data Management
  async saveWallet(wallet: Wallet, publicKey: string, storageType?: StorageType): Promise<void>
  async retrieveWallet(publicKey: string, storageType?: StorageType): Promise<Wallet | null>
  async checkLocalData(alias: string): Promise<{hasWallet: boolean, hasStealthKeys: boolean, hasPasskey: boolean}>
  async clearLocalData(alias: string): Promise<void>

  // Import/Export
  async exportGunKeyPair(): Promise<string>
  async importGunKeyPair(keyPairJson: string): Promise<string>
  async exportAllData(alias: string): Promise<string>
  async importAllData(jsonData: string, alias: string): Promise<void>
  async convertToEthPk(gunPrivateKey: string): Promise<string>

  // Utility
  getEthereumManager(): EthereumManager
  getStealthChain(): StealthChain
  getGun(): Gun
  getCurrentUserKeyPair(): GunKeyPair
  getPublicKey(): string
}
```

### LocalStorageManager

```typescript
class LocalStorageManager {
  static async saveWallet(wallet: Wallet, alias: string): Promise<void>
  static async retrieveWallet(alias: string): Promise<Wallet | null>
  static async checkData(alias: string): Promise<{
    hasWallet: boolean;
    hasStealthKeys: boolean;
    hasPasskey: boolean;
  }>
  static async clearData(alias: string): Promise<void>
}
```

### EthereumManager

```typescript
class EthereumManager {
  setCustomProvider(rpcUrl: string, privateKey: string): void
  async createAccountWithEthereum(): Promise<string>
  async loginWithEthereum(): Promise<string | null>
}
```

### StealthChain

```typescript
class StealthChain {
  generateStealthKeys(cb: Callback<StealthKeyPair>): void
  generateStealthAddress(recipientPublicKey: string, cb: Callback<StealthAddressResult>): void
  openStealthAddress(stealthAddress: string, ephemeralPublicKey: string, cb: Callback<Wallet>): void
  retrieveStealthKeysFromRegistry(publicKey: string, cb: Callback<string>): void
}
```

## 🤝 Contributing

Pull requests are welcome! For major changes:

1. 🍴 Fork the repository
2. 🔧 Create a branch (`git checkout -b feature/amazing`)
3. 💾 Commit changes (`git commit -m 'Add feature'`)
4. 🚀 Push branch (`git push origin feature/amazing`)
5. 📝 Open a Pull Request

## 📄 License

[MIT](LICENSE)

## 🗺️ Roadmap

- [ ] WebAuthn/Passkey Authentication
- [ ] StealthChain Smart-Contracts
- [ ] Layer 2 integration
