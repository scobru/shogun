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

**HUGO** is a decentralized version of Hedgehog that manages user wallets and private keys directly in the browser, using Gun.js as a decentralized database. It exposes a simple API that allows you to create an authentication system to enable users to register and access their wallet across multiple browsers and devices.

With HUGO:

* 😍 Gli utenti possono creare account nella tua DApp con username + password
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
- **Sicurezza**: Le chiavi private non lasciano mai il browser dell'utente
- **Persistenza**: I dati vengono sincronizzati automaticamente tra dispositivi
- **API Semplice**: Interfaccia intuitiva per l'integrazione nelle DApp

## Esempio di Utilizzo Base

```typescript
import { WalletManager, StealthChain } from 'hugo';

// Inizializza WalletManager
const walletManager = new WalletManager();

// Registrazione nuovo utente
await walletManager.createAccount('alice', 'password123');

// Login utente esistente
const pubKey = await walletManager.login('alice', 'password123');

// Creazione nuovo wallet
const gunKeyPair = walletManager.getCurrentUserKeyPair();
const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);

// Salvataggio wallet
await walletManager.saveWalletToGun(walletObj, 'alice');

// Recupero wallet
const wallets = await walletManager.retrieveWallets('alice');
console.log('I miei wallet:', wallets);

// Utilizzo indirizzi stealth
const stealthChain = new StealthChain();

// Genera chiavi stealth per il ricevitore
const stealthKeys = await walletManager.generateStealthKeys(gunKeyPair);
await walletManager.saveStealthKeys('alice', stealthKeys);

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

// Logout
walletManager.logout();
```

## API Disponibili

### Gestione Account

```typescript
// Registrazione nuovo utente
await walletManager.createAccount(alias: string, passphrase: string): Promise<void>

// Login utente esistente
const pubKey = await walletManager.login(alias: string, passphrase: string): Promise<string | null>

// Logout
walletManager.logout(): void

// Verifica se l'utente è loggato
const pubKey = walletManager.getPublicKey(): string | null

// Ottieni il keyPair dell'utente corrente
const keyPair = walletManager.getCurrentUserKeyPair(): GunKeyPair
```

### Gestione Wallet

```typescript
// Crea un nuovo wallet object
const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair: GunKeyPair): Promise<WalletResult>

// Salva il wallet su GunDB
await walletManager.saveWalletToGun(wallet: Wallet, alias: string): Promise<void>

// Salva il wallet localmente (alias per saveWalletToGun)
await walletManager.saveWalletLocally(wallet: Wallet, alias: string): Promise<void>

// Recupera tutti i wallet di un utente
const wallets = await walletManager.retrieveWallets(alias: string): Promise<Wallet[]>

// Recupera un wallet specifico per indirizzo
const wallet = await walletManager.retrieveWalletByAddress(alias: string, publicKey: string): Promise<Wallet | null>

// Converte una chiave privata Gun in formato Ethereum
const ethPrivateKey = await walletManager.convertToEthPk(gunPrivateKey: string): Promise<string>
```

### Gestione Chiavi Stealth

```typescript
// Genera le chiavi stealth per il ricevitore
const keys = await walletManager.generateStealthKeys(pair: GunKeyPair): Promise<{
  spendingKey: string;
  viewingKey: string;
}>

// Salva le chiavi stealth su GunDB
await walletManager.saveStealthKeys(
  alias: string,
  stealthKeys: { spendingKey: string; viewingKey: string }
): Promise<void>

// Recupera le chiavi stealth da GunDB
const keys = await walletManager.retrieveStealthKeys(
  alias: string
): Promise<{ spendingKey: string; viewingKey: string }>

// Salva le chiavi stealth in localStorage
await walletManager.saveStealthKeysLocally(
  alias: string,
  stealthKeys: { spendingKey: string; viewingKey: string }
): Promise<void>

// Recupera le chiavi stealth da localStorage
const keys = await walletManager.retrieveStealthKeysLocally(
  alias: string
): Promise<{ spendingKey: string; viewingKey: string }>
```

### Esempi Pratici

