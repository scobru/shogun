# ActivityPub API Reference

`ActivityPub` fornisce un'implementazione sicura del protocollo ActivityPub, gestendo chiavi, autenticazione e operazioni crittografiche per il social networking decentralizzato.

## Costruttore

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Crea una nuova istanza di ActivityPub.

## Gestione Account

### createAccount
```typescript
public async createAccount(): Promise<ActivityPubKeys>
```
Genera una nuova coppia di chiavi RSA per ActivityPub.
- **Ritorna**: Chiavi ActivityPub generate
- **Errori**: Se la generazione delle chiavi fallisce

### login
```typescript
public async login(username: string, password: string): Promise<string>
```
Autentica un utente con le sue credenziali.
- `username`: Nome utente da autenticare
- `password`: Password dell'utente
- **Ritorna**: Chiave pubblica dell'utente
- **Errori**: Se l'autenticazione fallisce

## Gestione Chiavi

### saveKeys
```typescript
public async saveKeys(keys: ActivityPubKeys): Promise<void>
```
Memorizza in modo sicuro le chiavi ActivityPub con verifica.
- `keys`: Coppia di chiavi ActivityPub da memorizzare
- **Errori**: Se il salvataggio o la verifica fallisce

### getKeys
```typescript
public async getKeys(): Promise<ActivityPubKeys>
```
Recupera le chiavi ActivityPub memorizzate.
- **Ritorna**: Chiavi ActivityPub
- **Errori**: Se l'utente non è autenticato

### getPub
```typescript
public async getPub(): Promise<string>
```
Recupera la chiave pubblica.
- **Ritorna**: Chiave pubblica
- **Errori**: Se l'utente non è autenticato

### getPk
```typescript
public async getPk(username: string): Promise<string>
```
Recupera la chiave privata per un nome utente.
- `username`: Nome utente per cui recuperare la chiave
- **Ritorna**: Chiave privata
- **Errori**: Se il nome utente non è valido o la chiave non è trovata

### deleteKeys
```typescript
public async deleteKeys(): Promise<void>
```
Elimina le chiavi ActivityPub memorizzate con verifica.
- **Errori**: Se l'eliminazione o la verifica fallisce

## Operazioni Crittografiche

### sign
```typescript
public async sign(
  stringToSign: string,
  username: string
): Promise<{ signature: string; signatureHeader: string }>
```
Firma dati ActivityPub con la chiave privata dell'utente.
- `stringToSign`: Dati da firmare
- `username`: Nome utente associato alla chiave privata
- **Ritorna**: Firma e header della firma
- **Errori**: Se la firma fallisce

### importPk
```typescript
public async importPk(pem: string): Promise<CryptoKey | string>
```
Importa una chiave privata dal formato PEM.
- `pem`: Chiave privata in formato PEM
- **Ritorna**: CryptoKey importata o stringa PEM
- **Errori**: Se l'importazione fallisce 