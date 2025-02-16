# GunAuth API Reference

`GunAuth` fornisce un layer di autenticazione sicuro per GunDB, gestendo utenti, sessioni e operazioni crittografiche integrate con il sistema SEA di GunDB.

## Costruttore

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Crea una nuova istanza di GunAuth.
- `gun`: Istanza GunDB
- `APP_KEY_PAIR`: Coppia di chiavi SEA dell'applicazione

## Metodi di Autenticazione

### checkUser
```typescript
public async checkUser(username: string, password: string): Promise<string>
```
Verifica se un nome utente è disponibile e crea un account se lo è.
- `username`: Nome utente da verificare
- `password`: Password per il nuovo account
- **Ritorna**: Chiave pubblica dell'utente creato
- **Errori**: Se il nome utente è già in uso o la creazione fallisce
- **Note**: Include meccanismo di retry automatico (max 3 tentativi)

### createAccount
```typescript
public async createAccount(alias: string, passphrase: string): Promise<GunKeyPair>
```
Crea un nuovo account utente con hard reset dello stato.
- `alias`: Nome utente per il nuovo account
- `passphrase`: Password per la crittografia dell'account
- **Ritorna**: Coppia di chiavi GunDB generata
- **Errori**: Se il nome utente è già in uso o la creazione fallisce

### login
```typescript
public async login(alias: string, passphrase: string): Promise<string | null>
```
Autentica un utente con le sue credenziali.
- `alias`: Nome utente
- `passphrase`: Password
- **Ritorna**: Chiave pubblica dell'utente o null
- **Errori**: Per credenziali non valide o errori di autenticazione

### logout
```typescript
public logout(): void
```
Disconnette l'utente corrente e cancella la sessione.

## Gestione Dati

### savePrivateData
```typescript
public async savePrivateData(data: any, path: string): Promise<boolean>
```
Memorizza dati privati dell'utente in modo sicuro con verifica.
- `data`: Dati da memorizzare
- `path`: Percorso di memorizzazione
- **Ritorna**: `true` se il salvataggio ha successo
- **Errori**: Se l'utente non è autenticato o il salvataggio fallisce
- **Note**: Include verifica dei dati salvati e retry automatico (max 5 tentativi)

### getPrivateData
```typescript
public async getPrivateData(path: string): Promise<any>
```
Recupera dati privati dell'utente.
- `path`: Percorso di memorizzazione
- **Ritorna**: Dati recuperati (JSON stringificato)
- **Errori**: Se l'utente non è autenticato

### savePublicData
```typescript
public async savePublicData(data: any, path: string): Promise<boolean>
```
Memorizza dati pubblici dell'utente.
- `data`: Dati da memorizzare
- `path`: Percorso di memorizzazione
- **Ritorna**: `true` se il salvataggio ha successo
- **Errori**: Se l'utente non è autenticato

### getPublicData
```typescript
public async getPublicData(publicKey: string, path: string): Promise<any>
```
Recupera dati pubblici di qualsiasi utente.
- `publicKey`: Chiave pubblica dell'utente target
- `path`: Percorso di memorizzazione
- **Ritorna**: Dati recuperati
- **Errori**: Se l'utente non è autenticato

### deletePrivateData
```typescript
public async deletePrivateData(path: string): Promise<void>
```
Elimina dati privati dell'utente.
- `path`: Percorso da eliminare
- **Errori**: Se l'utente non è autenticato

### deletePublicData
```typescript
public async deletePublicData(path: string): Promise<void>
```
Elimina dati pubblici dell'utente.
- `path`: Percorso da eliminare
- **Errori**: Se l'utente non è autenticato

## Gestione Chiavi

### getPublicKey
```typescript
public getPublicKey(): string
```
Ottiene la chiave pubblica dell'utente corrente.
- **Ritorna**: Chiave pubblica
- **Errori**: Se l'utente non è autenticato

### getPair
```typescript
public getPair(): GunKeyPair
```
Ottiene la coppia di chiavi dell'utente corrente.
- **Ritorna**: Coppia di chiavi GunDB

### exportGunKeyPair
```typescript
public async exportGunKeyPair(): Promise<string>
```
Esporta la coppia di chiavi dell'utente corrente.
- **Ritorna**: Coppia di chiavi in formato JSON
- **Errori**: Se l'utente non è autenticato

### importGunKeyPair
```typescript
public async importGunKeyPair(keyPairJson: string): Promise<string>
```
Importa e autentica con una coppia di chiavi.
- `keyPairJson`: Coppia di chiavi in formato JSON
- **Ritorna**: Chiave pubblica
- **Errori**: Per coppia di chiavi non valida o errori di importazione

## Metodi di Utilità

### isAuthenticated
```typescript
public isAuthenticated(): boolean
```
Verifica se un utente è attualmente autenticato.
- **Ritorna**: `true` se l'utente è autenticato

### exists
```typescript
public async exists(alias: string): Promise<boolean>
```
Verifica se un nome utente è già in uso.
- `alias`: Nome utente da verificare
- **Ritorna**: `true` se il nome utente esiste

### authListener
```typescript
public async authListener(): Promise<void>
```
Inizializza il listener di autenticazione.
- **Note**: Timeout di 2 secondi se non riceve l'evento auth

### getGun
```typescript
public getGun(): any
```
Ottiene l'istanza GunDB.
- **Ritorna**: Istanza GunDB

### getUser
```typescript
public getUser(): any
```
Ottiene l'utente GunDB corrente.
- **Ritorna**: Utente GunDB corrente 