```typescript
// Esempio: Gestione completa dei wallet
const manageWallets = async () => {
  const walletManager = new WalletManager();
  
  // Crea account e login
  await walletManager.createAccount("alice", "password123");
  const pubKey = await walletManager.login("alice", "password123");
  
  // Crea un nuovo wallet
  const gunKeyPair = walletManager.getCurrentUserKeyPair();
  const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);
  
  // Salva il wallet
  await walletManager.saveWalletToGun(walletObj, "alice");
  
  // Recupera i wallet
  const wallets = await walletManager.retrieveWallets("alice");
  console.log("Wallet disponibili:", wallets);
};

// Esempio: Gestione di più wallet per utente
const multipleWallets = async () => {
  const walletManager = new WalletManager();
  const username = "alice";
  
  // Login
  await walletManager.login(username, "password123");
  const gunKeyPair = walletManager.getCurrentUserKeyPair();
  
  // Crea due wallet
  const { walletObj: wallet1 } = await WalletManager.createWalletObj(gunKeyPair);
  const { walletObj: wallet2 } = await WalletManager.createWalletObj(gunKeyPair);
  
  // Salva entrambi
  await walletManager.saveWalletToGun(wallet1, username);
  await walletManager.saveWalletToGun(wallet2, username);
  
  // Recupera tutti i wallet
  const wallets = await walletManager.retrieveWallets(username);
  console.log("Wallet multipli:", wallets);
  
  // Recupera un wallet specifico
  const specificWallet = await walletManager.retrieveWalletByAddress(username, wallet1.publicKey);
  console.log("Wallet specifico:", specificWallet);
};

// Esempio: Utilizzo degli Indirizzi Stealth
const stealthExample = async () => {
  // Inizializza StealthChain
  const stealthChain = new StealthChain();
  
  // RICEVITORE: Genera le sue chiavi (questo è privato, solo il ricevitore lo fa)
  const receiverViewingKeyPair = await SEA.pair();
  const receiverSpendingKey = ethers.Wallet.createRandom().privateKey;
  
  // Il ricevitore condivide pubblicamente:
  const receiverPublicKeys = {
    viewingKey: receiverViewingKeyPair.epub, // chiave pubblica di visualizzazione
    spendingKey: new ethers.Wallet(receiverSpendingKey).address // indirizzo pubblico Ethereum
  };
  
  // MITTENTE: Genera un indirizzo stealth usando le chiavi pubbliche del ricevitore
  const { stealthAddress, ephemeralPublicKey } = await stealthChain.generateStealthAddress(
    receiverPublicKeys.viewingKey,  // usa la chiave pubblica di visualizzazione
    receiverPublicKeys.spendingKey  // usa l'indirizzo pubblico per la spesa
  );
  console.log('Indirizzo stealth generato:', stealthAddress);
  
  // Il mittente può ora inviare fondi all'indirizzo stealth
  // e condivide ephemeralPublicKey con il ricevitore
  
  // RICEVITORE: Recupera il wallet stealth usando le sue chiavi private
  const recoveredWallet = await stealthChain.openStealthAddress(
    stealthAddress,
    ephemeralPublicKey,
    receiverViewingKeyPair,  // usa il keypair completo per la visualizzazione
    receiverSpendingKey      // usa la chiave privata per la spesa
  );
  console.log('Wallet stealth recuperato:', recoveredWallet.address);
  
  // Il ricevitore può ora utilizzare recoveredWallet per gestire i fondi
  const balance = await recoveredWallet.getBalance();
  console.log('Bilancio del wallet stealth:', balance);
};
```

## Funzionalità Stealth Address

HUGO supporta la generazione e il recupero di indirizzi stealth per una maggiore privacy nelle transazioni. Gli indirizzi stealth sono indirizzi monouso generati dal mittente per il ricevitore, che solo il ricevitore può rivendicare usando le proprie chiavi private.

### Come Funziona

1. **Setup Iniziale**
   ```typescript
   // Il ricevitore genera le sue chiavi stealth
   const stealthKeys = await walletManager.generateStealthKeys(gunKeyPair);
   await walletManager.saveStealthKeys('alice', stealthKeys);
   ```

2. **Generazione Indirizzo Stealth (Mittente)**
   ```typescript
   // Il mittente usa le chiavi pubbliche del ricevitore
   const { stealthAddress, ephemeralPublicKey } = await stealthChain.generateStealthAddress(
     receiverPublicKeys.viewingKey,  // chiave pubblica di visualizzazione
     receiverPublicKeys.spendingKey  // indirizzo pubblico per la spesa
   );

   // Il mittente invia fondi a stealthAddress e condivide ephemeralPublicKey
   ```

3. **Recupero Wallet Stealth (Ricevitore)**
   ```typescript
   // Il ricevitore recupera il wallet usando le sue chiavi private
   const wallet = await stealthChain.openStealthAddress(
     stealthAddress,           // indirizzo stealth ricevuto
     ephemeralPublicKey,       // chiave pubblica effimera del mittente
     receiverViewingKeyPair,   // coppia di chiavi di visualizzazione
     receiverSpendingKey       // chiave privata di spesa
   );
   ```

