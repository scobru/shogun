# 🤖 Shogun - Guida per LLM

Questa guida è progettata specificamente per i Large Language Models che devono interagire con Shogun.

## 📚 Panoramica

Shogun è un wallet manager decentralizzato che utilizza Gun.js per gestire wallet e chiavi private direttamente nel browser. Supporta:
- Autenticazione tradizionale (username/password)
- Autenticazione biometrica (WebAuthn)
- Indirizzi stealth
- Storage decentralizzato
- Gestione chiavi crittografiche
- Integrazione Web3

## 🔑 Gestione Account

### Creazione Account Standard
```typescript
const manager = new WalletManager();
await manager.createAccount(alias, passphrase);
```
- `alias`: string - Username dell'utente
- `passphrase`: string - Password dell'utente
- Ritorna: Promise<void>
- Errori comuni: "Account already exists", "Network error"

### Creazione Account con WebAuthn
```typescript
if (manager.isWebAuthnSupported()) {
  const result = await manager.createAccountWithWebAuthn(alias);
}
```
- `alias`: string - Username dell'utente
- Ritorna: Promise<WalletResult>
- Verifica sempre il supporto WebAuthn prima dell'utilizzo

### Login
```typescript
// Login standard
const pubKey = await manager.login(alias, passphrase);

// Login con WebAuthn
const pubKey = await manager.loginWithWebAuthn(alias);

// Login con chiave privata Ethereum
const pubKey = await manager.loginWithPrivateKey(privateKey);
```

## 💼 Gestione Wallet

### Creazione Wallet
```typescript
// Creazione da Gun keypair
const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);

// Creazione da salt specifico
const wallet = await WalletManager.createWalletFromSalt(gunKeyPair, salt);
```

### Salvataggio Wallet
```typescript
// Salvataggio completo (Gun + localStorage)
await manager.saveWallet(wallet, publicKey, StorageType.BOTH);

// Solo Gun
await manager.saveWallet(wallet, publicKey, StorageType.GUN);

// Solo localStorage
await manager.saveWalletLocally(wallet, publicKey);
```

### Recupero Wallet
```typescript
// Recupero da entrambe le fonti
const wallet = await manager.retrieveWallet(publicKey, StorageType.BOTH);

// Solo da Gun
const wallet = await manager.retrieveWallet(publicKey, StorageType.GUN);

// Solo da localStorage
const wallet = await manager.retrieveWalletLocally(publicKey);
```

## 🔒 Gestione Dati

### Export/Import
```typescript
// Export completo
const backup = await manager.exportAllData(publicKey);

// Import completo
await manager.importAllData(backup, publicKey);

// Export/Import Gun keypair
const keypair = await manager.exportGunKeyPair();
const pubKey = await manager.importGunKeyPair(keypairJson);
```

### Gestione LocalStorage
```typescript
// Verifica dati locali
const status = await manager.checkLocalData(publicKey);
/* status = {
  hasWallet: boolean,
  hasStealthKeys: boolean,
  hasPasskey: boolean
} */

// Pulizia dati locali
await manager.clearLocalData(publicKey);
```

## 🕶️ Indirizzi Stealth

### Generazione Chiavi Stealth
```typescript
const stealthChain = manager.getStealthChain();
stealthChain.generateStealthKeys((keyPair) => {
  // Gestisci il keyPair
});
```

### Generazione Indirizzo Stealth
```typescript
stealthChain.generateStealthAddress(recipientPublicKey, (result) => {
  // result contiene stealthAddress, ephemeralPublicKey, recipientPublicKey
});
```

## ⚠️ Gestione Errori

Principali tipi di errori da gestire:
1. Errori di autenticazione
   - "User not authenticated"
   - "Invalid credentials"
   - "Account already exists"

2. Errori WebAuthn
   - "WebAuthn not supported"
   - "Biometric verification failed"
   - "User verification required"

3. Errori di rete
   - "Network error"
   - "Connection timeout"
   - "Gun peer unreachable"

4. Errori di storage
   - "Local storage not available"
   - "Data save failed"
   - "Invalid data format"

Esempio di gestione errori:
```typescript
try {
  await manager.createAccountWithWebAuthn(alias);
} catch (error) {
  if (error.message.includes('WebAuthn not supported')) {
    // Fallback a autenticazione standard
    await manager.createAccount(alias, passphrase);
  } else if (error.message.includes('already exists')) {
    // Gestisci account esistente
  } else {
    // Gestisci altri errori
    console.error('Error:', error);
  }
}
```

## 🔍 Validazioni

Quando interagisci con Shogun, verifica sempre:

1. Input utente
   - Username: stringa non vuota
   - Password: lunghezza minima e complessità
   - Indirizzi Ethereum: formato valido (0x...)

2. Stato sistema
   - Supporto WebAuthn: `manager.isWebAuthnSupported()`
   - Autenticazione: `manager.getPublicKey()`
   - Disponibilità localStorage: `typeof localStorage !== 'undefined'`

3. Dati wallet
   - Validità indirizzo: inizia con "0x" e lunghezza 42
   - Presenza chiave privata
   - Presenza entropy per derivazione deterministica

## 📝 Note Importanti

1. **Sicurezza**
   - Le chiavi private non sono mai salvate in chiaro
   - Usa sempre `StorageType.BOTH` per ridondanza dati
   - Pulisci i dati sensibili quando non necessari

2. **Performance**
   - Evita letture/scritture Gun frequenti
   - Usa localStorage per dati frequentemente acceduti
   - Implementa caching dove possibile

3. **UX**
   - Preferisci WebAuthn quando disponibile
   - Fornisci feedback chiaro sugli errori
   - Implementa fallback per funzionalità non supportate

4. **Compatibilità**
   - Verifica supporto browser (Web Crypto API, localStorage)
   - Gestisci ambienti Node.js (crypto module)
   - Supporta multiple versioni Gun.js 