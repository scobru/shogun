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

## 🔑 Interfacce Principali

### UserKeys
```typescript
interface UserKeys {
  pair: GunKeyPair;
  wallet: Wallet;
  stealthKey: StealthKeyPair;
  activityPubKey: ActivityPubKeys;
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

## �� Best Practices

1. Validare sempre i dati in input
2. Gestire tutte le operazioni asincrone con try-catch
3. Pulire i dati sensibili dopo l'uso
4. Utilizzare i tipi appropriati per le chiavi
5. Verificare lo stato di autenticazione prima delle operazioni
6. Implementare una corretta gestione degli errori
7. Utilizzare metodi sicuri per la memorizzazione delle chiavi
8. Effettuare backup regolari utilizzando export/import 