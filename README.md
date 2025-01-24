# SHOGUN - Decentralized Wallet Manager

**SHOGUN** è un wallet manager decentralizzato che utilizza Gun.js per gestire wallet e chiavi private direttamente nel browser. Fornisce un sistema completo di autenticazione e gestione delle chiavi con supporto per indirizzi stealth.

## ✨ Caratteristiche Principali

- 🔐 **Sicurezza Avanzata**
  - Gestione sicura delle chiavi private con Web Crypto API
  - Supporto indirizzi stealth
  - Crittografia end-to-end
  - Gestione sicura dell'entropy

- 🌐 **Decentralizzazione**
  - Storage distribuito con Gun.js
  - Sincronizzazione P2P
  - Nessun server centrale

- 🔄 **Portabilità**
  - Import/export completo dei dati
  - Backup crittografati
  - Supporto multi-device
  - Gestione localStorage cross-platform

## 🚀 Installazione

```bash
# Installa da npm
npm install @scobru/shogun

# O clona il repository
git clone https://github.com/scobru/shogun
cd shogun

# Installa dipendenze
npm install

# Build
npm run build

# Test
npm test
```

## 📚 Quick Start

### Uso Base

```typescript
import { WalletManager, StorageType } from '@scobru/shogun'

// Inizializza con configurazione Gun di default
const manager = new WalletManager();

// Crea account
await manager.createAccount('username', 'password');

// Login
const pubKey = await manager.login('username', 'password');

// Crea wallet
const gunKeyPair = manager.getCurrentUserKeyPair();
const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);

console.log('Indirizzo:', walletObj.address);
console.log('Chiave Privata:', walletObj.privateKey);
console.log('Entropy:', walletObj.entropy);

// Salva wallet (varie opzioni)
await manager.saveWallet(walletObj, pubKey, StorageType.BOTH);  // Gun + localStorage
await manager.saveWallet(walletObj, pubKey, StorageType.GUN);   // Solo Gun
await manager.saveWalletLocally(walletObj, pubKey);             // Solo localStorage

// Recupera wallet
const walletFromBoth = await manager.retrieveWallet(pubKey, StorageType.BOTH);
const walletFromGun = await manager.retrieveWallet(pubKey, StorageType.GUN);
const walletFromLocal = await manager.retrieveWalletLocally(pubKey);
```

### Gestione Wallet con Entropy

```typescript
// Crea wallet da salt specifico
const salt = 'my_custom_salt';
const wallet = await WalletManager.createWalletFromSalt(gunKeyPair, salt);

console.log('Indirizzo:', wallet.address);
console.log('Entropy:', wallet.entropy); // Sarà uguale al salt

// Verifica che wallet diversi vengano creati da salt diversi
const wallet1 = await WalletManager.createWalletFromSalt(gunKeyPair, 'salt1');
const wallet2 = await WalletManager.createWalletFromSalt(gunKeyPair, 'salt2');
console.log(wallet1.address !== wallet2.address); // true
```

### Gestione LocalStorage

```typescript
// Verifica dati locali
const status = await manager.checkLocalData('username');
console.log('Ha wallet:', status.hasWallet);
console.log('Ha chiavi stealth:', status.hasStealthKeys);
console.log('Ha passkey:', status.hasPasskey);

// Salva wallet localmente
await manager.saveWalletLocally(wallet, 'username');

// Recupera wallet locale
const localWallet = await manager.retrieveWalletLocally('username');

// Pulisci dati locali
await manager.clearLocalData('username');
```

### Import/Export

```typescript
// Esporta tutti i dati
const backup = await manager.exportAllData('username');

// Importa dati
await manager.importAllData(backup, 'username');

// Esporta solo keypair Gun
const keypair = await manager.exportGunKeyPair();

// Importa keypair Gun
const pubKey = await manager.importGunKeyPair(keypairJson);
```

## 🔒 Sicurezza

### Gestione Chiavi

