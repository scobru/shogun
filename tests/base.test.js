const { describe, it, before, beforeEach, afterEach } = require("mocha");
const assert = require("assert");
const SEA = require("gun/sea");
const Gun = require("gun");
const { ethers } = require("ethers");

const { WalletManager } = require("../src/WalletManager");
const { StealthChain } = require("../src/Stealth");

// Funzione di utilità per attendere che i dati siano disponibili in Gun
const waitForGunData = async (gun, path, expectedData = null, timeout = 30000) => {
  console.log(`🔄 Iniziata attesa dati per ${path}`);
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.log(`⚠️ TIMEOUT per ${path}`);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      ref.off(); // Rimuove tutti i listener
      reject(new Error(`Timeout attendendo i dati per il path: ${path}`));
    }, timeout);

    let resolved = false;
    let unsubscribe = null;
    let processedData = new Set();

    const processData = async (data) => {
      try {
        // Crea una chiave unica per questi dati
        const dataKey = JSON.stringify(data);

        // Se abbiamo già processato questi dati esatti, ignoriamo
        if (processedData.has(dataKey)) {
          return;
        }
        processedData.add(dataKey);
        
        console.log(`📥 Ricevuti dati per ${path}:`, data);
        
        if (!data) return;

        if (expectedData) {
          if (typeof expectedData === 'function') {
            const result = await expectedData(data);
            if (!result) return;
          } else {
            const expected = typeof expectedData === 'string' ? expectedData : JSON.stringify(expectedData);
            const actual = typeof data === 'string' ? data : JSON.stringify(data);
            if (expected !== actual) return;
          }
        }

        if (!resolved) {
          console.log(`✅ Dati validi trovati per ${path}`);
          resolved = true;
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
          ref.off(); // Rimuove tutti i listener
          clearTimeout(timeoutId);
          resolve(data);
        }
      } catch (error) {
        console.error(`❌ Errore durante l'elaborazione dei dati per ${path}:`, error);
        if (!resolved) {
          resolved = true;
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
          ref.off(); // Rimuove tutti i listener
          clearTimeout(timeoutId);
          reject(error);
        }
      }
    };

    const ref = gun.get(path);
    ref.on(processData);
    ref.once(processData);
  });
};

