# SHOGUN - Decentralized Wallet Manager

A decentralized wallet manager that uses Gun.js to handle wallets and private keys directly in the browser. It provides a complete authentication and key management system with support for stealth addresses and ActivityPub integration.

## ✨ Key Features

- 🔐 **Advanced Security**
  - Secure private key management with Web Crypto API
  - Stealth address support
  - End-to-end encryption
  - Secure entropy management
  - ActivityPub key management

- 🌐 **Decentralization**
  - Distributed storage with Gun.js
  - P2P synchronization
  - No central server
  - ActivityPub federation support

- 🔄 **Portability**
  - Complete data import/export
  - Encrypted backups
  - Multi-device support
  - Cross-platform compatibility

## 🛠️ Requirements

- Node.js >= 16.0.0
- npm >= 7.0.0
- Modern browser with Web Crypto API support
- For Node.js: crypto module support

## 🚀 Installation

```bash
npm install @scobru/shogun
```

## 📚 Quick Start

### Basic Usage

```typescript
import { Shogun } from '@scobru/shogun'

// Initialize Shogun with Gun configuration
const shogun = new Shogun({
  peers: ['https://your-gun-peer.com/gun'],
  localStorage: false,
  radisk: false,
  multicast: false
}, APP_KEY_PAIR);

// Get required managers and services
const walletManager = shogun.getWalletManager();
const webAuthnService = shogun.getWebAuthnService();
const activityPubManager = shogun.getActivityPubManager();

// Create account
try {
  await walletManager.createAccount('username', 'password');
} catch (error) {
  console.error('Account creation failed:', error);
}

// Login
const pubKey = await walletManager.login('username', 'password');

// Create wallet
const gunKeyPair = walletManager.getCurrentUserKeyPair();
const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);

console.log('Address:', walletObj.address);
console.log('Private Key:', walletObj.privateKey);
console.log('Entropy:', entropy);

// Save wallet
await walletManager.saveWallet(walletObj);

// Retrieve wallet
const wallet = await walletManager.getWallet();

// Export all data
const backup = await shogun.exportAllData();

// Import data
await shogun.importAllData(backup);
```

### ActivityPub Integration

```typescript
// Get ActivityPub manager
const activityPubManager = shogun.getActivityPubManager();

// Generate and save ActivityPub keys
const keys = {
  publicKey: 'public_key_data',
  privateKey: 'private_key_data'
};
await activityPubManager.saveActivityPubKeys(keys);

// Retrieve keys
const storedKeys = await activityPubManager.getActivityPubKeys();

// Sign ActivityPub data
const { signature, signatureHeader } = await activityPubManager.signActivityPubData(
  stringToSign,
  username
);
```

### Error Handling

```typescript
try {
  const walletManager = shogun.getWalletManager();
  
  // Create account
  await walletManager.createAccount('username', 'password');
  
  // Login
  const pubKey = await walletManager.login('username', 'password');
  
  // Create and save wallet
  const { walletObj } = await WalletManager.createWalletObj(walletManager.getCurrentUserKeyPair());
  await walletManager.saveWallet(walletObj);
  
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error);
  } else if (error instanceof WebAuthnError) {
    console.error('WebAuthn error:', error);
  } else if (error instanceof NetworkError) {
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
console.log('Entropy:', wallet.entropy);

// Verify different wallets are created from different salts
const wallet1 = await WalletManager.createWalletFromSalt(gunKeyPair, 'salt1');
const wallet2 = await WalletManager.createWalletFromSalt(gunKeyPair, 'salt2');
console.log(wallet1.address !== wallet2.address); // true
```

### Import/Export

```typescript
// Export all data
const backup = await manager.exportAllData();

// Import data
await manager.importAllData(backup);

// Export Gun keypair
const keypair = await manager.exportGunKeyPair();

// Import Gun keypair
const pubKey = await manager.importGunKeyPair(keypairJson);
```

### WebAuthn Authentication

```typescript
// Initialize WalletManager
const manager = new WalletManager(gunOptions, APP_KEY_PAIR);

// Check if WebAuthn is supported
if (manager.webAuthnService.isSupported()) {
  // Create account with WebAuthn
  try {
    const result = await manager.createAccountWithWebAuthn('username');
    console.log('Account created:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

WebAuthn provides:
- 🔐 Biometric authentication
- 🔑 Platform-specific secure key storage
- 🌐 Passwordless authentication
- 🔒 Enhanced phishing protection
- ⚡ Seamless user experience

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
await manager.saveWallet(wallet);
```

## 🐛 Debugging

For debugging purposes:

1. Enable Gun.js debug logs:
```bash
GUN_ENV=debug
```

2. Use browser developer tools to inspect:
   - Gun data synchronization
   - Network requests

3. Monitor Gun events:
```typescript
const gun = manager.gunAuthManager.getGun();

gun.on('out', data => {
  console.log('Gun out:', data);
});

gun.on('in', data => {
  console.log('Gun in:', data);
});
```

## 📦 Interfaces

```typescript
interface WalletResult {
  walletObj: {
    address: string;
    privateKey: string;
    entropy: string;
  };
  entropy: string;
}

interface ActivityPubKeys {
  publicKey: string;
  privateKey: string;
}

interface GunKeyPair {
  pub: string;
  priv: string;
  epub?: string;
  epriv?: string;
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run specific test
npm test -- -g "Wallet Creation"
```

## 💻 Compatibility

- **Browser**: 
  - Chrome >= 80
  - Firefox >= 78
  - Safari >= 14
  - Edge >= 80
  - Web Crypto API support required

- **Node.js**:
  - Version >= 16.0.0
  - crypto module support

## 🤝 Contributing

Pull requests are welcome! For major changes:

1. 🍴 Fork the repository
2. 🔧 Create a branch
3. 💾 Commit changes
4. 🚀 Push branch
5. 📝 Open a Pull Request

## 📄 License

[MIT](LICENSE)

## 🗺️ Roadmap

- [ ] Enhanced ActivityPub integration
- [ ] Improved WebAuthn support
- [ ] Additional wallet types support

## 🏗️ Project Structure

### Core Components

```typescript
Shogun (Main Class)
├── WalletManager
│   └── Wallet operations and management
├── WebAuthnService
│   └── Biometric authentication
├── ActivityPubManager
│   └── ActivityPub integration
├── EthereumManager
│   └── Ethereum operations
├── StealthChain
│   └── Stealth address operations
└── GunAuthManager
    └── Gun.js authentication

```

### Key Features by Component

#### 🏰 Shogun
- Central orchestrator
- Manages all components
- Handles data import/export
- Provides access to all services

#### 🔑 WalletManager
- Account creation and login
- Wallet creation and storage
- Key pair management
- Secure storage

#### 🔐 WebAuthnService
- Biometric authentication
- Platform authenticator support
- Passwordless login
- Security key support

#### 🌐 ActivityPubManager
- Federation support
- Key management
- Data signing
- Protocol integration

#### ⛓️ EthereumManager
- Ethereum wallet operations
- Transaction management
- Smart contract interaction
- Network configuration

#### 🕶️ StealthChain
- Stealth address generation
- Private transactions
- Key management
- Privacy features

#### 🔫 GunAuthManager
- Gun.js integration
- P2P data sync
- User authentication
- Secure storage
