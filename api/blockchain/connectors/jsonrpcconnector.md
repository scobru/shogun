# JsonRpcConnector API Reference

`JsonRpcConnector` fornisce un connettore JSON-RPC per l'integrazione con la blockchain Ethereum, gestendo l'autenticazione e le operazioni crittografiche.

## Costruttore

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Crea una nuova istanza di JsonRpcConnector.

## Metodi Principali

### setCustomProvider
```typescript
public setCustomProvider(rpcUrl: string, privateKey: string): void
```
Configura un provider JSON-RPC personalizzato.
- `rpcUrl`: URL endpoint RPC
- `privateKey`: Chiave privata del wallet
- **Errori**: Se i parametri non sono validi

### getSigner
```typescript
public async getSigner(): Promise<ethers.Signer>
```
Ottiene l'istanza del signer attivo.
- **Ritorna**: Istanza Signer di Ethers.js
- **Errori**: Se nessun signer è disponibile

### createAccount
```typescript
public async createAccount(): Promise<GunKeyPair>
```
Crea un nuovo account Ethereum.
- **Ritorna**: Coppia di chiavi generata
- **Errori**: Se l'autenticazione fallisce o l'operazione va in timeout

### login
```typescript
public async login(): Promise<string>
```
Autentica l'utente con il wallet Ethereum.
- **Ritorna**: Chiave pubblica dell'utente autenticato
- **Errori**: Se l'autenticazione fallisce

### verifySignature
```typescript
public async verifySignature(message: string, signature: string): Promise<string>
```
Verifica una firma crittografica.
- `message`: Messaggio originale firmato
- `signature`: Firma crittografica
- **Ritorna**: Indirizzo Ethereum recuperato
- **Errori**: Se gli input non sono validi

### generatePassword
```typescript
public async generatePassword(signature: string): Promise<string>
```
Genera una password deterministica da una firma.
- `signature`: Firma crittografica
- **Ritorna**: Stringa esadecimale di 64 caratteri
- **Errori**: Se la firma non è valida

### isMetaMaskAvailable
```typescript
static isMetaMaskAvailable(): boolean
```
Verifica se MetaMask è disponibile nel browser.
- **Ritorna**: `true` se MetaMask è installato e disponibile 