# MicropaymentAPI Reference

`MicropaymentAPI` fornisce un sistema completo di micropagamenti off-chain/on-chain che utilizza GunDB per la gestione dello stato off-chain e smart contract Ethereum per il settlement.

## Costruttore

```typescript
constructor(
  relayUrl: string,
  providerUrl: string,
  contractAddress: string,
  contractABI: any[]
)
```

Crea una nuova istanza di MicropaymentAPI.
- `relayUrl`: URL relay GunDB
- `providerUrl`: URL provider Ethereum
- `contractAddress`: Indirizzo smart contract canale di pagamento
- `contractABI`: ABI del contratto

## Gestione Canali

### openOffChainChannel
```typescript
async openOffChainChannel(
  channelId: string,
  initialState: State
): Promise<StatePackage>
```
Apre un nuovo canale di pagamento off-chain.
- `channelId`: Identificatore unico del canale
- `initialState`: Stato iniziale del canale
- **Ritorna**: Package di stato con firma
- **Errori**: Se la creazione del canale fallisce

### updateOffChainChannel
```typescript
async updateOffChainChannel(
  channelId: string,
  newState: State
): Promise<StatePackage>
```
Aggiorna lo stato del canale off-chain.
- `channelId`: Identificatore del canale
- `newState`: Nuovo stato del canale
- **Ritorna**: Package di stato aggiornato
- **Errori**: Se l'aggiornamento fallisce

### subscribeToChannel
```typescript
subscribeToChannel(
  channelId: string,
  callback: (state: any) => void
): void
```
Sottoscrive agli aggiornamenti dello stato del canale.
- `channelId`: Canale da monitorare
- `callback`: Funzione chiamata agli aggiornamenti di stato

### signState
```typescript
async signState(state: State): Promise<string>
```
Firma lo stato del canale per uso on-chain.
- `state`: Stato da firmare
- **Ritorna**: Firma Ethereum
- **Errori**: Se la firma fallisce

### finalizeChannel
```typescript
async finalizeChannel(
  state: State,
  clientSignature: string,
  relaySignature: string
): Promise<any>
```
Finalizza il canale on-chain.
- `state`: Stato finale
- `clientSignature`: Firma del client
- `relaySignature`: Firma del relay
- **Ritorna**: Ricevuta della transazione
- **Errori**: Se la finalizzazione fallisce

## Smart Contract PaymentChannel

### closeChannel
```solidity
function closeChannel(
    uint256 clientBalance,
    uint256 relayBalance,
    uint256 nonce,
    bytes memory clientSig,
    bytes memory relaySig
) external
```
Avvia la chiusura del canale.
- `clientBalance`: Saldo del client
- `relayBalance`: Saldo del relay
- `nonce`: Nonce dello stato
- `clientSig`: Firma del client
- `relaySig`: Firma del relay

### updateState
```solidity
function updateState(
    uint256 clientBalance,
    uint256 relayBalance,
    uint256 nonce,
    bytes memory clientSig,
    bytes memory relaySig
) external
```
Aggiorna lo stato del canale durante il periodo di sfida.

### finalizeChannel
```solidity
function finalizeChannel() external
```
Finalizza il canale dopo il periodo di sfida. 