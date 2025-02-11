# 🏰 SHOGUN

> Un'alternativa a Metamask che permette di costruire UX decentralizzate con gestione wallet basata su Gun.js

[![Version](https://img.shields.io/badge/version-0.0.16b-blue.svg)](https://www.npmjs.com/package/@scobru/shogun)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)](https://nodejs.org)

## 📦 Installazione

```bash
npm install @scobru/shogun
```

## ✨ Caratteristiche

- 🔐 **Gestione Wallet Decentralizzata**
  - Creazione e gestione wallet Ethereum
  - Supporto indirizzi stealth
  - Crittografia end-to-end
  - Gestione chiavi con Web Crypto API

- 🌐 **Storage Distribuito**
  - Basato su Gun.js
  - Sincronizzazione P2P
  - Nessun server centrale
  - Supporto ActivityPub

- 💬 **UnstoppableChat**
  - Chat P2P crittografata
  - Canali pubblici/privati
  - Sistema di annunci con RSS
  - Gestione contatti

- 💸 **Layer3 Micropagamenti**
  - Canali di pagamento off-chain
  - Smart contract per settlement
  - Sistema di challenge period
  - Relay per scalabilità

## 🚀 Utilizzo

### Core Wallet

```typescript
import { Shogun } from '@scobru/shogun'

// Inizializza
const shogun = new Shogun({
  peers: ['https://your-gun-peer.com/gun']
}, APP_KEY_PAIR);

// Gestione Wallet
const walletManager = shogun.getWalletManager();
const wallet = await walletManager.createAccount();

// Autenticazione
const authManager = shogun.getGunAuthManager();
await authManager.createAccount('username', 'password');
```

### UnstoppableChat

```typescript
import { UnstoppableChat } from '@scobru/shogun'

const chat = new UnstoppableChat(['https://your-gun-peer.com/gun']);

// Login
await chat.join('username', 'password', 'displayName');

// Canali
const channel = await chat.createChannel('myChannel', true);
await chat.sendMessageToChannel(channel, 'Hello!', {
  pubKey: chat.gun.user().is.pub,
  name: 'displayName'
});
```

### Layer3 Micropagamenti

```typescript
import { MicropaymentAPI } from '@scobru/shogun'

const payments = new MicropaymentAPI(
  'http://localhost:8080/gun',
  'http://localhost:8545',
  contractAddress,
  contractABI
);

// Apri canale
const state = {
  nonce: 0,
  clientBalance: ethers.parseEther("1.0"),
  relayBalance: "0"
};
await payments.openOffChainChannel(channelId, state);
```

## 🧪 Testing

```bash
# Avvia server Gun
npm run test:server

# Esegui test
npm test

# Watch mode
npm run test:watch
```

## 📚 Documentazione

Per la documentazione completa dell'API consulta [API.md](API.md)

## 🔧 Scripts

- `build`: Compila il progetto TypeScript
- `lint`: Esegue il linting del codice
- `test`: Esegue i test
- `test:watch`: Esegue i test in watch mode
- `test:server`: Avvia il server Gun per i test

## 💻 Requisiti

- Node.js >= 16.0.0
- Browser moderno con supporto Web Crypto API

## 🤝 Contributing

Le pull request sono benvenute! Per modifiche importanti, apri prima una issue per discutere i cambiamenti.

## 📄 License

MIT © [Scobru](https://github.com/scobru)

## 🔗 Links

- [Repository](https://github.com/scobru/hugo)
- [Bug Reports](https://github.com/scobru/hugo/issues)
- [Author](https://github.com/scobru)
