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

## 🕶️ Stealth Addresses

### Stealth Key Generation
```typescript
const stealthChain = manager.getStealthChain();
stealthChain.generateStealthKeys((keyPair) => {
  // Handle keyPair
});
```

### Stealth Address Generation
```typescript
stealthChain.generateStealthAddress(recipientPublicKey, (result) => {
  // result contains stealthAddress, ephemeralPublicKey, recipientPublicKey
});
```

## 🔐 WebAuthn

### Overview
```typescript
// Registration
const result = await manager.createAccountWithWebAuthn(alias);
/* result = {
  success: true,
  username: string,
  password: string,    // Generated deterministically from username + salt
  credentialId: string // WebAuthn credential ID
} */

// Login
const pubKey = await manager.loginWithWebAuthn(alias);
```

### Salt and Credential Management
```typescript
// Service only saves salt in Gun
await gun.get(DAPP_NAME)
  .get("webauthn-credentials")
  .get(username)
  .put({
    salt,
    timestamp: Date.now()
  });

// Credentials are generated deterministically
const generateCredentials = (username: string, salt: string) => {
  return {
    password: sha256(username + salt)
  };
};
```

### Validations
```typescript
// Username validation
if (username.length < 3 || username.length > 64) {
  throw new Error('Username length invalid');
}
if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
  throw new Error('Invalid username characters');
}

// WebAuthn support check
if (!manager.isWebAuthnSupported()) {
  throw new Error('WebAuthn not supported');
}
```

### Error Handling
Main errors to handle:
1. Validation errors
   - "Username must be between 3 and 64 characters"
   - "Username can only contain letters, numbers, underscores and hyphens"

2. WebAuthn errors
   - "WebAuthn not supported in this browser"
   - "Username already registered with WebAuthn"
   - "No WebAuthn credentials found"
   - "WebAuthn verification failed"

3. Timeout errors
   - 60 seconds timeout for WebAuthn operations

### Best Practices
1. **Security**
   - Always use dynamic challenges for each operation
   - Always verify WebAuthn support before use
   - Never store credentials, only salt

2. **UX**
   - Handle timeouts (60 seconds)
   - Provide clear error feedback
   - Implement fallbacks for unsupported browsers

3. **Implementation**
   - Use `AbortController` for timeout handling
   - Always verify authenticator response
   - Keep salt secure in Gun

## ⚠️ Error Handling

Main error types to handle:
1. Authentication errors
   - "User not authenticated"
   - "Invalid credentials"
   - "Account already exists"

2. WebAuthn errors
   - "WebAuthn not supported"
   - "Biometric verification failed"
   - "User verification required"

3. Network errors
   - "Network error"
   - "Connection timeout"
   - "Gun peer unreachable"

4. Storage errors
   - "Local storage not available"
   - "Data save failed"
   - "Invalid data format"

Error handling example:
```typescript
try {
  await manager.createAccountWithWebAuthn(alias);
} catch (error) {
  if (error.message.includes('WebAuthn not supported')) {
    // Fallback to standard authentication
    await manager.createAccount(alias, passphrase);
  } else if (error.message.includes('already exists')) {
    // Handle existing account
  } else {
    // Handle other errors
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

## 🔫 Esempi Pratici Gun

### Salvataggio Wallet
```typescript
// Salva un wallet
await gun.get("wallets")
  .get(publicKey)
  .put({
    address: wallet.address,
    entropy: walletData.entropy,
    timestamp: Date.now()
  });

// Recupera un wallet
gun.get("wallets")
  .get(publicKey)
  .once((data) => {
    if (data?.entropy) {
      // Rigenera il wallet dall'entropy
      const wallet = createWalletFromSalt(data.entropy);
    }
  });
```

### Gestione WebAuthn
```typescript
// Salva credenziali WebAuthn
await gun.get(DAPP_NAME)
  .get("webauthn-credentials")
  .get(username)
  .put({
    salt: generatedSalt,
    timestamp: Date.now()
  });

// Verifica login
gun.get(DAPP_NAME)
  .get("webauthn-credentials")
  .get(username)
  .once((data) => {
    if (data?.salt) {
      // Genera credenziali dal salt
      const credentials = generateCredentialsFromSalt(username, data.salt);
    }
  });
```

### Chiavi Stealth
```typescript
// Salva chiavi stealth pubbliche
gun.get("stealthKeys")
  .get(publicKey)
  .put(stealthKeyPair.epub);

// Recupera chiavi stealth
gun.user(publicKey)
  .get("stealthKeys")
  .once((data) => {
    if (data?.pub && data?.epub) {
      // Usa le chiavi per operazioni stealth
    }
  });
```

### Best Practices

1. **Gestione Concorrenza**
   ```typescript
   // Usa once() per letture singole
   gun.once((data) => {});
   
   // Usa on() per dati che cambiano
   gun.on((data) => {});
   ```

2. **Timeout e Errori**
   ```typescript
   // Implementa sempre timeout
   const timeout = setTimeout(() => {
     reject(new Error("Timeout"));
   }, 25000);

   gun.once((data) => {
     clearTimeout(timeout);
     // Processa i dati
   });
   ```

3. **Validazione Dati**
   ```typescript
   // Verifica sempre i dati ricevuti
   gun.once((data) => {
     if (!data || !data.required_field) {
       throw new Error("Dati invalidi");
     }
     // Processa i dati validi
   });
   ```

### Debugging

1. **Logging Strutturato**
   ```typescript
   gun.once((data) => {
     console.log("📥 Data received:", {
       path: "wallets/" + publicKey,
       data,
       timestamp: new Date()
     });
   });
   ```

2. **Gestione Errori**
   ```typescript
   try {
     await gun.get("path").put(data);
   } catch (error) {
     console.error("❌ Gun error:", {
       operation: "put",
       path: "path",
       error: error.message
     });
   }
   ``` 