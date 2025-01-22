# HUGO - Wallet Manager Decentralizzato

**HUGO** è un wallet manager decentralizzato che utilizza Gun.js per gestire wallet e chiavi private direttamente nel browser. Offre un sistema completo di autenticazione e gestione delle chiavi con supporto per indirizzi stealth.

## ✨ Caratteristiche Principali

- 🔐 **Sicurezza Avanzata**
  - Gestione sicura delle chiavi private
  - Supporto per indirizzi stealth
  - Crittografia end-to-end

- 🌐 **Decentralizzazione**
  - Storage distribuito con Gun.js
  - Sincronizzazione P2P
  - Nessun server centrale

- 🔄 **Portabilità**
  - Import/export completo dei dati
  - Backup criptati
  - Supporto multi-device

## 🚀 Installazione

```bash
# Installa le dipendenze principali
npm install gun ethers

# Opzionale: per sviluppo/test
npm install --save-dev node-localstorage
```

## 📚 Guida Rapida

### Gestione Base Wallet

```typescript
import { WalletManager } from './src/WalletManager';

// Inizializza
const manager = new WalletManager();

// Crea account
await manager.createAccount('username', 'password');

// Login
const pubKey = await manager.login('username', 'password');

// Salva dati localmente
await manager.saveWalletLocally(wallet, 'username');

// Recupera dati
const wallet = await manager.retrieveWalletLocally('username');
```

### Indirizzi Stealth

```typescript
// Genera chiavi stealth
const stealthChain = manager.getStealthChain();
await new Promise((resolve) => {
  stealthChain.generateStealthKeys((err, keys) => {
    if (!err) resolve(keys);
  });
});

// Genera indirizzo stealth
await new Promise((resolve) => {
  stealthChain.generateStealthAddress(recipientPubKey, (err, result) => {
    if (!err) resolve(result);
  });
});
```

### Import/Export

```typescript
// Esporta tutti i dati
const backup = await manager.exportAllData('username');

// Importa dati
await manager.importAllData(backup, 'username');

// Esporta solo keypair
const keypair = await manager.exportGunKeyPair();
```

## 🔧 Configurazione Avanzata

### Provider Personalizzato

```typescript
const ethereumManager = manager.getEthereumManager();
ethereumManager.setCustomProvider(
  "https://your-rpc-url.com",
  "your-private-key"
);
```

### Storage Persistente

```typescript
// Verifica dati locali
const status = await manager.checkLocalData('username');
console.log(status.hasWallet, status.hasStealthKeys);

// Pulisci dati locali
await manager.clearLocalData('username');
```

## 🔒 Best Practices di Sicurezza

1. **Gestione Chiavi**
   - Non salvare mai chiavi private in chiaro
   - Usa sempre `exportAllData` per i backup
   - Verifica sempre l'integrità dei dati importati

2. **Autenticazione**
   - Usa password forti
   - Implementa 2FA dove possibile
   - Non riutilizzare le password

3. **Storage**
   - Pulisci i dati sensibili quando non servono
   - Usa `clearLocalData` al logout
   - Verifica sempre i dati con `checkLocalData`

## 🧪 Testing

```bash
# Installa dipendenze di sviluppo
npm install --save-dev mocha chai node-localstorage

# Esegui i test
npm test
```

## 📋 API Reference

### WalletManager

```typescript
class WalletManager {
  // Autenticazione
  async createAccount(alias: string, passphrase: string): Promise<void>
  async login(alias: string, passphrase: string): Promise<string>
  logout(): void

  // Gestione Dati
  async saveWalletLocally(wallet: Wallet, alias: string): Promise<void>
  async retrieveWalletLocally(alias: string): Promise<Wallet | null>
  async checkLocalData(alias: string): Promise<{hasWallet: boolean, hasStealthKeys: boolean}>
  async clearLocalData(alias: string): Promise<void>

  // Import/Export
  async exportGunKeyPair(): Promise<string>
  async importGunKeyPair(keyPairJson: string): Promise<string>
  async exportAllData(alias: string): Promise<string>
  async importAllData(jsonData: string, alias: string): Promise<void>

  // Utility
  getEthereumManager(): EthereumManager
  getStealthChain(): StealthChain
  getPublicKey(): string
}
```

## 🤝 Contributing

Le pull request sono benvenute! Per modifiche importanti:

1. 🍴 Forka il repository
2. 🔧 Crea un branch (`git checkout -b feature/amazing`)
3. 💾 Committa i cambiamenti (`git commit -m 'Add feature'`)
4. 🚀 Pusha il branch (`git push origin feature/amazing`)
5. 📝 Apri una Pull Request

## 📄 License

[MIT](LICENSE)

## 📞 Support

- 📧 Email: support@hugo-wallet.com
- 💬 Discord: [Hugo Community](https://discord.gg/hugo)
- 📚 Docs: [hugo-wallet.com/docs](https://hugo-wallet.com/docs)

## 🗺️ Roadmap

- [ ] **Integrazione Passkey/WebAuthn**
  - Autenticazione biometrica
  - Supporto FIDO2
  - Integrazione con Gun.js per storage sicuro
  - Migrazione da password a passkey
- [ ] Supporto per più blockchain
- [ ] Integrazione con DeFi protocols
- [ ] Mobile app
- [ ] Hardware wallet support
- [ ] Layer 2 integration

## 🔐 Passkey Integration (Pianificato)

HUGO pianifica di supportare le Passkey come metodo di autenticazione principale. Ecco come funzionerà:

### Flusso Previsto

```typescript
class WalletManager {
  // Registrazione con Passkey
  async createAccountWithPasskey(username: string): Promise<void> {
    // 1. Crea credenziali WebAuthn
    // 2. Associa con account Gun
    // 3. Salva chiavi crittografate
  }

  // Login con Passkey
  async loginWithPasskey(username: string): Promise<string> {
    // 1. Verifica credenziali WebAuthn
    // 2. Recupera e decripta chiavi Gun
    // 3. Autentica su Gun
  }
}
```

### Vantaggi dell'Integrazione Passkey

- 🔒 **Sicurezza Superiore**
  - Eliminazione delle password
  - Protezione contro il phishing
  - Autenticazione biometrica

- 🌟 **UX Migliorata**
  - Login con un tocco
  - Nessuna password da ricordare
  - Cross-device seamless

- 🔗 **Integrazione Gun.js**
  - Chiavi Gun crittografate con Passkey
  - Storage decentralizzato sicuro
  - Backup automatico delle chiavi

### Implementazione Tecnica Prevista

```typescript
interface PasskeyAuthData {
  publicKey: string;
  encryptedGunKeys: string;
  username: string;
}

class PasskeyManager {
  // Registrazione nuovo dispositivo
  async registerPasskey(username: string): Promise<PasskeyAuthData>;
  
  // Verifica e recupero chiavi
  async verifyAndGetKeys(username: string): Promise<GunKeyPair>;
  
  // Backup chiavi su nuovo dispositivo
  async backupToNewDevice(username: string): Promise<void>;
}
```
