# 🏰 SHOGUN API Reference

## Core

### Shogun

La classe principale che gestisce tutte le funzionalità del wallet.

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: any)
```

Crea una nuova istanza di Shogun. Inizializza Gun e tutti i manager necessari.

#### Metodi Core

```typescript
async createUser(alias: string, password: string): Promise<UserKeys>
```
Crea un nuovo utente con account Gun, wallet Ethereum, chiavi stealth e ActivityPub.
Restituisce un oggetto `UserKeys` contenente tutte le chiavi generate.

```typescript
async getUser(): Promise<UserKeys>
```
Recupera i dati dell'utente corrente dal database.

#### Gestione Dati

```typescript
async putData(path: string, data: any): Promise<void>
```
Salva dati in modo ottimizzato con gestione degli errori e retry.

```typescript
async getData(path: string): Promise<any>
```
Recupera dati una volta sola in modo ottimizzato.

```typescript
subscribeToData(path: string, callback: (data: any) => void): () => void
```
Sottoscrive agli aggiornamenti dei dati con gestione ottimizzata della memoria.

```typescript
async addToSet(listPath: string, item: any): Promise<void>
```
Aggiunge un elemento univoco a una lista non ordinata.

```typescript
async mapList<T>(listPath: string, mapFn?: (data: any, key: string) => T): Promise<T[]>
```
Recupera e mappa i dati di una lista.

### Manager Disponibili

```typescript
getWalletManager(): WalletManager
getWebAuthnManager(): WebAuthnManager 
getActivityPubManager(): ActivityPubManager
getEthereumManager(): EthereumManager
getStealthChain(): StealthManager
getGunAuthManager(): GunAuthManager
```

## 🔑 WalletManager

Gestisce la creazione e gestione dei wallet Ethereum.

```typescript
async createAccount(): Promise<WalletData[]>
```
Crea un nuovo wallet derivato dalle chiavi Gun.

```typescript
async getWallets(): Promise<ExtendedWallet[]>
```
Recupera tutti i wallet dell'utente.

```typescript
async saveWallet(wallet: Wallet): Promise<void>
```
Salva un nuovo wallet.

```typescript
async createWalletFromSalt(gunKeyPair: GunKeyPair, salt: string): Promise<Wallet>
```
Crea un wallet deterministico da un salt e una coppia di chiavi Gun.

## 🔐 GunAuthManager 

Gestisce l'autenticazione decentralizzata con Gun.

```typescript
async createAccount(alias: string, passphrase: string): Promise<GunKeyPair>
```
Crea un nuovo account Gun.

```typescript
async login(alias: string, passphrase: string): Promise<string>
```
Effettua il login con le credenziali specificate.

```typescript
async checkUser(username: string, password: string): Promise<string>
```
Verifica la disponibilità di un username e crea l'utente se disponibile.

```typescript
logout(): void
```
Termina la sessione corrente.

## 🌐 ActivityPubManager

Gestisce le chiavi e le operazioni ActivityPub.

```typescript
async createAccount(): Promise<ActivityPubKeys>
```
Genera una nuova coppia di chiavi RSA per ActivityPub.

```typescript
async sign(stringToSign: string, username: string): Promise<{ signature: string; signatureHeader: string }>
```
Firma dati per ActivityPub.

```typescript
async saveKeys(keys: ActivityPubKeys): Promise<void>
```
Salva le chiavi ActivityPub.

```typescript
async getKeys(): Promise<ActivityPubKeys>
```
Recupera le chiavi ActivityPub salvate.

## 🔒 StealthManager

Gestisce gli indirizzi stealth per maggiore privacy.

```typescript
async createAccount(): Promise<StealthKeyPair>
```
Genera una nuova coppia di chiavi stealth.

```typescript
async generateStAdd(recipientPublicKey: string): Promise<{
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}>
```
Genera un indirizzo stealth per il destinatario.

```typescript
async openStAdd(stealthAddress: string, ephemeralPublicKey: string): Promise<Wallet>
```
Apre un indirizzo stealth derivando la chiave privata.

## 🌐 WebAuthnManager

Gestisce l'autenticazione biometrica/hardware.

```typescript
async generateCredentials(username: string, isNewDevice?: boolean, deviceName?: string): Promise<WebAuthnResult>
```
Genera credenziali WebAuthn per un utente.

```typescript
async authenticateUser(username: string): Promise<WebAuthnResult>
```
Autentica un utente usando WebAuthn.

```typescript
async verifyCredential(credentialId: string): Promise<WebAuthnVerifyResult>
```
Verifica una credenziale WebAuthn esistente.

## 📦 Interfaces

### UserKeys
```typescript
interface UserKeys {
  pair: GunKeyPair;
  wallet: Wallet;
  stealthKey: StealthKeyPair;
  activityPubKey: ActivityPubKeys;
}
```

### ActivityPubKeys
```typescript
interface ActivityPubKeys {
  publicKey: string;
  privateKey: string;
  createdAt: number;
}
```

### StealthKeyPair
```typescript
interface StealthKeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}
```

### WebAuthnResult
```typescript
interface WebAuthnResult {
  success: boolean;
  username?: string;
  password?: string;
  credentialId?: string;
  error?: string;
  deviceInfo?: DeviceInfo;
}
```

## 🔐 Best Practices

1. Utilizzare sempre `waitForOperation()` dopo operazioni asincrone per garantire la sincronizzazione
2. Verificare lo stato di autenticazione prima delle operazioni sensibili
3. Implementare retry e gestione degli errori per le operazioni di rete
4. Utilizzare timeout appropriati per le operazioni asincrone
5. Pulire le sottoscrizioni quando non più necessarie
6. Validare input e output delle operazioni critiche
7. Utilizzare le interfacce TypeScript per type safety
8. Implementare meccanismi di recovery per le chiavi 

## 💬 UnstoppableChat

Sistema di chat decentralizzato basato su Gun.

```typescript
constructor(superpeers: any)
```

### Metodi Principali

```typescript
async join(username: string, password: string, publicName: string)
```
Entra nella chat con le credenziali specificate.

```typescript
async reset()
```
Resetta tutti i dati della chat.

```typescript
async logout()
```
Effettua il logout dalla chat.

### Gestione Contatti

```typescript
async addContact(username: string, pubKey: string, publicName: string)
```
Aggiunge un nuovo contatto.

```typescript
removeContact(pubKey: string)
```
Rimuove un contatto.

```typescript
async loadContacts(): Promise<{ on: (cb: (param: Events['contacts']) => void) => void }>
```
Carica la lista dei contatti.

```typescript
async loadContactInvites()
```
Carica gli inviti dei contatti.

```typescript
async sendMessageToContact(pubKey: string, msg: string)
```
Invia un messaggio a un contatto.

### Gestione Canali

```typescript
async createChannel(channelName: string, isPrivate: boolean): Promise<Channel>
```
Crea un nuovo canale.

```typescript
leaveChannel(channel: Channel)
```
Abbandona un canale.

```typescript
async loadChannels()
```
Carica la lista dei canali.

```typescript
async loadPublicChannels()
```
Carica i canali pubblici.

```typescript
async sendMessageToChannel(channel: Channel, msg: string, peerInfo: any)
```
Invia un messaggio a un canale.

### Gestione Annunci

```typescript
async createAnnouncement(announcementName: string, isPrivate: boolean, rssLink?: string)
```
Crea un nuovo annuncio.

```typescript
async loadAnnouncements()
```
Carica la lista degli annunci.

```typescript
async sendMessageToAnnouncement(announcement: Announcement, msg: string, peerInfo: any)
```
Invia un messaggio a un annuncio.

## 💸 Layer3 - Micropagamenti

Sistema di micropagamenti off-chain con riconciliazione on-chain.

### MicropaymentAPI

```typescript
constructor(relayUrl: string, providerUrl: string, contractAddress: string, contractABI: any[])
```

#### Metodi Principali

```typescript
setSigner(signer: Signer, seaPair: SEAKeyPair): void
```
Imposta il signer per le operazioni on-chain e il key pair SEA per le firme off-chain.

```typescript
async openOffChainChannel(channelId: string, initialState: State): Promise<StatePackage>
```
Apre un canale off-chain e registra lo stato iniziale.

```typescript
async updateOffChainChannel(channelId: string, newState: State): Promise<StatePackage>
```
Aggiorna lo stato del canale off-chain.

```typescript
subscribeToChannel(channelId: string, callback: (state: any) => void): void
```
Sottoscrive agli aggiornamenti del canale.

```typescript
async signState(state: State): Promise<string>
```
Firma lo stato del canale per la riconciliazione on-chain.

```typescript
async finalizeChannel(state: State, clientSignature: string, relaySignature: string)
```
Finalizza il canale on-chain.

### PaymentChannel (Smart Contract)

```solidity
contract PaymentChannel {
    constructor(address _relay, uint256 _challengePeriod) payable
```

#### Funzioni Principali

```solidity
function closeChannel(
    uint256 clientBalance,
    uint256 relayBalance,
    uint256 nonce,
    bytes memory clientSig,
    bytes memory relaySig
) external
```
Avvia la chiusura del canale fornendo uno stato off-chain firmato.

```solidity
function updateState(
    uint256 clientBalance,
    uint256 relayBalance,
    uint256 nonce,
    bytes memory clientSig,
    bytes memory relaySig
) external
```
Aggiorna lo stato del canale durante il challenge period.

```solidity
function finalizeChannel() external
```
Finalizza il canale dopo il challenge period e distribuisce i fondi.

### Interfaces Layer3

```typescript
interface State {
    nonce: number;
    clientBalance: string;
    relayBalance: string;
    pubKey?: string;
}

interface StatePackage {
    data: State;
    signature: string;
}
``` 