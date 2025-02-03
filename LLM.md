# 🤖 Shogun - LLM Guide

This guide is specifically designed for Large Language Models interacting with Shogun.

## 📚 Overview

Shogun is a decentralized wallet manager that uses Gun.js to handle wallets and private keys directly in the browser. It supports:
- Traditional authentication (username/password)
- Biometric authentication (WebAuthn)
- Stealth addresses
- Decentralized storage
- Cryptographic key management
- Web3 integration
- ActivityPub integration

## 🔑 Account Management

### Standard Account Creation
```typescript
const manager = new WalletManager(gunOptions, APP_KEY_PAIR);
await manager.createAccount(alias, passphrase);
```
- `alias`: string - User's username
- `passphrase`: string - User's password
- Returns: Promise<void>
- Common errors: "Account already exists", "Network error"

### WebAuthn Account Creation
```typescript
if (manager.webAuthnService.isSupported()) {
  const result = await manager.createAccountWithWebAuthn(alias);
}
```
- `alias`: string - User's username
- Returns: Promise<WalletResult>
- Always verify WebAuthn support before use

### Login Methods
```typescript
// Standard login
const pubKey = await manager.login(alias, passphrase);

// WebAuthn login
const pubKey = await manager.loginWithWebAuthn(alias);

// Ethereum private key login
const pubKey = await manager.loginWithPrivateKey(privateKey);
```

## 💼 Wallet Management

### Wallet Creation
```typescript
// Creation from Gun keypair
const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);

// Creation from specific salt
const wallet = await WalletManager.createWalletFromSalt(gunKeyPair, salt);
```

### Wallet Storage
```typescript
// Save wallet
await manager.saveWallet(wallet);

// Retrieve wallet
const wallet = await manager.getWallet();
```

## 🔒 Data Management

### Export/Import
```typescript
// Full export
const backup = await manager.exportAllData();

// Full import
await manager.importAllData(backup);

// Gun keypair export/import
const keypair = await manager.exportGunKeyPair();
const pubKey = await manager.importGunKeyPair(keypairJson);
```

## 🔐 ActivityPub Integration

### Key Management
```typescript
// Get private key
const privateKey = await manager.getPrivateKey(username);

// Save ActivityPub keys
await manager.saveActivityPubKeys(keys);

// Get ActivityPub keys
const keys = await manager.getActivityPubKeys();

// Delete ActivityPub keys
await manager.deleteActivityPubKeys();

// Sign data
const { signature, signatureHeader } = await manager.signActivityPubData(stringToSign, username);
```

## 🔍 Validations

Always validate:

1. User Input
   - Username: non-empty string
   - Password: minimum length and complexity
   - Ethereum addresses: valid format (0x...)

2. System State
   - WebAuthn support: `webAuthnService.isSupported()`
   - Authentication: `manager.getPublicKey()`
   - Gun availability: `manager.gunAuthManager.getGun()`

3. Wallet Data
   - Address validity: starts with "0x" and length 42
   - Private key presence
   - Entropy for deterministic derivation

## ⚠️ Error Handling

Main error types:
1. Authentication errors
   - "User not authenticated"
   - "Invalid credentials"
   - "Account already exists"

2. WebAuthn errors
   - "WebAuthn not supported"
   - "Biometric verification failed"
   - "User verification required"

3. Network errors
   - "Network error"
   - "Connection timeout"
   - "Gun peer unreachable"

4. Validation errors
   - "Invalid Ethereum address"
   - "Invalid private key"
   - "Invalid username format"

Error handling example:
```typescript
try {
  await manager.createAccountWithWebAuthn(alias);
} catch (error) {
  if (error instanceof WebAuthnError) {
    // Handle WebAuthn specific error
  } else if (error instanceof ValidationError) {
    // Handle validation error
  } else {
    // Handle other errors
    console.error('Error:', error);
  }
}
```

## 🔫 Gun Data Structure

### Wallets
```typescript
// Save wallet
await gun.get('users')
  .get(publicKey)
  .get('wallet')
  .put({
    address: wallet.address,
    privateKey: encryptedPrivateKey,
    entropy: wallet.entropy
  });

// Retrieve wallet
gun.get('users')
  .get(publicKey)
  .get('wallet')
  .once((data) => {
    if (data?.entropy) {
      // Regenerate wallet from entropy
      const wallet = createWalletFromSalt(data.entropy);
    }
  });
```

### ActivityPub Keys
```typescript
// Save ActivityPub keys
await gun.get('users')
  .get(publicKey)
  .get('activityPubKeys')
  .put({
    publicKey: keys.publicKey,
    privateKey: encryptedPrivateKey
  });

// Retrieve ActivityPub keys
gun.get('users')
  .get(publicKey)
  .get('activityPubKeys')
  .once((data) => {
    if (data?.publicKey && data?.privateKey) {
      // Use keys for ActivityPub operations
    }
  });
```

### Best Practices

1. **Concurrency Management**
   ```typescript
   // Use once() for single reads
   gun.once((data) => {});
   
   // Use on() for data that changes
   gun.on((data) => {});
   ```

2. **Timeouts and Errors**
   ```typescript
   // Always implement timeouts
   const timeout = setTimeout(() => {
     reject(new Error("Timeout"));
   }, 25000);

   gun.once((data) => {
     clearTimeout(timeout);
     // Process data
   });
   ```

3. **Data Validation**
   ```typescript
   // Always validate received data
   gun.once((data) => {
     if (!data || !data.required_field) {
       throw new Error("Invalid data");
     }
     // Process valid data
   });
   ```

### Debugging

1. **Structured Logging**
   ```typescript
   gun.once((data) => {
     console.log("📥 Data received:", {
       path: "users/" + publicKey,
       data,
       timestamp: new Date()
     });
   });
   ```

2. **Error Handling**
   ```typescript
   try {
     await gun.get("path").put(data);
   } catch (error) {
     console.error("❌ Gun error:", {
       operation: "put",
       path: "path",
       error: error.message
     });
   }
   ``` 