// Genera username unici
const generateUniqueUsername = () =>
  `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

describe("WalletManager e StealthChain Test Suite", function () {
  this.timeout(10000);

  let walletManager;
  let stealthChain;
  let receiverSpendingPrivateKey;

  // Inizializza WalletManager una sola volta per tutti i test
  before(function () {
    walletManager = new WalletManager();
  });

  beforeEach(async function () {
    const wallet = ethers.Wallet.createRandom();
    receiverSpendingPrivateKey = wallet.privateKey;
    stealthChain = new StealthChain(receiverSpendingPrivateKey);

    // Mock localStorage
    global.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null
    };

    // Logout per assicurarsi che ogni test parta da uno stato pulito
    walletManager.logout();
  });

  describe("WalletManager", function () {
    describe("Gestione Account", function () {
      it("dovrebbe creare un account e fare login", async function () {
        const username = generateUniqueUsername();
        
        // Creazione account
        await walletManager.createAccount(username, "password123");
        const pubKey = await walletManager.login(username, "password123");
        
        assert(pubKey, "Dovrebbe ottenere una chiave pubblica dopo il login");
        assert.strictEqual(pubKey, walletManager.getPublicKey(), "Le chiavi pubbliche dovrebbero corrispondere");
      });

      it("dovrebbe gestire errori di login", async function () {
        const username = generateUniqueUsername();
        
        try {
          await walletManager.login(username, "password123");
          assert.fail("Dovrebbe fallire con credenziali non valide");
        } catch (error) {
          assert(error, "Dovrebbe lanciare un errore");
        }
      });

      it("dovrebbe gestire il logout correttamente", async function () {
        const username = generateUniqueUsername();
        
        await walletManager.createAccount(username, "password123");
        await walletManager.login(username, "password123");
        
        walletManager.logout();
        assert.strictEqual(walletManager.getPublicKey(), null, "Dovrebbe rimuovere la chiave pubblica dopo il logout");
      });
    });

    describe("Gestione Wallet", function () {
      let username;

      beforeEach(async function () {
        username = generateUniqueUsername();
        await walletManager.createAccount(username, "password123");
        await walletManager.login(username, "password123");
      });

      it("dovrebbe creare e recuperare wallet", async function () {
        const gunKeyPair = walletManager.getCurrentUserKeyPair();
        const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);
        
        await walletManager.saveWalletLocally(walletObj, username);
        await walletManager.saveWalletToGun(walletObj, username);
        
        const retrievedWallet = await walletManager.retrieveWalletByAddress(username, walletObj.publicKey);
        
        assert(retrievedWallet, "Dovrebbe recuperare il wallet");
        assert.strictEqual(retrievedWallet.publicKey, walletObj.publicKey, "Gli indirizzi dovrebbero corrispondere");
      });

      it("dovrebbe gestire più wallet per utente", async function () {
        const gunKeyPair = walletManager.getCurrentUserKeyPair();
        
        // Crea due wallet
        const { walletObj: wallet1 } = await WalletManager.createWalletObj(gunKeyPair);
        const { walletObj: wallet2 } = await WalletManager.createWalletObj(gunKeyPair);
        
        // Salva entrambi
        await walletManager.saveWalletLocally(wallet1, username);
        await walletManager.saveWalletLocally(wallet2, username);
        
        // Recupera tutti i wallet
        const wallets = await walletManager.retrieveWallets(username);
        
        assert.strictEqual(wallets.length, 2, "Dovrebbe avere due wallet");
        assert(wallets.some(w => w.publicKey === wallet1.publicKey), "Dovrebbe contenere il primo wallet");
        assert(wallets.some(w => w.publicKey === wallet2.publicKey), "Dovrebbe contenere il secondo wallet");
      });
    });
  });

  describe("StealthChain", function () {
    describe("Generazione e Recupero Indirizzi Stealth", function () {
      it("dovrebbe generare un indirizzo stealth valido", async function () {
        const receiverViewingKeyPair = await SEA.pair();
        
        const result = await stealthChain.generateStealthAddress(
          receiverViewingKeyPair.epriv,
          receiverSpendingPrivateKey
        );

        assert(result.stealthAddress.match(/^0x[a-fA-F0-9]{40}$/), "Dovrebbe generare un indirizzo valido");
        assert(result.ephemeralPublicKey, "Dovrebbe fornire una chiave pubblica effimera");
      });

      it("dovrebbe recuperare correttamente la chiave privata stealth", async function () {
        const receiverViewingKeyPair = await SEA.pair();
        
        const { stealthAddress, ephemeralPublicKey } = await stealthChain.generateStealthAddress(
          receiverViewingKeyPair.epriv,
          receiverSpendingPrivateKey
        );

        const recoveredWallet = await stealthChain.openStealthAddress(
          stealthAddress,
          ephemeralPublicKey,
          receiverViewingKeyPair,
          receiverSpendingPrivateKey
        );

        assert.strictEqual(
          recoveredWallet.address.toLowerCase(),
          stealthAddress.toLowerCase(),
          "Gli indirizzi dovrebbero corrispondere"
        );
      });

      it("dovrebbe generare indirizzi diversi per lo stesso destinatario", async function () {
        const receiverViewingKeyPair = await SEA.pair();
        
        const result1 = await stealthChain.generateStealthAddress(
          receiverViewingKeyPair.epriv,
          receiverSpendingPrivateKey
        );

        const result2 = await stealthChain.generateStealthAddress(
          receiverViewingKeyPair.epriv,
          receiverSpendingPrivateKey
        );

        assert.notStrictEqual(
          result1.stealthAddress,
          result2.stealthAddress,
          "Gli indirizzi dovrebbero essere diversi"
        );
      });

      it("dovrebbe fallire con chiavi errate", async function () {
        const correctViewingKeyPair = await SEA.pair();
        const wrongViewingKeyPair = await SEA.pair();
        
        const { stealthAddress, ephemeralPublicKey } = await stealthChain.generateStealthAddress(
          correctViewingKeyPair.epriv,
          receiverSpendingPrivateKey
        );

        try {
          await stealthChain.openStealthAddress(
            stealthAddress,
            ephemeralPublicKey,
            wrongViewingKeyPair,
            receiverSpendingPrivateKey
          );
          assert.fail("Dovrebbe fallire con chiavi errate");
        } catch (error) {
          assert(error.message.includes("non corrisponde"), "Dovrebbe indicare che l'indirizzo non corrisponde");
        }
      });
    });
  });
}); 