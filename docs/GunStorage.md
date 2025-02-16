# GunStorage

The `GunStorage` is an abstract base class that provides a secure and reliable storage layer for GunDB, implementing robust data persistence, encryption, and error handling mechanisms.

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
import { GunStorage } from '@hedgehog/blockchain';
import Gun from 'gun';

// Extend GunStorage for your specific storage needs
class MyStorage extends GunStorage<MyDataType> {
  protected storagePrefix = "my-storage";
  
  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
  }
  
  // Implement your storage-specific methods
}
```

## API Reference

### Constructor

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Creates a new instance of GunStorage.

- **Parameters:**
  - `gun`: GunDB instance
  - `APP_KEY_PAIR`: SEA cryptographic key pair

### Data Management Methods

#### savePrivateData

```typescript
protected async savePrivateData(data: T, path: string = ""): Promise<boolean>
```

Securely saves private data with verification.

- **Parameters:**
  - `data`: Data to store
  - `path`: Storage path (optional)
- **Returns:** Promise resolving to true if save successful
- **Throws:** `Error` if user is not authenticated

#### savePublicData

```typescript
protected async savePublicData(data: any, path: string = ""): Promise<boolean>
```

Saves public data accessible to other users.

- **Parameters:**
  - `data`: Data to store
  - `path`: Storage path (optional)
- **Returns:** Promise resolving to true if save successful
- **Throws:** `Error` if user is not authenticated

#### getPrivateData

```typescript
protected async getPrivateData(path: string = ""): Promise<T | null>
```

Retrieves private data.

- **Parameters:**
  - `path`: Storage path (optional)
- **Returns:** Promise with retrieved data or null
- **Throws:** `Error` if user is not authenticated

#### getPublicData

```typescript
protected async getPublicData(publicKey: string, path: string = ""): Promise<any>
```

Retrieves public data by public key.

- **Parameters:**
  - `publicKey`: Public key of the data owner
  - `path`: Storage path (optional)
- **Returns:** Promise with retrieved data

### Data Deletion Methods

#### deletePrivateData

```typescript
protected async deletePrivateData(path: string = ""): Promise<void>
```

Deletes private data with verification.

- **Parameters:**
  - `path`: Storage path (optional)
- **Throws:** `Error` if deletion fails after multiple attempts

#### deletePublicData

```typescript
protected async deletePublicData(path?: string): Promise<void>
```

Deletes public data with verification.

- **Parameters:**
  - `path`: Storage path (optional)
- **Throws:** `Error` if deletion fails or times out

### Node Management Methods

#### getPrivateNode

```typescript
protected getPrivateNode(path: string = ""): IGunChain
```

Gets a private data node.

- **Parameters:**
  - `path`: Storage path (optional)
- **Returns:** GunDB chain for private data
- **Throws:** `Error` if user is not authenticated

#### getPublicNode

```typescript
protected getPublicNode(path: string = ""): IGunChain
```

Gets a public data node.

- **Parameters:**
  - `path`: Storage path (optional)
- **Returns:** GunDB chain for public data
- **Throws:** `Error` if public key not found

### Utility Methods

#### cleanup

```typescript
public cleanup(): void
```

Cleans up resources and terminates user session.

#### isAuthenticated

```typescript
protected isAuthenticated(): boolean
```

Checks authentication status.

- **Returns:** `true` if user is authenticated

#### getCurrentPublicKey

```typescript
protected getCurrentPublicKey(): string
```

Gets current user's public key.

- **Returns:** Public key string
- **Throws:** `Error` if user is not authenticated

## Examples

### Implementing a Custom Storage Class

```typescript
interface UserData {
  name: string;
  email: string;
  preferences: Record<string, any>;
}

class UserStorage extends GunStorage<UserData> {
  protected storagePrefix = "users";
  
  constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair) {
    super(gun, APP_KEY_PAIR);
  }
  
  async saveUserData(data: UserData): Promise<boolean> {
    return this.savePrivateData(data, 'profile');
  }
  
  async getUserData(): Promise<UserData | null> {
    return this.getPrivateData('profile');
  }
  
  async sharePublicProfile(data: Partial<UserData>): Promise<boolean> {
    return this.savePublicData(data, 'public-profile');
  }
}
```

### Using Private Data Storage

```typescript
const storage = new UserStorage(gun, APP_KEY_PAIR);

// Save private data
try {
  const saved = await storage.saveUserData({
    name: "John Doe",
    email: "john@example.com",
    preferences: { theme: "dark" }
  });
  console.log("Data saved:", saved);
} catch (error) {
  console.error("Error saving data:", error);
}

// Retrieve private data
try {
  const userData = await storage.getUserData();
  console.log("Retrieved data:", userData);
} catch (error) {
  console.error("Error retrieving data:", error);
}
```

### Managing Public Data

```typescript
// Share public profile
try {
  const shared = await storage.sharePublicProfile({
    name: "John Doe",
    preferences: { theme: "dark" }
  });
  console.log("Profile shared:", shared);
} catch (error) {
  console.error("Error sharing profile:", error);
}
```

## Technical Details

### Data Persistence

The storage implementation includes:
- Verification of saved data
- Multiple save attempts
- Cleanup of existing data before saves
- Timeout handling for operations

### Error Handling

Robust error handling with:
- Authentication verification
- Operation timeouts
- Multiple retry attempts
- Detailed error messages
- Resource cleanup

### Data Security

Security features include:
- Private/public data separation
- Authentication checks
- Metadata cleaning
- Path sanitization
- Node access control

### Performance Optimization

Performance features:
- Efficient data cleaning
- Metadata management
- Array handling optimization
- Resource cleanup
- Session management 