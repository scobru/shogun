# ActivityPub

The `ActivityPub` class extends `GunStorage` to provide a secure implementation of the ActivityPub protocol, handling key management, authentication, and cryptographic operations for decentralized social networking.

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Technical Details](#technical-details)

## Installation

```bash
npm install @hedgehog/blockchain
```

## Usage

```typescript
import { ActivityPub } from '@hedgehog/blockchain';
import Gun from 'gun';

// Initialize GunDB
const gun = Gun();
const APP_KEY_PAIR = {...}; // Your SEA key pair

// Create ActivityPub instance
const activityPub = new ActivityPub(gun, APP_KEY_PAIR);
```

## API Reference

### Constructor

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Creates a new instance of ActivityPub.

### Account Management Methods

#### createAccount

```typescript
public async createAccount(): Promise<ActivityPubKeys>
```

Generates a new RSA key pair for ActivityPub.

- **Returns:** Promise with generated ActivityPub keys
- **Throws:** `Error` if key generation fails

#### login

```typescript
public async login(username: string, password: string): Promise<string>
```

Authenticates a user with their credentials.

- **Parameters:**
  - `username`: Username to authenticate
  - `password`: User's password
- **Returns:** Promise with user's public key
- **Throws:** `Error` if authentication fails

### Key Management Methods

#### saveKeys

```typescript
public async saveKeys(keys: ActivityPubKeys): Promise<void>
```

Securely stores ActivityPub keys with verification.

- **Parameters:**
  - `keys`: ActivityPub key pair to store
- **Throws:** `Error` if save fails or verification fails

#### getKeys

```typescript
public async getKeys(): Promise<ActivityPubKeys>
```

Retrieves stored ActivityPub keys.

- **Returns:** Promise with ActivityPub keys
- **Throws:** `Error` if user is not authenticated

#### getPub

```typescript
public async getPub(): Promise<string>
```

Retrieves the public key.

- **Returns:** Promise with public key
- **Throws:** `Error` if user is not authenticated

#### getPk

```typescript
public async getPk(username: string): Promise<string>
```

Retrieves the private key for a username.

- **Parameters:**
  - `username`: Username to retrieve key for
- **Returns:** Promise with private key
- **Throws:** `Error` if username is invalid or key not found

#### deleteKeys

```typescript
public async deleteKeys(): Promise<void>
```

Deletes stored ActivityPub keys with verification.

- **Throws:** `Error` if deletion fails or verification fails

### Cryptographic Operations

#### sign

```typescript
public async sign(
  stringToSign: string,
  username: string
): Promise<{ signature: string; signatureHeader: string }>
```

Signs ActivityPub data with user's private key.

- **Parameters:**
  - `stringToSign`: Data to sign
  - `username`: Username associated with the private key
- **Returns:** Promise with signature and signature header
- **Throws:** `Error` if signing fails

#### importPk

```typescript
public async importPk(pem: string): Promise<CryptoKey | string>
```

Imports a private key from PEM format.

- **Parameters:**
  - `pem`: PEM-formatted private key
- **Returns:** Promise with imported CryptoKey or PEM string
- **Throws:** `Error` if import fails

## Examples

### Creating a New Account

```typescript
try {
  const keys = await activityPub.createAccount();
  console.log("Account created with public key:", keys.publicKey);
} catch (error) {
  console.error("Error creating account:", error);
}
```

### Signing ActivityPub Data

```typescript
try {
  const data = "Message to sign";
  const username = "alice";
  const { signature, signatureHeader } = await activityPub.sign(data, username);
  console.log("Signature:", signature);
  console.log("Signature Header:", signatureHeader);
} catch (error) {
  console.error("Error signing data:", error);
}
```

### Managing Keys

```typescript
// Save keys
try {
  const keys = {
    publicKey: "-----BEGIN PUBLIC KEY-----\n...",
    privateKey: "-----BEGIN PRIVATE KEY-----\n...",
    createdAt: Date.now()
  };
  await activityPub.saveKeys(keys);
  console.log("Keys saved successfully");
} catch (error) {
  console.error("Error saving keys:", error);
}

// Retrieve keys
try {
  const keys = await activityPub.getKeys();
  console.log("Retrieved keys:", keys);
} catch (error) {
  console.error("Error retrieving keys:", error);
}

// Delete keys
try {
  await activityPub.deleteKeys();
  console.log("Keys deleted successfully");
} catch (error) {
  console.error("Error deleting keys:", error);
}
```

## Technical Details

### Key Generation

The implementation supports both Node.js and browser environments:
- Node.js: Uses native `crypto` module
- Browser: Uses Web Crypto API
- 2048-bit RSA key pairs
- PKCS#8/SPKI formats for private/public keys

### Security Features

1. **Key Management**
   - Secure key generation
   - Key format validation
   - Secure key storage
   - Key deletion verification

2. **Cryptographic Operations**
   - RSA-SHA256 signatures
   - PEM format handling
   - Cross-platform compatibility
   - Key import/export capabilities

3. **Data Protection**
   - Private/public key separation
   - Secure storage integration
   - Multiple save verification
   - Deletion verification

4. **Error Handling**
   - Environment detection
   - Key validation
   - Operation timeouts
   - Multiple retry attempts

### Platform Compatibility

The implementation automatically adapts to the runtime environment:
- Node.js: Uses native crypto module
- Browser: Uses Web Crypto API
- Fallback mechanisms
- Environment-specific optimizations

### Performance Considerations

- Asynchronous operations
- Verification retries
- Timeout handling
- Resource cleanup
- Environment-specific optimizations 