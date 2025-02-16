# JsonRpcConnector

The `JsonRpcConnector` is a JSON-RPC connector for Ethereum blockchain integration that provides a secure interaction layer with GunDB for wallet management, authentication, and cryptographic operations.

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Examples](#examples)

## Installation

```bash
npm install @shogun/blockchain
```

## Usage

```typescript
import { JsonRpcConnector } from '@shogun/blockchain';
import Gun from 'gun';

// Initialize GunDB
const gun = Gun();
const APP_KEY_PAIR = {...}; // Your SEA key pair

// Create connector instance
const connector = new JsonRpcConnector(gun, APP_KEY_PAIR);
```

## API Reference

### Constructor

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Creates a new instance of JsonRpcConnector.

### Main Methods

#### setCustomProvider

```typescript
public setCustomProvider(rpcUrl: string, privateKey: string): void
```

Configures a custom JSON-RPC provider.

- **Parameters:**
  - `rpcUrl`: RPC endpoint URL
  - `privateKey`: Wallet private key
- **Throws:** `ValidationError` if parameters are invalid

#### getSigner

```typescript
public async getSigner(): Promise<ethers.Signer>
```

Gets the active signer instance.

- **Returns:** Promise with Ethers.js Signer instance
- **Throws:** `AuthenticationError` if no signer is available

#### createAccount

```typescript
public async createAccount(): Promise<GunKeyPair>
```

Creates a new Ethereum account.

- **Returns:** Promise with the generated key pair
- **Throws:** 
  - `AuthenticationError` on authentication failure
  - `Error` on operation timeout

#### login

```typescript
public async login(): Promise<string>
```

Authenticates user with Ethereum wallet.

- **Returns:** Promise with authenticated user's public key
- **Throws:**
  - `ValidationError` for invalid Ethereum addresses
  - `AuthenticationError` on authentication failure

#### verifySignature

```typescript
public async verifySignature(message: string, signature: string): Promise<string>
```

Verifies a cryptographic signature.

- **Parameters:**
  - `message`: Original signed message
  - `signature`: Cryptographic signature
- **Returns:** Promise with recovered Ethereum address
- **Throws:** `Error` for invalid inputs

### Utility Methods

#### generatePassword

```typescript
public async generatePassword(signature: string): Promise<string>
```

Generates a deterministic password from a signature.

- **Parameters:**
  - `signature`: Cryptographic signature
- **Returns:** Promise with 64-character hex string
- **Throws:** `Error` for invalid signatures

#### isMetaMaskAvailable

```typescript
static isMetaMaskAvailable(): boolean
```

Checks if MetaMask is available in the browser.

- **Returns:** `true` if MetaMask is installed and available

## Examples

### Setting up a Custom Provider

```typescript
const connector = new JsonRpcConnector(gun, APP_KEY_PAIR);

// Configure custom provider with Infura
connector.setCustomProvider(
  "https://mainnet.infura.io/v3/YOUR-PROJECT-ID",
  "0xYOUR-PRIVATE-KEY"
);
```

### Creating a New Account

```typescript
try {
  const account = await connector.createAccount();
  console.log("New account created:", account);
} catch (error) {
  console.error("Error creating account:", error);
}
```

### Login with MetaMask

```typescript
try {
  const publicKey = await connector.login();
  console.log("Successfully logged in. Public key:", publicKey);
} catch (error) {
  console.error("Error during login:", error);
}
```

### Verifying a Signature

```typescript
const message = "Message to verify";
const signature = "0x..."; // message signature

try {
  const signerAddress = await connector.verifySignature(message, signature);
  console.log("Signer address:", signerAddress);
} catch (error) {
  console.error("Error verifying signature:", error);
}
``` 