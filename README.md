<br />
<br />

<p align="center">
<svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="240" height="240" fill="url(#bgGradient)"/>
  <circle cx="120" cy="100" r="65" fill="#ffffff"/>
  <circle cx="120" cy="100" r="50" fill="#4a5568"/>
  <path d="M150 95 L165 95 L157.5 105 Z" fill="#ffffff" transform="rotate(-15, 157.5, 100)"/>
  <text x="50" y="225" fill="#ffffff" font-family="Arial, sans-serif" font-size="48" font-weight="bold" letter-spacing="2">HUGO</text>
</svg>
</p>

<br />
<br />

**HUGO** è una versione decentralizzata di Hedgehog che gestisce user wallets e chiavi private direttamente nel browser, usando Gun.js come database decentralizzato. Espone una semplice API che permette di creare un sistema di autenticazione per consentire agli utenti di registrarsi e accedere al loro wallet su più browser e dispositivi.

Con HUGO:

* 😍 Gli utenti possono creare account nella tua DApp con username + password
* 😍 Gli utenti possono usare il loro account Ethereum/Metamask esistente
* 😱 Gli utenti non devono preoccuparsi delle chiavi private o delle frasi mnemoniche
* 🔏 Puoi costruire sistemi che finanziano i wallet degli utenti e firmano transazioni, senza mai controllarli direttamente
* 🌇 Puoi concentrarti sulla logica di business, invece che sulla gestione dei wallet
* 🌐 I dati sono sincronizzati in modo decentralizzato tramite Gun.js
* 🔒 Le chiavi private non vengono mai trasmesse o memorizzate al di fuori del browser dell'utente

## Installazione

```bash
npm i gun
npm i ethers
# ... altre dipendenze necessarie ...
```

## Caratteristiche Principali

- **Gestione Account Decentralizzata**: Utilizza Gun.js per memorizzare e sincronizzare i dati degli account in modo decentralizzato
- **Multi-Wallet**: Supporto per la creazione e gestione di più wallet per utente
- **Integrazione Ethereum**: Supporto per login e registrazione con account Ethereum/Metamask
- **Provider Personalizzato**: Possibilità di utilizzare RPC e chiavi private personalizzate
- **Sicurezza**: Le chiavi private non lasciano mai il browser dell'utente
- **Persistenza**: I dati vengono sincronizzati automaticamente tra dispositivi
- **API Semplice**: Interfaccia intuitiva per l'integrazione nelle DApp

## Esempio di Utilizzo Base

```typescript
import { WalletManager } from 'hugo';

// Inizializza WalletManager
const walletManager = new WalletManager();

// Registrazione nuovo utente (metodo classico)
await walletManager.createAccount('alice', 'password123');

// Login utente esistente (metodo classico)
const pubKey = await walletManager.login('alice', 'password123');

// Creazione nuovo wallet
const gunKeyPair = walletManager.getCurrentUserKeyPair();
const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);

// Salvataggio wallet
await walletManager.saveWalletToGun(walletObj, 'alice');

// Recupero wallet
const wallets = await walletManager.retrieveWallets('alice');
console.log('I miei wallet:', wallets);
```

## Utilizzo con Ethereum

### Browser/Metamask

```typescript
import { WalletManager } from 'hugo';

const walletManager = new WalletManager();
const ethereumManager = walletManager.getEthereumManager();

// Registrazione con Metamask
const username = await ethereumManager.createAccountWithEthereum();
console.log('Account creato con indirizzo:', username);

// Login con Metamask
const pubKey = await ethereumManager.loginWithEthereum();
console.log('Login effettuato con chiave pubblica:', pubKey);
```

### Provider Personalizzato

```typescript
import { WalletManager } from 'hugo';

const walletManager = new WalletManager();
const ethereumManager = walletManager.getEthereumManager();

// Configura provider personalizzato
ethereumManager.setCustomProvider(
  "https://your-rpc-url.com",
  "0xYourPrivateKey"
);

// Usa normalmente
const username = await ethereumManager.createAccountWithEthereum();
const pubKey = await ethereumManager.loginWithEthereum();
```

## Utilizzo Indirizzi Stealth

