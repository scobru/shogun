# StealthChain API Reference

`StealthChain` fornisce un'implementazione sicura degli indirizzi stealth per Ethereum, abilitando transazioni private attraverso indirizzi monouso.

## Costruttore

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Crea una nuova istanza di StealthChain.

## Gestione Account

### createAccount
```typescript
public async createAccount(): Promise<StealthKeyPair>
```
Genera o recupera chiavi stealth per l'utente corrente.
- **Ritorna**: Coppia di chiavi stealth
- **Errori**: Se la generazione delle chiavi fallisce

## Operazioni Indirizzi Stealth

### generateStAdd
```typescript
public async generateStAdd(recipientPublicKey: string): Promise<{
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}>
```
Genera un indirizzo stealth per un destinatario.
- `recipientPublicKey`: Chiave pubblica del destinatario
- **Ritorna**: Dettagli indirizzo stealth
- **Errori**: Se la generazione fallisce

### openStAdd
```typescript
public async openStAdd(
  stealthAddress: string,
  ephemeralPublicKey: string
): Promise<ethers.Wallet>
```
Deriva la chiave privata per un indirizzo stealth.
- `stealthAddress`: Indirizzo stealth da aprire
- `ephemeralPublicKey`: Chiave pubblica effimera usata nella generazione
- **Ritorna**: Wallet Ethereum derivato
- **Errori**: Se la derivazione fallisce

## Gestione Chiavi

### save
```typescript
public async save(stealthKeyPair: StealthKeyPair): Promise<void>
```
Salva le chiavi stealth nel profilo dell'utente.
- `stealthKeyPair`: Coppia di chiavi stealth da salvare
- **Errori**: Se le chiavi non sono valide o il salvataggio fallisce

### getPair
```typescript
public async getPair(): Promise<StealthKeyPair>
```
Recupera le chiavi stealth dell'utente corrente.
- **Ritorna**: Coppia di chiavi stealth
- **Errori**: Se le chiavi non sono trovate

### getPub
```typescript
public async getPub(publicKey: string): Promise<string | null>
```
Recupera la chiave pubblica stealth di un utente.
- `publicKey`: Chiave pubblica dell'utente
- **Ritorna**: Chiave pubblica stealth o null

### retrieveKeys
```typescript
public async retrieveKeys(publicKey: string): Promise<any>
```
Recupera le chiavi stealth dal registro pubblico.
- `publicKey`: Chiave pubblica per cui recuperare le chiavi stealth
- **Ritorna**: Chiavi recuperate o null

### retrievePair
```typescript
public async retrievePair(publicKey: string): Promise<StealthKeyPair | null>
```
Recupera la coppia completa di chiavi stealth per un utente.
- `publicKey`: Chiave pubblica per cui recuperare la coppia
- **Ritorna**: Coppia di chiavi stealth o null 