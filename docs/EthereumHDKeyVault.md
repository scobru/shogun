# EthereumHDKeyVault

The `EthereumHDKeyVault` is a secure storage system for Hierarchical Deterministic (HD) Ethereum wallets. It extends `GunStorage` to provide encrypted storage capabilities using GunDB, with support for BIP32/BIP39 HD wallet derivation.

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Examples](#examples)

## Installation

```bash
npm install @hedgehog/blockchain
```

## Usage

```typescript
import { EthereumHDKeyVault } from '@hedgehog/blockchain';
import Gun from 'gun';

// Initialize GunDB
const gun = Gun();
const APP_KEY_PAIR = {...}; // Your SEA key pair

// Create vault instance
const vault = new EthereumHDKeyVault(gun, APP_KEY_PAIR);
```

## API Reference

### Constructor

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Creates a new instance of EthereumHDKeyVault.

### Main Methods

#### createAccount

```typescript
public async createAccount(password?: string): Promise<WalletData>
```

Creates a new HD wallet account.

- **Parameters:**
  - `password` (optional): Password for additional encryption
- **Returns:** Promise with wallet data including address and private key
- **Throws:** 
  - `Error` if user is not authenticated
  - `Error` if account creation fails

#### getWallets

```typescript
public async getWallets(): Promise<ExtendedWallet[]>
```

Retrieves all HD wallets stored in the vault.

- **Returns:** Promise with array of extended wallet instances
- **Throws:** `Error` if retrieval fails or user is not authenticated

#### getWallet

```typescript
public async getWallet(): Promise<Wallet>
```

Gets the primary wallet (index 0).

- **Returns:** Promise with Ethers.js Wallet instance
- **Throws:** `Error` if wallet cannot be retrieved

#### getLegacyWallet

```typescript
public async getLegacyWallet(): Promise<Wallet>
```

Retrieves the legacy wallet derived from GunDB credentials.

- **Returns:** Promise with Ethers.js Wallet instance
- **Throws:** `Error` if wallet cannot be retrieved

#### getWalletByAddress

```typescript
public async getWalletByAddress(address: string): Promise<Wallet | null>
```

Finds a wallet by its Ethereum address.

- **Parameters:**
  - `address`: Ethereum address to search for
- **Returns:** Promise with Wallet instance or null if not found

#### getWalletByIndex

```typescript
public async getWalletByIndex(index: number): Promise<Wallet>
```

Retrieves a wallet by its HD path index.

- **Parameters:**
  - `index`: HD path index
- **Returns:** Promise with Wallet instance
- **Throws:** `Error` if wallet cannot be retrieved

#### deleteWallet

```typescript
public async deleteWallet(address: string): Promise<void>
```

Removes a wallet from storage.

- **Parameters:**
  - `address`: Ethereum address to delete
- **Throws:** `Error` if deletion fails

#### convertToEthPk

```typescript
public convertToEthPk(gunPrivateKey: string): string
```

Converts a GunDB private key to Ethereum format.

- **Parameters:**
  - `gunPrivateKey`: GunDB private key
- **Returns:** Ethereum-compatible private key
- **Throws:** `Error` if conversion fails

## Examples

### Creating a New Wallet

```typescript
try {
  const wallet = await vault.createAccount();
  console.log("New wallet created:", wallet.address);
} catch (error) {
  console.error("Error creating wallet:", error);
}
```

### Retrieving All Wallets

```typescript
try {
  const wallets = await vault.getWallets();
  wallets.forEach(wallet => {
    console.log(`Address: ${wallet.address}`);
    console.log(`HD Path: ${wallet.entropy}`);
    console.log(`Created: ${new Date(wallet.timestamp)}`);
  });
} catch (error) {
  console.error("Error retrieving wallets:", error);
}
```

### Getting Wallet by Address

```typescript
try {
  const address = "0x..."; // Ethereum address
  const wallet = await vault.getWalletByAddress(address);
  if (wallet) {
    console.log("Wallet found:", wallet.address);
  } else {
    console.log("Wallet not found");
  }
} catch (error) {
  console.error("Error retrieving wallet:", error);
}
```

### Deleting a Wallet

```typescript
try {
  const address = "0x..."; // Ethereum address
  await vault.deleteWallet(address);
  console.log("Wallet deleted successfully");
} catch (error) {
  console.error("Error deleting wallet:", error);
}
```

## Technical Details

### HD Wallet Derivation

The vault uses the standard Ethereum HD path `m/44'/60'/0'/0` as the base path, with each account being derived at an incremental index. For example:
- First account: `m/44'/60'/0'/0/0`
- Second account: `m/44'/60'/0'/0/1`
- etc.

### Security Features

- Encrypted storage using GunDB's SEA encryption
- BIP39 mnemonic phrase generation and storage
- Secure private key handling
- Authentication checks for all sensitive operations
- Retry mechanism for data persistence 