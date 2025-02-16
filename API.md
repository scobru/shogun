# Documentazione API SHOGUN

## 🏰 Core di Shogun

### Costruttore

```typescript
constructor(gunOptions: IGunInstance, APP_KEY_PAIR: any)
```
Crea una nuova istanza di Shogun. Inizializza Gun e tutti i manager e servizi necessari.

**Parametri:**
- `gunOptions`: Istanza di Gun configurata
  - `peers`: Array di URL dei peer Gun
  - `localStorage`: Abilita/disabilita localStorage
  - `radisk`: Abilita/disabilita storage radisk
  - `multicast`: Abilita/disabilita multicast
- `APP_KEY_PAIR`: Coppia di chiavi dell'applicazione per l'autenticazione Gun

### Metodi Core

```typescript
getEthereumConnector(): EthereumConnector
```
Restituisce l'istanza di EthereumConnector per le operazioni con Ethereum.

```typescript
getWebAuthnManager(): WebAuthnManager
```
Restituisce l'istanza di WebAuthnManager per l'autenticazione biometrica.

```typescript
getActivityPubManager(): ActivityPubManager
```
Restituisce l'istanza di ActivityPubManager per le operazioni ActivityPub.

```typescript
getStealthChain(): StealthChain
```
Restituisce l'istanza di StealthChain per le operazioni con indirizzi stealth.

```typescript
getGunAuthManager(): GunAuthManager
```
Restituisce l'istanza di GunAuthManager per l'autenticazione Gun.js.

### Gestione Utenti

```typescript
async createUser(alias: string, password: string): Promise<UserKeys>
```
Crea un nuovo utente con account Gun, wallet, chiavi stealth e chiavi ActivityPub.
- Parametri:
  - `alias`: Nome utente
  - `password`: Password dell'utente
- Ritorna: Oggetto UserKeys contenente tutte le chiavi generate

```typescript
async getUser(): Promise<UserKeys>
```
Recupera i dati dell'utente dal database.
- Ritorna: Oggetto UserKeys contenente tutte le chiavi dell'utente

## 🔐 Gestione Chiavi Stealth

### Creazione e Recupero

```typescript
async createAccount(): Promise<StealthKeyPair>
```
Genera una nuova coppia di chiavi stealth se non esistono, altrimenti restituisce quelle esistenti.
- Ritorna: Coppia di chiavi stealth
- Lancia: Errore se la generazione delle chiavi fallisce

```typescript
async getPair(): Promise<StealthKeyPair>
```
Recupera le chiavi stealth dell'utente corrente.
- Ritorna: Coppia di chiavi stealth
- Lancia: Errore se le chiavi non vengono trovate

### Operazioni Stealth

```typescript
async generateStAdd(recipientPublicKey: string): Promise<{
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}>
```
Genera un indirizzo stealth per la chiave pubblica del destinatario.
- Parametri:
  - `recipientPublicKey`: Chiave pubblica del destinatario
- Ritorna: Oggetto contenente l'indirizzo stealth e le chiavi associate
- Lancia: Errore se le chiavi sono invalide o mancanti

```typescript
async openStAdd(stealthAddress: string, ephemeralPublicKey: string): Promise<ethers.Wallet>
```
Apre un indirizzo stealth derivando la chiave privata.
- Parametri:
  - `stealthAddress`: Indirizzo stealth da aprire
  - `ephemeralPublicKey`: Chiave pubblica effimera
- Ritorna: Wallet Ethereum derivato
- Lancia: Errore se i parametri sono mancanti o le chiavi invalide

## 🔑 Autenticazione WebAuthn

### Gestione Dispositivi

```typescript
async generateCredentials(username: string, isNewDevice?: boolean, deviceName?: string): Promise<WebAuthnResult>
```
Genera nuove credenziali WebAuthn per un utente.
- Parametri:
  - `username`: Nome utente
  - `isNewDevice`: Se è un nuovo dispositivo
  - `deviceName`: Nome del dispositivo (opzionale)
- Ritorna: Risultato della registrazione WebAuthn

```typescript
async getRegisteredDevices(username: string): Promise<DeviceCredential[]>
```
Recupera i dispositivi registrati per un utente.
- Parametri:
  - `username`: Nome utente
- Ritorna: Lista dei dispositivi registrati

```typescript
async removeDevice(username: string, credentialId: string): Promise<boolean>
```
Rimuove un dispositivo registrato.
- Parametri:
  - `username`: Nome utente
  - `credentialId`: ID della credenziale da rimuovere
