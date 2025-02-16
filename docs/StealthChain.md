# StealthChain

The `StealthChain` class extends `GunStorage` to provide a secure implementation of stealth addresses for Ethereum, enabling private transactions through one-time addresses while integrating with GunDB for secure key storage.

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
import { StealthChain } from '@hedgehog/blockchain';
import Gun from 'gun';

// Initialize GunDB
const gun = Gun();
const APP_KEY_PAIR = {...}; // Your SEA key pair

// Create StealthChain instance
const stealth = new StealthChain(gun, APP_KEY_PAIR);
```

## API Reference

### Constructor

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Creates a new instance of StealthChain.

### Account Management Methods

#### createAccount

```typescript
public async createAccount(): Promise<StealthKeyPair>
```

Generates or retrieves stealth keys for the current user.

- **Returns:** Promise with stealth key pair
- **Throws:** `Error` if key generation fails

### Stealth Address Operations

#### generateStAdd

```typescript
public async generateStAdd(recipientPublicKey: string): Promise<{
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}>
```

Generates a stealth address for a recipient.

- **Parameters:**
  - `recipientPublicKey`: Recipient's public key
- **Returns:** Promise with stealth address details
- **Throws:** `Error` if generation fails

#### openStAdd

```typescript
public async openStAdd(
  stealthAddress: string,
  ephemeralPublicKey: string
): Promise<ethers.Wallet>
```

Derives the private key for a stealth address.

- **Parameters:**
  - `stealthAddress`: The stealth address to open
  - `ephemeralPublicKey`: The ephemeral public key used in generation
- **Returns:** Promise with derived Ethereum wallet
- **Throws:** `Error` if derivation fails

### Key Management Methods

#### save

```typescript
public async save(stealthKeyPair: StealthKeyPair): Promise<void>
```

Saves stealth keys to user's profile.

- **Parameters:**
  - `stealthKeyPair`: Stealth key pair to save
- **Throws:** `Error` if keys are invalid or save fails

#### getPair

```typescript
public async getPair(): Promise<StealthKeyPair>
```

Retrieves current user's stealth keys.

- **Returns:** Promise with stealth key pair
- **Throws:** `Error` if keys not found

#### getPub

```typescript
public async getPub(publicKey: string): Promise<string | null>
```

Retrieves a user's stealth public key.

- **Parameters:**
  - `publicKey`: User's public key
- **Returns:** Promise with stealth public key or null

#### retrieveKeys

```typescript
public async retrieveKeys(publicKey: string): Promise<any>
```

Retrieves stealth keys from public registry.

- **Parameters:**
  - `publicKey`: Public key to retrieve stealth keys for
- **Returns:** Promise with retrieved keys or null

#### retrievePair

```typescript
public async retrievePair(publicKey: string): Promise<StealthKeyPair | null>
```

Retrieves complete stealth key pair for a user.

- **Parameters:**
  - `publicKey`: Public key to retrieve pair for
- **Returns:** Promise with stealth key pair or null

## Examples

### Creating a Stealth Account

```typescript
try {
  const stealthKeys = await stealth.createAccount();
  console.log("Stealth keys generated:", stealthKeys.pub);
} catch (error) {
  console.error("Error creating stealth account:", error);
}
```

### Generating a Stealth Address

```typescript
try {
  const recipientPubKey = "recipient-public-key";
  const { stealthAddress, ephemeralPublicKey } = await stealth.generateStAdd(recipientPubKey);
  console.log("Stealth Address:", stealthAddress);
  console.log("Ephemeral Public Key:", ephemeralPublicKey);
} catch (error) {
  console.error("Error generating stealth address:", error);
}
```

### Opening a Stealth Address

```typescript
try {
  const stealthAddress = "0x...";
  const ephemeralPublicKey = "ephemeral-public-key";
  const wallet = await stealth.openStAdd(stealthAddress, ephemeralPublicKey);
  console.log("Derived Address:", wallet.address);
  console.log("Private Key:", wallet.privateKey);
} catch (error) {
  console.error("Error opening stealth address:", error);
}
```

### Managing Stealth Keys

```typescript
// Save stealth keys
try {
  const keys = {
    pub: "public-key",
    priv: "private-key",
    epub: "ephemeral-public-key",
    epriv: "ephemeral-private-key"
  };
  await stealth.save(keys);
  console.log("Stealth keys saved successfully");
} catch (error) {
  console.error("Error saving stealth keys:", error);
}

// Retrieve stealth keys
try {
  const keys = await stealth.getPair();
  console.log("Retrieved stealth keys:", keys.pub);
} catch (error) {
  console.error("Error retrieving stealth keys:", error);
}
```

## Technical Details

### Stealth Address Generation

The implementation uses a secure stealth address protocol:
- Ephemeral key pair generation
- Shared secret derivation
- One-time address generation
- Secure key exchange

### Security Features

1. **Key Generation**
   - Secure random number generation
   - Ephemeral key pairs
   - Shared secret computation
   - One-time address derivation

2. **Key Management**
   - Secure key storage
   - Public/private key separation
   - Key format validation
   - Key cleanup

3. **Address Security**
   - One-time addresses
   - Address verification
   - Secure derivation
   - Ephemeral key handling

4. **Data Protection**
   - Private key encryption
   - Secure storage integration
   - Key pair validation
   - Data sanitization

### Privacy Features

The stealth address system provides:
- Transaction privacy
- Address unlinkability
- Recipient anonymity
- Payment non-traceability

### Performance Optimization

- Efficient key derivation
- Caching mechanisms
- Asynchronous operations
- Resource management
- Error recovery 