- Le chiavi private non vengono mai salvate in chiaro
- L'entropy viene usata per la derivazione deterministica dei wallet
- Web Crypto API usata nel browser
- Node crypto usato in Node.js
- Validazione delle chiavi private e degli indirizzi

### Storage Sicuro

```typescript
// Esempio di salvataggio sicuro
const walletData = {
  address: wallet.address,
  privateKey: wallet.privateKey,
  entropy: wallet.entropy
};

// I dati vengono salvati crittografati
await manager.saveWalletLocally(wallet, 'username');

// Pulisci sempre i dati sensibili quando non servono
await manager.clearLocalData('username');
```

## 📦 Interfacce

```typescript
interface WalletData {
  address: string;    // Indirizzo Ethereum
  privateKey: string; // Chiave privata
  entropy: string;    // Entropy usata per la generazione
}

interface WalletResult {
  walletObj: WalletData;
  entropy: string;
}

interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}

enum StorageType {
  GUN,    // Solo Gun
  LOCAL,  // Solo localStorage
  BOTH    // Entrambi
}
```

## 🧪 Test

```bash
# Tutti i test
npm test

# Test specifici
npm test -- -g "Local Storage"
npm test -- -g "Wallet Creation"
npm test -- -g "Gun KeyPair"
```

## 💻 Compatibilità

- **Browser**: 
  - Web Crypto API per operazioni crittografiche
  - localStorage per storage locale
  - Gun.js per storage distribuito

- **Node.js**:
  - Modulo crypto nativo
  - node-localstorage per compatibilità localStorage
  - Gun.js per storage distribuito

## 📖 API Reference

### WalletManager

```typescript
class WalletManager {
  constructor()

  // Autenticazione
  async createAccount(alias: string, passphrase: string): Promise<void>
  async login(alias: string, passphrase: string): Promise<string>
  logout(): void

  // Gestione Wallet
  static async createWalletObj(gunKeyPair: GunKeyPair): Promise<WalletResult>
  static async createWalletFromSalt(gunKeyPair: GunKeyPair, salt: string): Promise<Wallet>
  static async createHash(data: string): Promise<string>

  // Storage
  async saveWallet(wallet: Wallet, publicKey: string, storageType?: StorageType): Promise<void>
  async retrieveWallet(publicKey: string, storageType?: StorageType): Promise<Wallet | null>
  async saveWalletLocally(wallet: Wallet, alias: string): Promise<void>
  async retrieveWalletLocally(alias: string): Promise<Wallet | null>
  
  // Gestione Dati
  async checkLocalData(alias: string): Promise<{hasWallet: boolean, hasStealthKeys: boolean, hasPasskey: boolean}>
  async clearLocalData(alias: string): Promise<void>

  // Import/Export
  async exportGunKeyPair(): Promise<string>
  async importGunKeyPair(keyPairJson: string): Promise<string>
  async exportAllData(alias: string): Promise<string>
  async importAllData(jsonData: string, alias: string): Promise<void>

  // Utility
  getEthereumManager(): EthereumManager
  getStealthChain(): StealthChain
  getGun(): Gun
  getCurrentUserKeyPair(): GunKeyPair
  getPublicKey(): string
}
```

## 🤝 Contributing

Le pull request sono benvenute! Per modifiche importanti:

1. 🍴 Forka il repository
2. 🔧 Crea un branch (`git checkout -b feature/amazing`)
3. 💾 Committa le modifiche (`git commit -m 'Add feature'`)
4. 🚀 Pusha il branch (`git push origin feature/amazing`)
5. 📝 Apri una Pull Request

## 📄 License

[MIT](LICENSE)

## 🗺️ Roadmap

- [ ] Autenticazione WebAuthn/Passkey
- [ ] Smart-Contract StealthChain
- [ ] Integrazione Layer 2
- [ ] Supporto hardware wallet
- [ ] Miglioramenti sicurezza