- Ritorna: `true` se la rimozione ha successo

### Autenticazione

```typescript
async authenticateUser(username: string): Promise<WebAuthnResult>
```
Autentica un utente usando WebAuthn.
- Parametri:
  - `username`: Nome utente
- Ritorna: Risultato dell'autenticazione WebAuthn

```typescript
async verifyCredential(credentialId: string): Promise<WebAuthnVerifyResult>
```
Verifica una credenziale WebAuthn.
- Parametri:
  - `credentialId`: ID della credenziale da verificare
- Ritorna: Risultato della verifica

## 🔑 Interfacce Principali

### UserKeys
```typescript
interface UserKeys {
  pair: GunKeyPair;         // Coppia di chiavi Gun
  wallet: Wallet;           // Wallet Ethereum
  stealthKey: StealthKeyPair; // Chiavi per transazioni stealth
  activityPubKey: ActivityPubKeys; // Chiavi ActivityPub
}
```

### GunKeyPair
```typescript
interface GunKeyPair {
  pub: string;    // Chiave pubblica
  priv: string;   // Chiave privata
  epub: string;   // Chiave pubblica di cifratura
  epriv: string;  // Chiave privata di cifratura
}
```

### StealthKeyPair
```typescript
interface StealthKeyPair {
  pub: string;    // Chiave pubblica stealth
  priv: string;   // Chiave privata stealth
  epub: string;   // Chiave pubblica di cifratura stealth
  epriv: string;  // Chiave privata di cifratura stealth
}
```

### WebAuthnResult
```typescript
interface WebAuthnResult {
  credentialId: string;     // ID della credenziale
  publicKey: string;        // Chiave pubblica
  counter: number;          // Contatore di autenticazione
  deviceName?: string;      // Nome del dispositivo (opzionale)
}
```

## 🔒 Struttura Dati Gun

### Utenti
```
gun/
└── users/
    └── [publicKey]/
        ├── wallet/
        │   ├── address
        │   └── privateKey (cifrata)
        ├── stealth/
        │   ├── pub
        │   ├── priv (cifrata)
        │   ├── epub
        │   └── epriv (cifrata)
        ├── webauthn/
        │   ├── credentials/
        │   │   └── [credentialId]/
        │   │       ├── publicKey
        │   │       ├── counter
        │   │       └── deviceName
        │   └── devices
        └── activityPub/
            ├── publicKey
            └── privateKey (cifrata)
```

## 🔐 Note sulla Sicurezza

1. Le chiavi private non vengono mai memorizzate in chiaro
2. Tutte le operazioni crittografiche utilizzano le librerie standard
3. L'autenticazione è gestita tramite Gun.js SEA
4. Le chiavi stealth forniscono privacy aggiuntiva per le transazioni
5. Supporto per autenticazione biometrica tramite WebAuthn
6. Verifica dell'integrità delle chiavi durante le operazioni
7. Protezione contro attacchi replay nelle autenticazioni WebAuthn
8. Validazione completa dei dati in input/output

## 🌐 Best Practices

1. Validare sempre i dati in input
2. Gestire tutte le operazioni asincrone con try-catch
3. Pulire i dati sensibili dopo l'uso
4. Utilizzare i tipi appropriati per le chiavi
5. Verificare lo stato di autenticazione prima delle operazioni
6. Implementare una corretta gestione degli errori
7. Utilizzare metodi sicuri per la memorizzazione delle chiavi
8. Effettuare backup regolari utilizzando export/import
9. Verificare la compatibilità WebAuthn prima dell'uso
10. Implementare timeout appropriati per le operazioni sensibili

## 💎 Gestione Ethereum

### Connettore Ethereum

```typescript
class EthereumConnector extends BaseManager<GunKeyPair>
```

#### Configurazione Provider

```typescript
setCustomProvider(rpcUrl: string, privateKey: string): void
```
Imposta un provider Ethereum personalizzato.
- Parametri:
  - `rpcUrl`: URL del provider RPC
  - `privateKey`: Chiave privata per il wallet
- Lancia: Errore se i parametri sono invalidi

#### Autenticazione

```typescript
async createAccount(): Promise<GunKeyPair>
```
Crea un nuovo account Ethereum e lo associa a Gun.
- Ritorna: Coppia di chiavi Gun
- Lancia: Errore se la creazione fallisce o va in timeout

