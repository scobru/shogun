# GunAuth

The `GunAuth` class provides a secure authentication layer for GunDB, handling user management, session control, and cryptographic operations integrated with GunDB's SEA (Security, Encryption, Authorization) system.

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Security Features](#security-features)

## Installation

```bash
npm install @shogun/blockchain
```

## Usage

```typescript
import { GunAuth } from '@hedgehog/blockchain';
import Gun from 'gun';

// Initialize GunDB
const gun = Gun();
const APP_KEY_PAIR = {...}; // Your SEA key pair

// Create auth instance
const auth = new GunAuth(gun, APP_KEY_PAIR);
```

## API Reference

### Constructor

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Creates a new instance of GunAuth.

### Authentication Methods

#### createAccount

```typescript
public async createAccount(alias: string, passphrase: string): Promise<GunKeyPair>
```

Creates a new user account.

- **Parameters:**
  - `alias`: Username for the new account
  - `passphrase`: Password for account encryption
- **Returns:** Promise with the generated GunDB key pair
- **Throws:** 
  - `Error` if username is already taken
  - `Error` if account creation fails

#### login

```typescript
public async login(alias: string, passphrase: string): Promise<string | null>
```

Authenticates a user with their credentials.

- **Parameters:**
  - `alias`: Username
  - `passphrase`: Password
- **Returns:** Promise with user's public key or null
- **Throws:** `Error` for invalid credentials or authentication failures

#### logout

```typescript
public logout(): void
```

Logs out the current user and clears the session.

#### checkUser

```typescript
public async checkUser(username: string, password: string): Promise<string>
```

Verifies if a username is available and creates an account if it is.

- **Parameters:**
  - `username`: Username to check
  - `password`: Password for new account
- **Returns:** Promise with the public key of created user
- **Throws:** `Error` if username is taken or creation fails

### Data Management Methods

#### savePrivateData

```typescript
public async savePrivateData(data: any, path: string): Promise<boolean>
```

Securely stores private user data.

- **Parameters:**
  - `data`: Data to store
  - `path`: Storage path
- **Returns:** Promise resolving to true if save successful
- **Throws:** `Error` if user is not authenticated or save fails

#### getPrivateData

```typescript
public async getPrivateData(path: string): Promise<any>
```

Retrieves private user data.

- **Parameters:**
  - `path`: Storage path
- **Returns:** Promise with retrieved data
- **Throws:** `Error` if user is not authenticated

#### savePublicData

```typescript
public async savePublicData(data: any, path: string): Promise<boolean>
```

Stores public user data.

- **Parameters:**
  - `data`: Data to store
  - `path`: Storage path
- **Returns:** Promise resolving to true if save successful
- **Throws:** `Error` if user is not authenticated

#### getPublicData

```typescript
public async getPublicData(publicKey: string, path: string): Promise<any>
```

Retrieves public data of any user.

- **Parameters:**
  - `publicKey`: Public key of target user
  - `path`: Storage path
- **Returns:** Promise with retrieved data
- **Throws:** `Error` if user is not authenticated

### Key Management Methods

#### exportGunKeyPair

```typescript
public async exportGunKeyPair(): Promise<string>
```

Exports the current user's key pair.

- **Returns:** Promise with stringified key pair
- **Throws:** `Error` if user is not authenticated

#### importGunKeyPair

```typescript
public async importGunKeyPair(keyPairJson: string): Promise<string>
```

Imports and authenticates with a key pair.

- **Parameters:**
  - `keyPairJson`: Stringified key pair
- **Returns:** Promise with public key
- **Throws:** `Error` for invalid key pair or import failure

### Utility Methods

#### isAuthenticated

```typescript
public isAuthenticated(): boolean
```

Checks if a user is currently authenticated.

- **Returns:** `true` if user is authenticated, `false` otherwise

#### exists

```typescript
public async exists(alias: string): Promise<boolean>
```

Checks if a username is taken.

- **Parameters:**
  - `alias`: Username to check
- **Returns:** Promise resolving to true if username exists

## Examples

### Creating a New Account

```typescript
try {
  const keyPair = await auth.createAccount("username", "password123");
  console.log("Account created successfully:", keyPair.pub);
} catch (error) {
  console.error("Error creating account:", error);
}
```

### User Login

```typescript
try {
  const publicKey = await auth.login("username", "password123");
  if (publicKey) {
    console.log("Login successful. Public key:", publicKey);
  }
} catch (error) {
  console.error("Login failed:", error);
}
```

### Storing Private Data

```typescript
try {
  const data = { secret: "my private data" };
  await auth.savePrivateData(data, "secrets/personal");
  console.log("Data saved successfully");
} catch (error) {
  console.error("Error saving data:", error);
}
```

### Exporting/Importing Keys

```typescript
// Export keys
try {
  const keyPairJson = await auth.exportGunKeyPair();
  console.log("Exported key pair:", keyPairJson);
  
  // Import keys
  const publicKey = await auth.importGunKeyPair(keyPairJson);
  console.log("Imported and authenticated with key pair:", publicKey);
} catch (error) {
  console.error("Key operation failed:", error);
}
```

## Security Features

The GunAuth class implements several security measures:

1. **Session Management**
   - Automatic session cleanup on logout
   - Authentication state verification
   - Timeout handling for operations

2. **Data Protection**
   - SEA encryption for private data
   - Public/private data separation
   - Secure key pair handling

3. **Error Handling**
   - Retry mechanisms for network issues
   - Validation of all cryptographic operations
   - Secure error messages

4. **State Management**
   - Safe state reset procedures
   - Authentication state tracking
   - Concurrent operation handling

5. **Data Integrity**
   - Verification of saved data
   - Multiple save attempts for reliability
   - Data comparison checks 