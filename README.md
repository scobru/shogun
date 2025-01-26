# SHOGUN - Decentralized Wallet Manager

**SHOGUN** is a decentralized wallet manager that uses Gun.js to handle wallets and private keys directly in the browser. It provides a complete authentication and key management system with support for stealth addresses.

## ✨ Key Features

- 🔐 **Advanced Security**
  - Secure private key management with Web Crypto API
  - Stealth address support
  - End-to-end encryption
  - Secure entropy management

- 🌐 **Decentralization**
  - Distributed storage with Gun.js
  - P2P synchronization
  - No central server

- 🔄 **Portability**
  - Complete data import/export
  - Encrypted backups
  - Multi-device support
  - Cross-platform localStorage management

## 🛠️ Requirements

- Node.js >= 16.0.0
- npm >= 7.0.0
- Modern browser with Web Crypto API support
- For Node.js: crypto module support

## 🚀 Installation

```bash
# Install from npm
npm install @scobru/shogun

# Or clone the repository
git clone https://github.com/scobru/shogun
cd shogun

# Install dependencies
npm install

# Build
npm run build

# Test
npm test
```

## 📚 Quick Start

### Basic Usage

```typescript
import { WalletManager, StorageType } from '@scobru/shogun'

// Initialize with custom Gun configuration
const manager = new WalletManager({
  peers: ['https://your-gun-peer.com/gun'],
  localStorage: true,
  radisk: false
});

// Create account with error handling
try {
  await manager.createAccount('username', 'password');
} catch (error) {
  console.error('Account creation failed:', error);
}

// Login
const pubKey = await manager.login('username', 'password');

// Create wallet
const gunKeyPair = manager.getCurrentUserKeyPair();
const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);

console.log('Address:', walletObj.address);
console.log('Private Key:', walletObj.privateKey);
console.log('Entropy:', walletObj.entropy);

// Save wallet (multiple options)
await manager.saveWallet(walletObj, pubKey, StorageType.BOTH);  // Gun + localStorage
await manager.saveWallet(walletObj, pubKey, StorageType.GUN);   // Gun only
await manager.saveWalletLocally(walletObj, pubKey);             // localStorage only

// Retrieve wallet
const walletFromBoth = await manager.retrieveWallet(pubKey, StorageType.BOTH);
const walletFromGun = await manager.retrieveWallet(pubKey, StorageType.GUN);
const walletFromLocal = await manager.retrieveWalletLocally(pubKey);
```

### Advanced Gun Configuration

```typescript
const manager = new WalletManager({
  peers: [
    'https://your-gun-peer.com/gun',
    'https://backup-peer.com/gun'
  ],
  localStorage: true,
  radisk: true,
  gun: existingGunInstance, // Use existing Gun instance
});
```

### Error Handling

```typescript
try {
  // Create account
  await manager.createAccount('username', 'password');
  
  // Login
  const pubKey = await manager.login('username', 'password');
  
  // Create and save wallet
  const { walletObj } = await WalletManager.createWalletObj(manager.getCurrentUserKeyPair());
  await manager.saveWallet(walletObj, pubKey, StorageType.BOTH);
  
} catch (error) {
  if (error.message.includes('already exists')) {
    console.error('Account already exists');
  } else if (error.message.includes('network')) {
    console.error('Network error:', error);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Wallet Management with Entropy

```typescript
// Create wallet from specific salt
const salt = 'my_custom_salt';
const wallet = await WalletManager.createWalletFromSalt(gunKeyPair, salt);

console.log('Address:', wallet.address);
console.log('Entropy:', wallet.entropy); // Will match the salt

// Verify different wallets are created from different salts
const wallet1 = await WalletManager.createWalletFromSalt(gunKeyPair, 'salt1');
const wallet2 = await WalletManager.createWalletFromSalt(gunKeyPair, 'salt2');
console.log(wallet1.address !== wallet2.address); // true
```

### LocalStorage Management

```typescript
// Check local data
const status = await manager.checkLocalData(pubKey);
console.log('Has wallet:', status.hasWallet);
console.log('Has stealth keys:', status.hasStealthKeys);
console.log('Has passkey:', status.hasPasskey);

// Save wallet locally
await manager.saveWalletLocally(wallet, pubKey);

// Retrieve local wallet
const localWallet = await manager.retrieveWalletLocally(pubKey);

// Clear local data
await manager.clearLocalData(pubKey);
```

### Import/Export

```typescript
// Export all data
const backup = await manager.exportAllData(pubKey);

// Import data
await manager.importAllData(backup, pubKey);

// Export Gun keypair only
const keypair = await manager.exportGunKeyPair();

// Import Gun keypair
const pubKey = await manager.importGunKeyPair(keypairJson);
```

## 🔒 Security

### Key Management

- Private keys are never stored in plain text
- Entropy is used for deterministic wallet derivation
- Web Crypto API used in browser
- Node crypto used in Node.js
- Private key and address validation

### Secure Storage

```typescript
// Example of secure storage
const walletData = {
  address: wallet.address,
  entropy: wallet.entropy  // Private key is derived when needed
};

// Data is stored encrypted
await manager.saveWalletLocally(wallet, pubKey);

// Always clean sensitive data when not needed
await manager.clearLocalData(pubKey);
```

## 🐛 Debugging

For debugging purposes, you can:

1. Enable Gun.js debug logs by setting the environment variable:
```bash
GUN_ENV=debug
```

2. Use browser developer tools to inspect:
   - Gun data synchronization
   - localStorage contents
   - Network requests

3. Monitor Gun events:
```typescript
const manager = new WalletManager();
const gun = manager.getGun();

// Monitor all Gun events
gun.on('out', data => {
  console.log('Gun out:', data);
});

gun.on('in', data => {
  console.log('Gun in:', data);
});
```

4. Check localStorage state:
```typescript
// Inspect stored data
const status = await manager.checkLocalData(pubKey);
console.log('Local storage status:', status);
```

5. Use try-catch blocks for error handling:
```typescript
try {
  await manager.createAccount('username', 'password');
} catch (error) {
  console.error('Operation failed:', error);
}
```

## 📦 Interfaces

```typescript
interface WalletData {
  address: string;    // Ethereum address
  privateKey: string; // Private key
  entropy: string;    // Entropy used for generation
}

interface WalletResult {
  walletObj: WalletData;
  entropy: string;
}

interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}

enum StorageType {
  GUN,    // Gun only
  LOCAL,  // localStorage only
  BOTH    // Both
}
```

## 🧪 Testing

```bash
# All tests
npm test

# Specific tests
npm test -- -g "Local Storage"
npm test -- -g "Wallet Creation"
npm test -- -g "Gun KeyPair"

# Test with coverage
npm run test:coverage
```

## 💻 Compatibility

- **Browser**: 
  - Chrome >= 80
  - Firefox >= 78
  - Safari >= 14
  - Edge >= 80
  - Web Crypto API support required
  - localStorage support required

- **Node.js**:
  - Version >= 16.0.0
  - crypto module
  - node-localstorage for localStorage compatibility
  - Gun.js for distributed storage

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

- [ ] WebAuthn/Passkey authentication
- [ ] StealthChain smart contracts
- [ ] Layer 2 integration
- [ ] Hardware wallet support
- [ ] Security improvements
- [ ] Performance optimizations
- [ ] Extended test coverage
