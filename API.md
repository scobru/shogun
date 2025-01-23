# SHOGUN API Reference

## 🔐 WalletManager

### Costruttore

```typescript
constructor()
```
Crea una nuova istanza di WalletManager. Inizializza Gun, user e i manager per Ethereum e StealthChain.

### Metodi di Account

#### createAccount
```typescript
async createAccount(alias: string, passphrase: string, callback?: (error?: Error) => void): Promise<void>
```
Crea un nuovo account GunDB.
- `alias`: Username per l'account
- `passphrase`: Password per l'account
- `callback`: Callback opzionale per gestire errori

#### login
```typescript
async login(alias: string, passphrase: string): Promise<string>
```
Effettua il login con le credenziali specificate.
- `alias`: Username dell'account
- `passphrase`: Password dell'account
- **Ritorna**: Chiave pubblica dell'utente autenticato

#### logout
```typescript
logout(): void
```
Disconnette l'utente corrente.

#### loginWithPrivateKey
```typescript
async loginWithPrivateKey(privateKey: string): Promise<string>
```
Effettua il login usando una chiave privata.
- `privateKey`: Chiave privata Ethereum
- **Ritorna**: Chiave pubblica dell'account

### Gestione Wallet

#### saveWallet
```typescript
async saveWallet(wallet: Wallet, publicKey: string, storageType?: StorageType): Promise<void>
```
Salva un wallet nello storage specificato.
- `wallet`: Wallet da salvare
- `publicKey`: Chiave pubblica associata
- `storageType`: Tipo di storage (GUN, LOCAL, BOTH)

#### retrieveWallet
```typescript
async retrieveWallet(publicKey: string, storageType?: StorageType): Promise<Wallet | null>
```
Recupera un wallet dallo storage.
- `publicKey`: Chiave pubblica del wallet
- `storageType`: Tipo di storage da cui recuperare
- **Ritorna**: Il wallet trovato o null

#### createWalletObj
```typescript
static async createWalletObj(gunKeyPair: GunKeyPair): Promise<WalletResult>
```
Crea un nuovo wallet da una coppia di chiavi Gun.
- `gunKeyPair`: Coppia di chiavi Gun
- **Ritorna**: Oggetto contenente il wallet e l'entropia

#### createWalletFromSalt
```typescript
static async createWalletFromSalt(gunKeyPair: GunKeyPair, salt: string): Promise<Wallet>
```
Crea un wallet da salt e coppia di chiavi Gun.
- `gunKeyPair`: Coppia di chiavi Gun
- `salt`: Salt per la derivazione
- **Ritorna**: Nuovo wallet

### Gestione Dati

#### exportAllData
```typescript
async exportAllData(alias: string): Promise<string>
```
Esporta tutti i dati dell'utente.
- `alias`: Username dell'utente
- **Ritorna**: JSON contenente tutti i dati

#### importAllData
```typescript
async importAllData(jsonData: string, alias: string): Promise<void>
```
Importa i dati dell'utente.
- `jsonData`: Dati JSON da importare
- `alias`: Username per l'importazione

#### checkLocalData
```typescript
async checkLocalData(alias: string): Promise<{hasWallet: boolean, hasStealthKeys: boolean, hasPasskey: boolean}>
```
Verifica i dati locali dell'utente.
- `alias`: Username da verificare
- **Ritorna**: Stato dei dati locali

#### clearLocalData
```typescript
async clearLocalData(alias: string): Promise<void>
```
Cancella tutti i dati locali dell'utente.
- `alias`: Username di cui cancellare i dati

### Utility

#### getPublicKey
```typescript
getPublicKey(): string
```
Ottiene la chiave pubblica dell'utente corrente.
- **Ritorna**: Chiave pubblica dell'utente

#### getCurrentUserKeyPair
```typescript
getCurrentUserKeyPair(): GunKeyPair
```
Ottiene la coppia di chiavi dell'utente corrente.
- **Ritorna**: Coppia di chiavi Gun

## 🕶 StealthChain

### Costruttore

```typescript
constructor(gun: Gun)
```
Crea una nuova istanza di StealthChain.
- `gun`: Istanza di Gun da utilizzare

### Metodi

#### generateStealthKeys
```typescript
generateStealthKeys(cb: Callback<StealthKeyPair>): void
```
Genera una nuova coppia di chiavi stealth.
- `cb`: Callback che riceve la coppia di chiavi
- **Callback Result**: `StealthKeyPair`

#### generateStealthAddress
```typescript
generateStealthAddress(recipientPublicKey: string, cb: Callback<StealthAddressResult>): void
```
Genera un indirizzo stealth per un destinatario.
- `recipientPublicKey`: Chiave pubblica del destinatario
- `cb`: Callback che riceve il risultato
- **Callback Result**: `StealthAddressResult`

#### openStealthAddress
```typescript
openStealthAddress(stealthAddress: string, ephemeralKey: string, cb: Callback<ethers.Wallet>): void
```
Apre un indirizzo stealth.
- `stealthAddress`: Indirizzo stealth da aprire
- `ephemeralKey`: Chiave effimera
- `cb`: Callback che riceve il wallet
- **Callback Result**: `ethers.Wallet`

#### saveStealthKeys
```typescript
saveStealthKeys(stealthKeyPair: StealthKeyPair, cb: Callback<void>): void
```
Salva le chiavi stealth.
- `stealthKeyPair`: Coppia di chiavi da salvare
- `cb`: Callback di completamento

#### retrieveStealthKeysFromRegistry
```typescript
retrieveStealthKeysFromRegistry(publicKey: string, cb: Callback<string>): void
```
Recupera le chiavi stealth dal registro.
- `publicKey`: Chiave pubblica da cercare
- `cb`: Callback che riceve le chiavi

## ⛓️ EthereumManager

### Costruttore

```typescript
constructor(walletManager: WalletManager)
```
Crea una nuova istanza di EthereumManager.
- `walletManager`: Istanza di WalletManager

### Metodi

#### setCustomProvider
```typescript
setCustomProvider(rpcUrl: string, privateKey: string): void
```
Imposta un provider personalizzato.
- `rpcUrl`: URL del provider RPC
- `privateKey`: Chiave privata per il wallet

#### createAccountWithEthereum
```typescript
async createAccountWithEthereum(): Promise<string>
```
Crea un account usando un account Ethereum.
- **Ritorna**: Username creato (indirizzo Ethereum)

#### loginWithEthereum
```typescript
async loginWithEthereum(): Promise<string | null>
```
Effettua il login usando un account Ethereum.
- **Ritorna**: Chiave pubblica se il login ha successo

## 📝 Tipi e Interfacce

### StorageType
```typescript
enum StorageType {
  GUN,    // Storage decentralizzato
  LOCAL,  // Storage locale
  BOTH    // Entrambi gli storage
}
```

### StealthKeyPair
```typescript
interface StealthKeyPair {
  pub: string;    // Chiave pubblica
  priv: string;   // Chiave privata
  epub: string;   // Chiave pubblica effimera
  epriv: string;  // Chiave privata effimera
}
```

### StealthAddressResult
```typescript
interface StealthAddressResult {
  stealthAddress: string;      // Indirizzo stealth generato
  ephemeralPublicKey: string;  // Chiave pubblica effimera
  recipientPublicKey: string;  // Chiave pubblica del destinatario
}
```

### WalletResult
```typescript
interface WalletResult {
  walletObj: Wallet;  // Oggetto wallet
  entropy: string;    // Entropia utilizzata
}
``` 