### API Stealth Address

```typescript
// Interfaccia per le chiavi di visualizzazione
interface KeyPair {
  epub: string;  // Chiave pubblica di visualizzazione
  epriv: string; // Chiave privata di visualizzazione
}

// Genera le chiavi stealth per il ricevitore
const stealthKeys = await walletManager.generateStealthKeys(
  gunKeyPair: GunKeyPair
): Promise<{
  spendingKey: string;  // Chiave privata per spendere i fondi
  viewingKey: string;   // Chiave privata per visualizzare le transazioni
}>

// Salva le chiavi stealth (su GunDB o localStorage)
await walletManager.saveStealthKeys(
  alias: string,
  stealthKeys: { spendingKey: string; viewingKey: string }
): Promise<void>

// Genera un indirizzo stealth (lato mittente)
const { stealthAddress, ephemeralPublicKey } = await stealthChain.generateStealthAddress(
  receiverViewingPublicKey: string,  // Chiave pubblica di visualizzazione del ricevitore
  receiverSpendingPublicKey: string  // Indirizzo pubblico del ricevitore
): Promise<{
  stealthAddress: string;      // Indirizzo stealth generato
  ephemeralPublicKey: string;  // Chiave pubblica effimera da condividere
}>

// Recupera il wallet stealth (lato ricevitore)
const wallet = await stealthChain.openStealthAddress(
  stealthAddress: string,             // Indirizzo stealth da recuperare
  senderEphemeralPublicKey: string,   // Chiave pubblica effimera del mittente
  receiverViewingKeyPair: KeyPair,    // Coppia di chiavi di visualizzazione
  receiverSpendingKey: string         // Chiave privata di spesa
): Promise<ethers.Wallet>             // Wallet Ethereum con accesso ai fondi
```

### Flusso di Privacy

1. Il ricevitore genera e salva le sue chiavi stealth
2. Il ricevitore condivide pubblicamente solo:
   - La chiave pubblica di visualizzazione
   - L'indirizzo pubblico per la spesa

3. Il mittente:
   - Genera una coppia di chiavi effimere
   - Calcola un segreto condiviso usando la chiave pubblica di visualizzazione del ricevitore
   - Genera un indirizzo stealth univoco
   - Invia i fondi all'indirizzo stealth
   - Condivide la chiave pubblica effimera con il ricevitore

4. Il ricevitore:
   - Usa la sua chiave privata di visualizzazione con la chiave pubblica effimera del mittente
   - Deriva lo stesso segreto condiviso
   - Recupera il wallet stealth e accede ai fondi

### Vantaggi degli Indirizzi Stealth

* 🔒 Maggiore privacy nelle transazioni
* 👥 Indirizzi monouso per ogni transazione
* 🔑 Solo il legittimo ricevitore può accedere ai fondi
* 🌐 Compatibile con qualsiasi wallet Ethereum
* 🔐 Separazione tra chiavi di visualizzazione e di spesa
* 📱 Ideale per applicazioni che richiedono privacy
* 🛡️ Il mittente non può tracciare le transazioni future del ricevitore
* 🤝 Il ricevitore può dimostrare la proprietà dei fondi

## Casi d'Uso Ideali

*[Casi d'uso ottimali]*

* **DApp con Autenticazione**: Perfetto per applicazioni che richiedono un sistema di autenticazione decentralizzato con wallet integrato
* **Multi-Device**: Ideale per applicazioni che necessitano di sincronizzazione del wallet tra dispositivi
* **Gaming DApp**: Semplifica l'esperienza utente nascondendo la complessità della gestione del wallet

*[Casi d'uso non consigliati]*

Come per Hedgehog originale, non è consigliato l'utilizzo in:

* **DApp Bancarie**
* **Prestiti Decentralizzati**
* **Mercati Predittivi**
* Qualsiasi applicazione che gestisce grandi somme di denaro

## Sicurezza

HUGO è progettato per casi d'uso che coinvolgono transazioni di basso valore o nessun valore finanziario. Per applicazioni che gestiscono somme significative, si consiglia di utilizzare soluzioni più sicure come MetaMask.

## Contribuire

Le pull request sono benvenute. Per modifiche importanti, apri prima un issue per discutere cosa vorresti cambiare.

## Licenza

[MIT](https://choosealicense.com/licenses/mit/)