```typescript
async login(): Promise<string>
```
Effettua il login con un account Ethereum.
- Ritorna: Chiave pubblica dell'utente
- Lancia: Errore se l'autenticazione fallisce

#### Operazioni con Firma

```typescript
async getSigner(): Promise<ethers.Signer>
```
Ottiene il signer Ethereum corrente.
- Ritorna: Istanza del signer
- Lancia: Errore se nessun signer è disponibile

```typescript
async verifySignature(message: string, signature: string): Promise<string>
```
Verifica una firma Ethereum.
- Parametri:
  - `message`: Messaggio originale
  - `signature`: Firma da verificare
- Ritorna: Indirizzo che ha firmato
- Lancia: Errore se la firma è invalida

### Generatore di Wallet

```typescript
class EthereumWalletGenerator extends BaseManager<WalletData>
```

#### Creazione Wallet

```typescript
async createWalletFromSalt(gunKeyPair: GunKeyPair, salt: string): Promise<Wallet>
```
Crea un wallet deterministico da un salt e una coppia di chiavi Gun.
- Parametri:
  - `gunKeyPair`: Coppia di chiavi Gun
  - `salt`: Salt per la derivazione
- Ritorna: Wallet Ethereum
- Lancia: Errore se la creazione fallisce

#### Gestione Wallet

```typescript
async getWallets(): Promise<ExtendedWallet[]>
```
Recupera tutti i wallet dell'utente con le relative informazioni.
- Ritorna: Array di wallet con informazioni aggiuntive
- Lancia: Errore se il recupero fallisce

```typescript
async getWallet(): Promise<Wallet>
```
Recupera il wallet principale (derivato dalla chiave Gun).
- Ritorna: Wallet Ethereum principale
- Lancia: Errore se l'utente non è autenticato

## 🌐 ActivityPub

### Gestione Chiavi

```typescript
class ActivityPubManager extends BaseManager<ActivityPubKeys>
```

#### Operazioni Chiavi

```typescript
async createAccount(): Promise<ActivityPubKeys>
```
Crea una nuova coppia di chiavi ActivityPub.
- Ritorna: Coppia di chiavi ActivityPub
- Lancia: Errore se la creazione fallisce

```typescript
async getKeys(): Promise<ActivityPubKeys>
```
Recupera le chiavi ActivityPub dell'utente.
- Ritorna: Coppia di chiavi ActivityPub
- Lancia: Errore se le chiavi non sono trovate

```typescript
async getPub(): Promise<string | null>
```
Recupera la chiave pubblica ActivityPub.
- Ritorna: Chiave pubblica o null se non trovata

## 🔑 Interfacce Principali

### ExtendedWallet
```typescript
interface ExtendedWallet extends Wallet {
  entropy: string;        // Entropia usata per la generazione
  timestamp: number;      // Timestamp di creazione
}
```

### WalletData
```typescript
interface WalletData {
  address: string;        // Indirizzo Ethereum
  privateKey: string;     // Chiave privata (cifrata)
  entropy?: string;       // Entropia opzionale
  timestamp?: number;     // Timestamp di creazione
}
```

### ActivityPubKeys
```typescript
interface ActivityPubKeys {
  publicKey: string;      // Chiave pubblica ActivityPub
  privateKey: string;     // Chiave privata ActivityPub (cifrata)
}
```

## 🔒 Struttura Dati Gun

### Ethereum
```
gun/
└── users/
    └── [publicKey]/
        └── ethereum/
            ├── wallets_index/
            │   └── [walletId]/
            │       ├── address
            │       └── reference
            └── wallet_[walletId]/
                ├── address
                ├── privateKey (cifrata)
                ├── entropy
                └── timestamp
```

### Utenti
```
gun/
└── users/
    └── [publicKey]/
        ├── wallet/
        │   ├── address
        │   └── privateKey (cifrata)
        ├── stealth/
        │   ├── pub
        │   ├── priv (cifrata)
        │   ├── epub
        │   └── epriv (cifrata)
        ├── webauthn/
        │   ├── credentials/
        │   │   └── [credentialId]/
        │   │       ├── publicKey
        │   │       ├── counter
        │   │       └── deviceName
        │   └── devices
        └── activityPub/
            ├── publicKey
            └── privateKey (cifrata)
```

## 🔐 Note sulla Sicurezza

