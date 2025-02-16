# WebauthnAuth

The `WebauthnAuth` class provides a secure authentication layer using WebAuthn (Web Authentication) standard, enabling passwordless authentication with biometric and hardware security keys while integrating with GunDB for secure data storage.

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
import { WebauthnAuth } from '@hedgehog/blockchain';
import Gun from 'gun';

// Initialize GunDB
const gun = Gun();
const APP_KEY_PAIR = {...}; // Your SEA key pair

// Create WebAuthn instance
const webAuth = new WebauthnAuth(gun, APP_KEY_PAIR);

// Check if WebAuthn is supported
if (webAuth.isSupported()) {
  console.log("WebAuthn is supported on this device");
}
```

## API Reference

### Constructor

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Creates a new instance of WebauthnAuth.

### Authentication Methods

#### createAccount

```typescript
public async createAccount(
  username: string,
  isNewDevice: boolean = false,
  deviceName?: string
): Promise<Record<string, any>>
```

Creates a new WebAuthn account or adds a new device to an existing account.

- **Parameters:**
  - `username`: Username for the account
  - `isNewDevice`: Whether this is a new device for an existing account
  - `deviceName`: Optional custom name for the device
- **Returns:** Promise with account creation result
- **Throws:** `Error` if username is invalid or account creation fails

#### authenticateUser

```typescript
public async authenticateUser(username: string): Promise<WebAuthnResult>
```

Authenticates a user using WebAuthn credentials.

- **Parameters:**
  - `username`: Username to authenticate
- **Returns:** Promise with authentication result including credentials
- **Throws:** `Error` if authentication fails

#### generateCredentials

```typescript
public async generateCredentials(
  username: string,
  isNewDevice: boolean = false,
  deviceName?: string
): Promise<WebAuthnResult>
```

Generates new WebAuthn credentials for a user.

- **Parameters:**
  - `username`: Username for credential generation
  - `isNewDevice`: Whether this is a new device
  - `deviceName`: Optional custom device name
- **Returns:** Promise with generated credentials
- **Throws:** `Error` if credential generation fails

### Device Management Methods

#### getRegisteredDevices

```typescript
public async getRegisteredDevices(username: string): Promise<DeviceCredential[]>
```

Retrieves all registered devices for a user.

- **Parameters:**
  - `username`: Username to check
- **Returns:** Promise with array of registered devices

#### removeDevice

```typescript
public async removeDevice(
  username: string,
  credentialId: string
): Promise<boolean>
```

Removes a registered device.

- **Parameters:**
  - `username`: Username of the account
  - `credentialId`: ID of the credential to remove
- **Returns:** Promise resolving to true if device was removed

#### verifyCredential

```typescript
public async verifyCredential(
  credentialId: string
): Promise<WebAuthnVerifyResult>
```

Verifies a WebAuthn credential.

- **Parameters:**
  - `credentialId`: ID of the credential to verify
- **Returns:** Promise with verification result
- **Throws:** `Error` if verification fails

### Utility Methods

#### isSupported

```typescript
public isSupported(): boolean
```

Checks if WebAuthn is supported in the current environment.

- **Returns:** `true` if WebAuthn is supported

#### getPairFromGun

```typescript
public getPairFromGun(): GunKeyPair
```

Gets the current GunDB key pair.

- **Returns:** Current GunDB key pair

## Examples

### Creating a New Account

```typescript
try {
  const result = await webAuth.createAccount("username");
  if (result.success) {
    console.log("Account created successfully");
    console.log("Device ID:", result.deviceInfo.deviceId);
  }
} catch (error) {
  console.error("Error creating account:", error);
}
```

### Adding a New Device

```typescript
try {
  const result = await webAuth.createAccount("username", true, "My iPhone");
  if (result.success) {
    console.log("New device added successfully");
    console.log("Device info:", result.deviceInfo);
  }
} catch (error) {
  console.error("Error adding device:", error);
}
```

### Authenticating a User

```typescript
try {
  const result = await webAuth.authenticateUser("username");
  if (result.success) {
    console.log("Authentication successful");
    console.log("Credential ID:", result.credentialId);
  }
} catch (error) {
  console.error("Authentication failed:", error);
}
```

### Managing Devices

```typescript
// List devices
try {
  const devices = await webAuth.getRegisteredDevices("username");
  devices.forEach(device => {
    console.log(`Device: ${device.name} (${device.deviceId})`);
    console.log(`Platform: ${device.platform}`);
    console.log(`Last used: ${new Date(device.timestamp)}`);
  });
} catch (error) {
  console.error("Error listing devices:", error);
}

// Remove device
try {
  const removed = await webAuth.removeDevice("username", "credential-id");
  if (removed) {
    console.log("Device removed successfully");
  }
} catch (error) {
  console.error("Error removing device:", error);
}
```

## Security Features

The WebauthnAuth class implements several security measures:

1. **Strong Authentication**
   - Biometric authentication support
   - Hardware security key support
   - Platform authenticator integration
   - User verification requirement

2. **Credential Management**
   - Secure credential generation
   - Device-specific credentials
   - Credential verification
   - Safe credential storage

3. **Device Security**
   - Device identification
   - Platform verification
   - Multiple device support
   - Device removal capability

4. **Data Protection**
   - Challenge-based authentication
   - Secure key generation
   - Salt-based credential derivation
   - Encrypted storage integration

5. **Error Handling**
   - Timeout management
   - Operation abortion capability
   - Secure error messaging
   - Retry mechanisms

6. **Username Security**
   - Length validation
   - Character restriction
   - Existing username verification
   - Case sensitivity handling

## Technical Details

### WebAuthn Implementation

The implementation follows the WebAuthn Level 2 specification and includes:
- Platform authenticator preference
- User verification requirement
- Resident key requirement
- ES256 and RS256 algorithm support
- Attestation direct requirement

### Device Identification

Each device is uniquely identified using:
- Platform information
- Timestamp
- Random component
- Device name (custom or auto-generated)

### Timeout Handling

All WebAuthn operations have a 60-second timeout with:
- Automatic operation abortion
- Resource cleanup
- Clear error messaging
- State reset capability 