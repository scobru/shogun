# Micropayments System

A complete off-chain/on-chain micropayments system that enables efficient, secure, and scalable transactions using GunDB for off-chain state management and Ethereum smart contracts for settlement.

## Table of Contents
- [Overview](#overview)
- [Components](#components)
- [Installation](#installation)
- [API Reference](#api-reference)
- [Smart Contract](#smart-contract)
- [Examples](#examples)
- [Technical Details](#technical-details)

## Overview

The micropayments system consists of three main components:
1. `MicropaymentAPI`: Core TypeScript class for managing payment channels
2. `PaymentChannel`: Solidity smart contract for on-chain settlement
3. Example implementations for both client and relay nodes

## Components

### MicropaymentAPI

Core class that handles:
- Off-chain state management with GunDB
- Cryptographic operations
- Channel state updates
- On-chain interactions

### PaymentChannel Smart Contract

Solidity contract that manages:
- Channel creation and deposits
- State verification
- Challenge periods
- Final settlement

### Client/Relay Examples

Reference implementations showing:
- Channel initialization
- Payment processing
- State updates
- Settlement procedures

## Installation

```bash
npm install @hedgehog/blockchain
```

## API Reference

### MicropaymentAPI

#### Constructor

```typescript
constructor(
  relayUrl: string,
  providerUrl: string,
  contractAddress: string,
  contractABI: any[]
)
```

Creates a new MicropaymentAPI instance.

- **Parameters:**
  - `relayUrl`: GunDB relay URL
  - `providerUrl`: Ethereum provider URL
  - `contractAddress`: Payment channel contract address
  - `contractABI`: Contract ABI

#### Channel Management Methods

##### openOffChainChannel

```typescript
async openOffChainChannel(
  channelId: string,
  initialState: State
): Promise<StatePackage>
```

Opens a new off-chain payment channel.

- **Parameters:**
  - `channelId`: Unique channel identifier
  - `initialState`: Initial channel state
- **Returns:** State package with signature
- **Throws:** `Error` if channel creation fails

##### updateOffChainChannel

```typescript
async updateOffChainChannel(
  channelId: string,
  newState: State
): Promise<StatePackage>
```

Updates channel state off-chain.

- **Parameters:**
  - `channelId`: Channel identifier
  - `newState`: New channel state
- **Returns:** Updated state package
- **Throws:** `Error` if update fails

##### subscribeToChannel

```typescript
subscribeToChannel(
  channelId: string,
  callback: (state: any) => void
): void
```

Subscribes to channel state updates.

- **Parameters:**
  - `channelId`: Channel to monitor
  - `callback`: Function called on state updates

##### signState

```typescript
async signState(state: State): Promise<string>
```

Signs channel state for on-chain use.

- **Parameters:**
  - `state`: State to sign
- **Returns:** Ethereum signature
- **Throws:** `Error` if signing fails

##### finalizeChannel

```typescript
async finalizeChannel(
  state: State,
  clientSignature: string,
  relaySignature: string
): Promise<any>
```

Finalizes channel on-chain.

- **Parameters:**
  - `state`: Final state
  - `clientSignature`: Client's signature
  - `relaySignature`: Relay's signature
- **Returns:** Transaction receipt
- **Throws:** `Error` if finalization fails

## Smart Contract

### PaymentChannel

#### Constructor

```solidity
constructor(
    address _relay,
    uint256 _challengePeriod
) payable
```

Creates a new payment channel.

- **Parameters:**
  - `_relay`: Relay address
  - `_challengePeriod`: Challenge period duration
  - `msg.value`: Channel deposit

#### Main Functions

##### closeChannel

```solidity
function closeChannel(
    uint256 clientBalance,
    uint256 relayBalance,
    uint256 nonce,
    bytes memory clientSig,
    bytes memory relaySig
) external
```

Initiates channel closure.

##### updateState

```solidity
function updateState(
    uint256 clientBalance,
    uint256 relayBalance,
    uint256 nonce,
    bytes memory clientSig,
    bytes memory relaySig
) external
```

Updates channel state during challenge period.

##### finalizeChannel

```solidity
function finalizeChannel() external
```

Finalizes channel after challenge period.

## Examples

### Client Implementation

```typescript
// Initialize API
const clientAPI = new MicropaymentAPI(relayUrl, providerUrl, contractAddress, contractABI);
clientAPI.setSigner(clientSigner, clientSeaPair);

// Open channel
const initialState = {
  nonce: 0,
  clientBalance: deposit,
  relayBalance: "0",
  pubKey: clientSeaPair.pub
};
await clientAPI.openOffChainChannel(channelId, initialState);

// Send micropayment
async function sendMicropayment(amount: number) {
  const newState = {
    nonce: currentState.nonce + 1,
    clientBalance: (currentBalance - amount).toString(),
    relayBalance: (relayBalance + amount).toString(),
    pubKey: currentState.pubKey
  };
  await clientAPI.updateOffChainChannel(channelId, newState);
}
```

### Relay Implementation

```typescript
// Initialize API
const relayAPI = new MicropaymentAPI(relayUrl, providerUrl, contractAddress, contractABI);
relayAPI.setSigner(relaySigner, relaySeaPair);

// Monitor channel
relayAPI.subscribeToChannel(clientChannelId, async (state) => {
  // Verify and sign state
  const signature = await relayAPI.signState(state);
  // Publish signature
  relayAPI.gun.get('relaySignatures')
    .get(clientChannelId)
    .put({ signature, stateNonce: state.nonce });
});
```

## Technical Details

### State Management

1. **Off-chain State**
   - Nonce-based versioning
   - Dual signatures (client/relay)
   - GunDB persistence
   - Real-time updates

2. **On-chain Settlement**
   - Challenge period
   - State verification
   - Balance distribution
   - Signature validation

### Security Features

1. **Cryptographic Security**
   - Ethereum signatures
   - SEA encryption
   - State verification
   - Nonce protection

2. **Channel Security**
   - Challenge periods
   - Balance verification
   - Signature validation
   - State consistency

3. **Data Protection**
   - Off-chain privacy
   - Secure storage
   - State validation
   - Error handling

### Performance Considerations

1. **Off-chain Optimization**
   - Asynchronous updates
   - State caching
   - Batch processing
   - Event monitoring

2. **Gas Optimization**
   - Minimal on-chain data
   - Efficient encoding
   - Custom errors
   - State compression

### Best Practices

1. **Channel Management**
   - Regular state backups
   - Timeout monitoring
   - Balance checks
   - Error recovery

2. **Security Measures**
   - State validation
   - Signature verification
   - Balance reconciliation
   - Challenge monitoring 