1. Le chiavi private non vengono mai memorizzate in chiaro
2. Tutte le operazioni crittografiche utilizzano le librerie standard
3. L'autenticazione è gestita tramite Gun.js SEA
4. Le chiavi stealth forniscono privacy aggiuntiva per le transazioni
5. Supporto per autenticazione biometrica tramite WebAuthn
6. Verifica dell'integrità delle chiavi durante le operazioni
7. Protezione contro attacchi replay nelle autenticazioni WebAuthn
8. Validazione completa dei dati in input/output

## 🌐 Best Practices

1. Validare sempre i dati in input
2. Gestire tutte le operazioni asincrone con try-catch
3. Pulire i dati sensibili dopo l'uso
4. Utilizzare i tipi appropriati per le chiavi
5. Verificare lo stato di autenticazione prima delle operazioni
6. Implementare una corretta gestione degli errori
7. Utilizzare metodi sicuri per la memorizzazione delle chiavi
8. Effettuare backup regolari utilizzando export/import
9. Verificare la compatibilità WebAuthn prima dell'uso
10. Implementare timeout appropriati per le operazioni sensibili

## 💼 Gestione Wallet

### WalletManager

```typescript
class WalletManager extends BaseManager<WalletData[]>
```

#### Creazione Account

```typescript
async createAccount(): Promise<WalletData[]>
```
Crea un nuovo wallet dall'utente Gun corrente.
- Ritorna: Array di dati wallet creati
- Lancia: Errore se l'utente non è autenticato o se la creazione fallisce
- Note: 
  - Genera un salt unico usando la chiave pubblica dell'utente
  - Crea un wallet deterministico dal salt
  - Salva il wallet cifrato su Gun

#### Gestione Wallet

```typescript
async getWallets(): Promise<Array<Wallet & { entropy?: string; timestamp?: number }>>
```
Recupera tutti i wallet dell'utente con informazioni aggiuntive.
- Ritorna: Array di wallet con entropia e timestamp
- Lancia: Errore se il recupero fallisce
- Note:
  - Verifica l'integrità di ogni wallet recuperato
  - Filtra i wallet invalidi
  - Aggiunge proprietà aggiuntive (entropia, timestamp)

```typescript
async getWallet(): Promise<Wallet>
```
Recupera il wallet principale derivato dalla chiave Gun.
- Ritorna: Wallet principale
- Lancia: Errore se l'utente non è autenticato

```typescript
async saveWallet(wallet: Wallet): Promise<void>
```
Salva un nuovo wallet.
- Parametri:
  - `wallet`: Wallet Ethereum da salvare
- Lancia: 
  - `ValidationError` se l'indirizzo o la chiave privata sono invalidi
  - Errore se l'utente non è autenticato o il salvataggio fallisce
- Note:
  - Valida l'indirizzo Ethereum
  - Valida la chiave privata
  - Cifra i dati sensibili prima del salvataggio

#### Operazioni Crittografiche

```typescript
async createWalletFromSalt(gunKeyPair: GunKeyPair, salt: string): Promise<Wallet>
```
Crea un wallet deterministico da un salt e una coppia di chiavi Gun.
- Parametri:
  - `gunKeyPair`: Coppia di chiavi Gun
  - `salt`: Salt per la derivazione
- Ritorna: Wallet Ethereum
- Lancia: Errore se il salt è invalido o la derivazione fallisce
- Note:
  - Usa SEA.work per la derivazione della chiave
  - Verifica la validità del wallet generato
  - Aggiunge l'entropia al wallet

```typescript
convertToEthPk(gunPrivateKey: string): string
```
Converte una chiave privata Gun in una chiave privata Ethereum.
- Parametri:
  - `gunPrivateKey`: Chiave privata Gun
- Ritorna: Chiave privata Ethereum
- Lancia: Errore se la chiave è invalida o la conversione fallisce

### Interfacce

```typescript
interface WalletData {
  address: string;        // Indirizzo Ethereum
  privateKey: string;     // Chiave privata (cifrata)
  entropy?: string;       // Entropia usata per la generazione
  timestamp?: number;     // Timestamp di creazione
}
```

### Struttura Dati Gun

```
gun/
└── users/
    └── [publicKey]/
        └── wallets/
            ├── wallets_index/
            │   └── [walletId]/
            │       ├── address
            │       └── reference
            └── wallet_[walletId]/
                ├── address
                ├── privateKey (cifrata)
                ├── entropy
                └── timestamp
```

## 🔐 Autenticazione Gun.js

### GunAuthManager