```typescript
import { WalletManager } from 'hugo';

const walletManager = new WalletManager();
const stealthChain = walletManager.getStealthChain();

// Genera chiavi stealth per il ricevitore
const gunKeyPair = walletManager.getCurrentUserKeyPair();
const stealthKeys = await stealthChain.generateStealthKeys(gunKeyPair);
await stealthChain.saveStealthKeys('alice', stealthKeys);

// Prepara le chiavi pubbliche da condividere
const receiverPublicKeys = {
  viewingKey: receiverViewingKeyPair.epub,  // chiave pubblica di visualizzazione
  spendingKey: new ethers.Wallet(stealthKeys.spendingKey).address  // indirizzo pubblico
};

// Genera indirizzo stealth usando le chiavi pubbliche
const { stealthAddress, ephemeralPublicKey } = await stealthChain.generateStealthAddress(
  receiverPublicKeys.viewingKey,   // usa la chiave pubblica di visualizzazione
  receiverPublicKeys.spendingKey   // usa l'indirizzo pubblico
);
```

## API Disponibili

### WalletManager

```typescript
class WalletManager {
  // Gestione base degli account
  createAccount(alias: string, passphrase: string): Promise<void>
  login(alias: string, passphrase: string): Promise<string | null>
  logout(): void
  getPublicKey(): string | null
  getCurrentUserKeyPair(): GunKeyPair

  // Accesso ai manager specializzati
  getEthereumManager(): EthereumManager
  getStealthChain(): StealthChain

  // Gestione wallet
  static createWalletObj(gunKeyPair: GunKeyPair): Promise<WalletResult>
  saveWalletToGun(wallet: Wallet, alias: string): Promise<void>
  retrieveWallets(alias: string): Promise<Wallet[]>
  retrieveWalletByAddress(alias: string, publicKey: string): Promise<Wallet | null>
}
```

### EthereumManager

```typescript
class EthereumManager {
  // Configurazione provider
  setCustomProvider(rpcUrl: string, privateKey: string): void

  // Operazioni con Ethereum
  createAccountWithEthereum(): Promise<string>
  loginWithEthereum(): Promise<string | null>
}
```

### StealthChain

```typescript
class StealthChain {
  // Gestione chiavi stealth
  generateStealthKeys(pair: GunKeyPair): Promise<{ spendingKey: string; viewingKey: string }>
  saveStealthKeys(alias: string, stealthKeys: { spendingKey: string; viewingKey: string }): Promise<void>
  retrieveStealthKeys(alias: string): Promise<{ spendingKey: string; viewingKey: string }>

  // Operazioni stealth
  generateStealthAddress(receiverViewingKey: string, receiverSpendingKey: string): Promise<{ stealthAddress: string; ephemeralPublicKey: string }>
  openStealthAddress(stealthAddress: string, senderEphemeralPublicKey: string, receiverViewingKeyPair: KeyPair, receiverSpendingKey: string): Promise<ethers.Wallet>
}
```

## Sicurezza

HUGO è progettato per casi d'uso che coinvolgono transazioni di basso valore o nessun valore finanziario. Per applicazioni che gestiscono somme significative, si consiglia di utilizzare soluzioni più sicure come MetaMask.

## Contribuire

Le pull request sono benvenute. Per modifiche importanti, apri prima un issue per discutere cosa vorresti cambiare.

## Licenza

[MIT](https://choosealicense.com/licenses/mit/)

# Changelog

Tutte le modifiche notevoli a questo progetto verranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2024-01-17

### Aggiunto
- Supporto per autenticazione tramite Ethereum/Metamask
- Supporto completo per indirizzi stealth
- Gestione multi-wallet
- Sincronizzazione decentralizzata tramite Gun.js
- Test completi per tutte le funzionalità principali
- Documentazione dettagliata con esempi pratici

### Modificato
- Migliorata la gestione delle chiavi private
- Ottimizzata la sincronizzazione dei dati
- Aggiornate le dipendenze alle versioni più recenti

### Sicurezza
- Implementata la gestione sicura delle chiavi private
- Aggiunta la separazione tra chiavi di visualizzazione e di spesa
- Migliorata la gestione delle sessioni utente

## Esempio di Utilizzo con Ethereum

```typescript
import { WalletManager } from 'hugo';

// Inizializza WalletManager
const walletManager = new WalletManager();

// Registrazione nuovo utente con Ethereum
const username = await walletManager.createAccountWithEthereum();
console.log('Account creato con indirizzo:', username);

// Login con Ethereum
const pubKey = await walletManager.loginWithEthereum();
console.log('Login effettuato con chiave pubblica:', pubKey);

// Il resto delle operazioni rimane invariato
const gunKeyPair = walletManager.getCurrentUserKeyPair();
const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);
await walletManager.saveWalletToGun(walletObj, username);
```
