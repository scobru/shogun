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