```typescript
class GunAuthManager extends BaseManager<GunKeyPair>
```

#### Autenticazione

```typescript
async createAccount(alias: string, password: string): Promise<GunKeyPair>
```
Crea un nuovo account Gun.js.
- Parametri:
  - `alias`: Nome utente
  - `password`: Password dell'utente
- Ritorna: Coppia di chiavi Gun
- Lancia: Errore se la creazione fallisce

```typescript
async login(alias: string, password: string): Promise<string>
```
Effettua il login con credenziali.
- Parametri:
  - `alias`: Nome utente
  - `password`: Password dell'utente
- Ritorna: Chiave pubblica dell'utente
- Lancia: Errore se l'autenticazione fallisce

```typescript
logout(): void
```
Termina la sessione utente corrente.

#### Gestione Stato

```typescript
isAuthenticated(): boolean
```
Verifica se l'utente è autenticato.
- Ritorna: `true` se autenticato, `false` altrimenti

```typescript
getPair(): GunKeyPair
```
Ottiene la coppia di chiavi SEA dell'utente corrente.
- Ritorna: Coppia di chiavi Gun

```typescript
getUser(): IGunUserInstance
```
Ottiene l'istanza utente Gun.js.
- Ritorna: Istanza utente Gun.js

## 🔧 Infrastruttura

### BaseManager

```typescript
abstract class BaseManager<T>
```
Classe base astratta per tutti i manager che utilizzano Gun.js.

#### Proprietà Protette

```typescript
protected gun: IGunInstance;              // Istanza Gun
protected user: IGunUserInstance;         // Utente Gun
protected abstract storagePrefix: string; // Prefisso storage
protected APP_KEY_PAIR: ISEAPair;        // Chiavi app
```

#### Metodi Astratti

```typescript
abstract createAccount(...args: any[]): Promise<T>
```
Metodo astratto per creare un nuovo account/coppia di chiavi.

#### Gestione Dati

```typescript
protected async savePrivateData(data: T, path?: string): Promise<void>
```
Salva dati in modo privato (cifrati).
- Parametri:
  - `data`: Dati da salvare
  - `path`: Percorso opzionale
- Lancia: Errore se il salvataggio fallisce

```typescript
protected async savePublicData(data: any, path?: string): Promise<void>
```
Salva dati in modo pubblico.
- Parametri:
  - `data`: Dati da salvare
  - `path`: Percorso opzionale
- Lancia: Errore se il salvataggio fallisce

```typescript
protected async getPrivateData(path?: string): Promise<T | null>
```
Recupera dati privati.
- Parametri:
  - `path`: Percorso opzionale
- Ritorna: Dati recuperati o null

```typescript
protected async getPublicData(publicKey: string, path?: string): Promise<any>
```
Recupera dati pubblici.
- Parametri:
  - `publicKey`: Chiave pubblica
  - `path`: Percorso opzionale
- Ritorna: Dati pubblici

#### Utilità

```typescript
protected cleanGunMetadata<T>(data: any): T
```
Pulisce i metadati Gun da un oggetto.
- Parametri:
  - `data`: Dati da pulire
- Ritorna: Dati puliti

```typescript
protected checkAuthentication(): void
```
Verifica l'autenticazione dell'utente.
- Lancia: Errore se non autenticato

## 💬 Chat Decentralizzata

### UnstoppableChat

```typescript
class UnstoppableChat
```
Implementazione di chat decentralizzata usando Gun.js.

#### Inizializzazione

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```
Crea una nuova istanza di chat.
- Parametri:
  - `gun`: Istanza Gun
  - `APP_KEY_PAIR`: Chiavi dell'applicazione

#### Messaggistica

```typescript
async sendMessage(recipient: string, message: string): Promise<void>
```
Invia un messaggio cifrato a un destinatario.
- Parametri:
  - `recipient`: Chiave pubblica del destinatario
  - `message`: Messaggio da inviare
- Lancia: Errore se l'invio fallisce

```typescript
async getMessages(): Promise<Array<{
  from: string;
  message: string;
  timestamp: number;
}>>
```
Recupera i messaggi dell'utente.
- Ritorna: Array di messaggi con mittente e timestamp
- Lancia: Errore se il recupero fallisce

### Struttura Dati Gun

```
gun/
└── chat/
    └── messages/
        └── [recipientPub]/
            └── [messageId]/
                ├── from
                ├── message (cifrato)
                └── timestamp
``` 