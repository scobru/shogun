<br />
<br />

<p align="center">
  <img src="https://user-images.githubusercontent.com/2731362/58195666-5cba9a00-7c7d-11e9-8409-5aa34b780ea2.png" width="240" />
</p>

<br />
<br />

**GunHedgehog** è una versione decentralizzata di Hedgehog che gestisce il wallet e le chiavi private dell'utente direttamente nel browser, utilizzando Gun.js come database decentralizzato. Espone una semplice API che permette di creare un sistema di autenticazione per consentire agli utenti di registrarsi e accedere al proprio wallet su più browser e dispositivi.

Con GunHedgehog:

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
import { GunHedgehog } from 'gunhedgehog';

// Inizializza GunHedgehog
const hedgehog = new GunHedgehog();

// Registrazione nuovo utente
await hedgehog.signUp('username', 'password');

// Login utente esistente
const wallet = await hedgehog.login('username', 'password');

// Creazione nuovo wallet
await hedgehog.createNewWallet('Il Mio Nuovo Wallet');

// Cambio wallet attivo
await hedgehog.switchWallet(walletAddress);

// Logout
await hedgehog.logout();
```

## API Disponibili

### Gestione Account

```typescript
// Registrazione nuovo utente
await hedgehog.signUp(username: string, password: string): Promise<void>

// Login utente esistente
const wallet = await hedgehog.login(username: string, password: string): Promise<Wallet>

// Logout
await hedgehog.logout(): Promise<void>

// Verifica se l'utente è loggato
const isLoggedIn = hedgehog.isLoggedIn(): boolean

// Ottieni il wallet attualmente selezionato
const currentWallet = hedgehog.getWallet(): Wallet | null
```

### Gestione Wallet

```typescript
// Crea un nuovo wallet con nome personalizzato
const wallet = await hedgehog.createNewWallet(name: string = "Nuovo Wallet"): Promise<Wallet>

// Crea un wallet senza selezionarlo automaticamente
await hedgehog.createWallet(name: string): Promise<void>

// Cambia il wallet attivo usando l'indirizzo
const success = await hedgehog.switchWallet(address: string): Promise<boolean>

// Rimuovi un wallet usando l'indirizzo
await hedgehog.removeWallet(address: string): Promise<void>
```

### Accesso ai Dati dell'Account

```typescript
// Ottieni tutti i wallet dell'utente corrente
const wallets = await hedgehog.getWallets(): Promise<Array<{
  address: string;
  name: string;
  isSelected: boolean;
}>>

// Ottieni il wallet attualmente selezionato
const currentWallet = hedgehog.getWallet(): Wallet | null

// Ottieni l'indirizzo del wallet selezionato
const selectedAddress = hedgehog.getSelectedWalletAddress(): string | null

// Per accesso avanzato (se necessario):
const gun = hedgehog.getGunInstance(): GunInstance
const keyPair = hedgehog.getGunKeyPair(): GunKeyPair | null
const user = hedgehog.getUser(): any
```

### Gestione della Connessione

```typescript
// Verifica se l'istanza è pronta
const isReady = hedgehog.isReady(): boolean

// Attendi che l'istanza sia pronta
await hedgehog.waitUntilReady(): Promise<void>

// Chiudi la connessione Gun
await hedgehog.close(): Promise<void>
```

### Esempi Pratici

```typescript
// Esempio: Gestione completa dei wallet
const manageWallets = async () => {
  // Ottieni tutti i wallet
  const wallets = await hedgehog.getWallets();
  console.log('Wallet disponibili:', wallets);
  
  // Crea un nuovo wallet
  const newWallet = await hedgehog.createNewWallet('Wallet Trading');
  console.log('Nuovo wallet creato:', newWallet.address);
  
  // Cambia il wallet attivo
  if (wallets.length > 0) {
    const targetWallet = wallets[0];
    await hedgehog.switchWallet(targetWallet.address);
    console.log('Wallet attivo cambiato a:', targetWallet.name);
  }
};

// Esempio: Monitoraggio del wallet attivo
const monitorActiveWallet = () => {
  setInterval(async () => {
    const currentWallet = hedgehog.getWallet();
    const selectedAddress = hedgehog.getSelectedWalletAddress();
    
    console.log('Wallet attivo:', {
      address: selectedAddress,
      balance: currentWallet ? await currentWallet.getBalance() : '0'
    });
  }, 5000);
};
```

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

GunHedgehog è progettato per casi d'uso che coinvolgono transazioni di basso valore o nessun valore finanziario. Per applicazioni che gestiscono somme significative, si consiglia di utilizzare soluzioni più sicure come MetaMask.

## Contribuire

Le pull request sono benvenute. Per modifiche importanti, apri prima un issue per discutere cosa vorresti cambiare.

## Licenza

[MIT](https://choosealicense.com/licenses/mit/)
