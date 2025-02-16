# EthereumHDKeyVault API Reference

`EthereumHDKeyVault` fornisce un sistema di gestione sicuro per i wallet HD Ethereum con supporto BIP32/BIP39.

## Costruttore

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Crea una nuova istanza di EthereumHDKeyVault.

## Metodi Principali

### createAccount
```typescript
public async createAccount(password?: string): Promise<WalletData>
```
Crea un nuovo wallet HD.
- `password` (opzionale): Password per crittografia aggiuntiva
- **Ritorna**: Dati del wallet incluso indirizzo e chiave privata
- **Errori**: Se l'utente non è autenticato o la creazione fallisce

### getWallets
```typescript
public async getWallets(): Promise<ExtendedWallet[]>
```
Recupera tutti i wallet HD memorizzati.
- **Ritorna**: Array di istanze wallet estese
- **Errori**: Se il recupero fallisce o l'utente non è autenticato

### getWallet
```typescript
public async getWallet(): Promise<Wallet>
```
Ottiene il wallet primario (indice 0).
- **Ritorna**: Istanza Wallet Ethers.js
- **Errori**: Se il wallet non può essere recuperato

### getLegacyWallet
```typescript
public async getLegacyWallet(): Promise<Wallet>
```
Recupera il wallet legacy derivato dalle credenziali GunDB.
- **Ritorna**: Istanza Wallet Ethers.js
- **Errori**: Se il wallet non può essere recuperato

### getWalletByAddress
```typescript
public async getWalletByAddress(address: string): Promise<Wallet | null>
```
Trova un wallet tramite indirizzo Ethereum.
- `address`: Indirizzo Ethereum da cercare
- **Ritorna**: Istanza Wallet o null se non trovato

### getWalletByIndex
```typescript
public async getWalletByIndex(index: number): Promise<Wallet>
```
Recupera un wallet tramite indice HD path.
- `index`: Indice HD path
- **Ritorna**: Istanza Wallet
- **Errori**: Se il wallet non può essere recuperato

### deleteWallet
```typescript
public async deleteWallet(address: string): Promise<void>
```
Rimuove un wallet dallo storage.
- `address`: Indirizzo Ethereum da eliminare
- **Errori**: Se l'eliminazione fallisce

### convertToEthPk
```typescript
public convertToEthPk(gunPrivateKey: string): string
```
Converte una chiave privata GunDB in formato Ethereum.
- `gunPrivateKey`: Chiave privata GunDB
- **Ritorna**: Chiave privata compatibile con Ethereum
- **Errori**: Se la conversione fallisce 