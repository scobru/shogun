# GunStorage API Reference

`GunStorage` fornisce un layer di storage decentralizzato basato su GunDB con supporto per crittografia e gestione dati. Questa è una classe astratta che serve come base per altre implementazioni.

## Costruttore

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Crea una nuova istanza di GunStorage.
- `gun`: Istanza GunDB
- `APP_KEY_PAIR`: Coppia di chiavi SEA dell'applicazione

## Gestione Dati Privati

### savePrivateData
```typescript
protected async savePrivateData(data: T, path: string = ""): Promise<boolean>
```
Memorizza dati privati con verifica.
- `data`: Dati da memorizzare
- `path`: Percorso di memorizzazione (opzionale)
- **Ritorna**: `true` se il salvataggio ha successo
- **Errori**: Se l'utente non è autenticato
- **Note**: Include pulizia dei dati esistenti e verifica del salvataggio con timeout di 2 secondi

### getPrivateData
```typescript
protected async getPrivateData(path: string = ""): Promise<T | null>
```
Recupera dati privati.
- `path`: Percorso di memorizzazione (opzionale)
- **Ritorna**: Dati recuperati o null
- **Errori**: Se l'utente non è autenticato
- **Note**: Supporta parsing automatico JSON per dati stringa

### deletePrivateData
```typescript
protected async deletePrivateData(path: string = ""): Promise<void>
```
Elimina dati privati con verifica.
- `path`: Percorso da eliminare (opzionale)
- **Errori**: Se l'utente non è autenticato
- **Note**: Include meccanismo di retry (max 3 tentativi) e verifica della cancellazione

## Gestione Dati Pubblici

### savePublicData
```typescript
protected async savePublicData(data: any, path: string = ""): Promise<boolean>
```
Memorizza dati pubblici.
- `data`: Dati da memorizzare
- `path`: Percorso di memorizzazione (opzionale)
- **Ritorna**: `true` se il salvataggio ha successo
- **Errori**: Se l'utente non è autenticato
- **Note**: Supporto speciale per array con conversione automatica

### getPublicData
```typescript
protected async getPublicData(publicKey: string, path: string = ""): Promise<any>
```
Recupera dati pubblici.
- `publicKey`: Chiave pubblica dell'utente
- `path`: Percorso di memorizzazione (opzionale)
- **Ritorna**: Dati recuperati puliti dai metadata

### deletePublicData
```typescript
protected async deletePublicData(path?: string): Promise<void>
```
Elimina dati pubblici con verifica.
- `path`: Percorso da eliminare (opzionale)
- **Errori**: Se l'utente non è autenticato
- **Note**: Include verifica della cancellazione (max 5 tentativi) con timeout di 30 secondi

## Gestione Nodi

### getPrivateNode
```typescript
protected getPrivateNode(path: string = ""): IGunChain<any, any, IGunInstance, string>
```
Ottiene il nodo privato per un percorso.
- `path`: Percorso del nodo (opzionale)
- **Ritorna**: Catena GunDB per il nodo privato

### getPublicNode
```typescript
protected getPublicNode(path: string = ""): IGunChain<any, any, IGunInstance, string>
```
Ottiene il nodo pubblico per un percorso.
- `path`: Percorso del nodo (opzionale)
- **Ritorna**: Catena GunDB per il nodo pubblico
- **Errori**: Se la chiave pubblica non è trovata

## Metodi di Utilità

### isAuthenticated
```typescript
protected isAuthenticated(): boolean
```
Verifica se un utente è autenticato.
- **Ritorna**: `true` se l'utente è autenticato

### getCurrentPublicKey
```typescript
protected getCurrentPublicKey(): string
```
Ottiene la chiave pubblica dell'utente corrente.
- **Ritorna**: Chiave pubblica
- **Errori**: Se l'utente non è autenticato

### checkAuthentication
```typescript
protected checkAuthentication(): void
```
Verifica l'autenticazione dell'utente.
- **Errori**: Se l'utente non è autenticato

### cleanup
```typescript
public cleanup(): void
```
Pulisce lo stato e disconnette l'utente.

### cleanGunMetadata
```typescript
protected cleanGunMetadata<T>(data: any): T
```
Rimuove i metadata GunDB dai dati.
- `data`: Dati da pulire
- **Ritorna**: Dati puliti

### isNullOrEmpty
```typescript
protected isNullOrEmpty(data: any): boolean
```
Verifica se i dati sono null o vuoti.
- `data`: Dati da verificare
- **Ritorna**: `true` se i dati sono null o vuoti

## Gestione Percorsi

### setPrivateNodePath
```typescript
protected setPrivateNodePath(path: string): void
```
Imposta il percorso del nodo privato.
- `path`: Percorso da impostare

### setPublicNodePath
```typescript
protected setPublicNodePath(path: string): void
```
Imposta il percorso del nodo pubblico.
- `path`: Percorso da impostare

## Metodi di Storage

### put
```typescript
public async put(path: string, data: any): Promise<void>
```
Memorizza dati nel percorso specificato.
- `path`: Percorso dove memorizzare i dati
- `data`: Dati da memorizzare
- **Errori**: Se la memorizzazione fallisce

### get
```typescript
public async get(path: string): Promise<any>
```
Recupera dati dal percorso specificato.
- `path`: Percorso da cui recuperare i dati
- **Ritorna**: Dati recuperati
- **Errori**: Se il recupero fallisce

### remove
```typescript
public async remove(path: string): Promise<void>
```
Rimuove dati dal percorso specificato.
- `path`: Percorso da cui rimuovere i dati
- **Errori**: Se la rimozione fallisce

## Metodi di Crittografia

### encrypt
```typescript
public async encrypt(data: any): Promise<string>
```
Cripta i dati usando la chiave dell'utente.
- `data`: Dati da criptare
- **Ritorna**: Dati criptati
- **Errori**: Se la crittografia fallisce

### decrypt
```typescript
public async decrypt(encryptedData: string): Promise<any>
```
Decripta i dati usando la chiave dell'utente.
- `encryptedData`: Dati criptati
- **Ritorna**: Dati decriptati
- **Errori**: Se la decrittografia fallisce

## Metodi di Sincronizzazione

### sync
```typescript
public async sync(path: string, callback: (data: any) => void): Promise<void>
```
Sincronizza i dati dal percorso specificato.
- `path`: Percorso da sincronizzare
- `callback`: Funzione chiamata quando i dati cambiano
- **Errori**: Se la sincronizzazione fallisce

### unsubscribe
```typescript
public unsubscribe(path: string): void
```
Annulla la sottoscrizione ai cambiamenti del percorso.
- `path`: Percorso da cui disiscriversi

