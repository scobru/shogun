# WebauthnAuth API Reference

`WebauthnAuth` fornisce un layer di autenticazione sicuro utilizzando lo standard WebAuthn, abilitando l'autenticazione senza password con chiavi biometriche e di sicurezza hardware.

## Costruttore

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Crea una nuova istanza di WebauthnAuth.

## Metodi di Autenticazione

### createAccount
```typescript
public async createAccount(
  username: string,
  isNewDevice: boolean = false,
  deviceName?: string
): Promise<Record<string, any>>
```
Crea un nuovo account WebAuthn o aggiunge un nuovo dispositivo.
- `username`: Nome utente per l'account
- `isNewDevice`: Se questo è un nuovo dispositivo per un account esistente
- `deviceName`: Nome personalizzato opzionale per il dispositivo
- **Ritorna**: Risultato della creazione dell'account
- **Errori**: Se il nome utente non è valido o la creazione fallisce

### authenticateUser
```typescript
public async authenticateUser(username: string): Promise<WebAuthnResult>
```
Autentica un utente usando le credenziali WebAuthn.
- `username`: Nome utente da autenticare
- **Ritorna**: Risultato dell'autenticazione con credenziali
- **Errori**: Se l'autenticazione fallisce

### generateCredentials
```typescript
public async generateCredentials(
  username: string,
  isNewDevice: boolean = false,
  deviceName?: string
): Promise<WebAuthnResult>
```
Genera nuove credenziali WebAuthn.
- `username`: Nome utente per la generazione delle credenziali
- `isNewDevice`: Se questo è un nuovo dispositivo
- `deviceName`: Nome dispositivo personalizzato opzionale
- **Ritorna**: Credenziali generate
- **Errori**: Se la generazione fallisce

## Gestione Dispositivi

### getRegisteredDevices
```typescript
public async getRegisteredDevices(username: string): Promise<DeviceCredential[]>
```
Recupera tutti i dispositivi registrati per un utente.
- `username`: Nome utente da controllare
- **Ritorna**: Array di dispositivi registrati

### removeDevice
```typescript
public async removeDevice(
  username: string,
  credentialId: string
): Promise<boolean>
```
Rimuove un dispositivo registrato.
- `username`: Nome utente dell'account
- `credentialId`: ID della credenziale da rimuovere
- **Ritorna**: `true` se il dispositivo è stato rimosso

### verifyCredential
```typescript
public async verifyCredential(
  credentialId: string
): Promise<WebAuthnVerifyResult>
```
Verifica una credenziale WebAuthn.
- `credentialId`: ID della credenziale da verificare
- **Ritorna**: Risultato della verifica
- **Errori**: Se la verifica fallisce

## Metodi di Utilità

### isSupported
```typescript
public isSupported(): boolean
```
Verifica se WebAuthn è supportato nell'ambiente corrente.
- **Ritorna**: `true` se WebAuthn è supportato

### getPairFromGun
```typescript
public getPairFromGun(): GunKeyPair
```
Ottiene la coppia di chiavi GunDB corrente.
- **Ritorna**: Coppia di chiavi GunDB corrente 