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
  this.timeout(30000);

  let walletManager;
  let stealthChain;
  let receiverSpendingPrivateKey;
  let localStorageData = {};

  // Inizializza WalletManager una sola volta per tutti i test
  before(function () {
    walletManager = new WalletManager();
  });

  // Cleanup dopo tutti i test
  after(function () {
    if (walletManager.gun) {
      walletManager.gun.off();
    }
  });

  beforeEach(async function () {
    // Ricrea una nuova istanza di WalletManager per ogni test
    walletManager = new WalletManager();
    
    const wallet = ethers.Wallet.createRandom();
    receiverSpendingPrivateKey = wallet.privateKey;
    stealthChain = new StealthChain();
    localStorageData = {}; // Reset localStorage mock data

    // Mock localStorage migliorato
    global.localStorage = {
      getItem: (key) => localStorageData[key] || null,
      setItem: (key, value) => {
        localStorageData[key] = value;
      },
      removeItem: (key) => {
        delete localStorageData[key];
      },
      clear: () => {
        localStorageData = {};
      },
      length: 0,
      key: () => null
    };

    // Assicurati che l'utente sia disconnesso
    walletManager.logout();
    
    // Attendi un po' per assicurarsi che Gun sia pronto
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(function () {
    // Cleanup dopo ogni test
    if (walletManager.gun) {
      walletManager.gun.off();
    }
    walletManager.logout();
  });

  describe("WalletManager", function () {
    describe("Gestione Account", function () {
      it("dovrebbe creare un account e fare login", async function () {
        const username = generateUniqueUsername();
        
        // Creazione account
        await walletManager.createAccount(username, "password123");
        
        // Attendi un po' per assicurarsi che la creazione sia completata
        await new Promise(resolve => setTimeout(resolve, 100));
        
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
        // Attendi un po' per assicurarsi che la creazione sia completata
        await new Promise(resolve => setTimeout(resolve, 100));
        
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
        // Attendi un po' per assicurarsi che la creazione sia completata
        await new Promise(resolve => setTimeout(resolve, 100));
        await walletManager.login(username, "password123");
      });

      it("dovrebbe creare e recuperare wallet", async function () {
        const gunKeyPair = walletManager.getCurrentUserKeyPair();
        const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);
        
        // Salva il wallet
        await walletManager.saveWalletToGun(walletObj, username);
        
        // Attendi che i dati siano salvati in Gun
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Recupera il wallet direttamente da Gun per verificare il salvataggio
        const savedData = await new Promise((resolve) => {
          walletManager.gun.get('wallets').get(username).once((data) => {
            resolve(data);
          });
        });
        
        assert(savedData, "I dati dovrebbero essere salvati in Gun");
        
        // Recupera il wallet usando il metodo della classe
        const retrievedWallet = await walletManager.retrieveWalletByAddress(username, walletObj.publicKey);
        
        assert(retrievedWallet, "Dovrebbe recuperare il wallet");
        assert.strictEqual(retrievedWallet.publicKey, walletObj.publicKey, "Gli indirizzi dovrebbero corrispondere");
      });

      it("dovrebbe gestire più wallet per utente", async function () {
        const gunKeyPair = walletManager.getCurrentUserKeyPair();
        
        // Crea due wallet
        const { walletObj: wallet1 } = await WalletManager.createWalletObj(gunKeyPair);
        const { walletObj: wallet2 } = await WalletManager.createWalletObj(gunKeyPair);
        
        // Salva entrambi i wallet
        await walletManager.saveWalletToGun(wallet1, username);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await walletManager.saveWalletToGun(wallet2, username);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verifica il salvataggio direttamente in Gun
        const savedData = await new Promise((resolve) => {
          const wallets = [];
          walletManager.gun.get('wallets').get(username).map().once((data, key) => {
            if (data && data.publicKey) {
              wallets.push(data);
            }
          });
          setTimeout(() => resolve(wallets), 1000);
        });
        
        assert(savedData.length >= 2, "Dovrebbero esserci almeno due wallet salvati");
        
        // Recupera i wallet usando il metodo della classe
        const wallets = await walletManager.retrieveWallets(username);
        
        // Verifica che ci siano almeno due wallet
        assert(wallets.length >= 2, "Dovrebbe avere almeno due wallet");
        
        // Verifica che entrambi i wallet siano presenti
        const hasWallet1 = wallets.some(w => w.publicKey === wallet1.publicKey);
        const hasWallet2 = wallets.some(w => w.publicKey === wallet2.publicKey);
        
        assert(hasWallet1, "Dovrebbe contenere il primo wallet");
        assert(hasWallet2, "Dovrebbe contenere il secondo wallet");
      });

      it("dovrebbe gestire la conversione delle chiavi private Gun in formato Ethereum", async function () {
        const gunKeyPair = walletManager.getCurrentUserKeyPair();
        const ethPrivateKey = await walletManager.convertToEthPk(gunKeyPair.epriv);
        
        assert(ethPrivateKey.startsWith("0x"), "La chiave dovrebbe iniziare con 0x");
        assert.strictEqual(ethPrivateKey.length, 66, "La chiave dovrebbe essere lunga 66 caratteri (0x + 64)");
      });

      it("dovrebbe gestire errori nella conversione delle chiavi private", async function () {
        try {
          await walletManager.convertToEthPk("chiave_non_valida");
          assert.fail("Dovrebbe fallire con una chiave non valida");
        } catch (error) {
          assert(error.message.includes("Impossibile convertire"), "Dovrebbe indicare un errore di conversione");
        }
      });
    });

    describe("Gestione Chiavi Stealth", function () {
      let username;
      let gunKeyPair;

      beforeEach(async function () {
        username = generateUniqueUsername();
        await walletManager.createAccount(username, "password123");
        // Attendi un po' per assicurarsi che la creazione sia completata
        await new Promise(resolve => setTimeout(resolve, 100));
        await walletManager.login(username, "password123");
        gunKeyPair = walletManager.getCurrentUserKeyPair();
      });

      it("dovrebbe salvare e recuperare le chiavi stealth da Gun", async function () {
        const stealthKeys = await walletManager.generateStealthKeys(gunKeyPair);
        
        await walletManager.saveStealthKeys(username, stealthKeys);
        
        // Attendi che i dati siano salvati in Gun
        await waitForGunData(walletManager.gun, `stealthKeys/${username}`, (data) => {
          return data && data.spendingKey === stealthKeys.spendingKey;
        });
        
        const retrievedKeys = await walletManager.retrieveStealthKeys(username);
        assert.deepStrictEqual(retrievedKeys, stealthKeys, "Le chiavi recuperate dovrebbero corrispondere");
      });

      it("dovrebbe salvare e recuperare le chiavi stealth da localStorage", async function () {
        const stealthKeys = await walletManager.generateStealthKeys(gunKeyPair);
        
        await walletManager.saveStealthKeysLocally(username, stealthKeys);
        const retrievedKeys = await walletManager.retrieveStealthKeysLocally(username);
        
        // Confronta le chiavi come oggetti JSON per evitare problemi di serializzazione
        const expectedKeys = JSON.parse(JSON.stringify(stealthKeys));
        const actualKeys = JSON.parse(JSON.stringify(retrievedKeys));
        assert.deepStrictEqual(actualKeys, expectedKeys, "Le chiavi recuperate dovrebbero corrispondere");
      });

      it("dovrebbe gestire errori nel recupero di chiavi stealth non esistenti", async function () {
        try {
          await walletManager.retrieveStealthKeys("utente_non_esistente");
          assert.fail("Dovrebbe fallire per un utente non esistente");
        } catch (error) {
          assert(error.message.includes("non trovate"), "Dovrebbe indicare che le chiavi non sono state trovate");
        }
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

    describe("Gestione Errori", function () {
      it("dovrebbe gestire chiavi pubbliche non valide nella generazione dell'indirizzo", async function () {
        try {
          await stealthChain.generateStealthAddress("", "");
          assert.fail("Dovrebbe fallire con chiavi non valide");
        } catch (error) {
          assert(error.message.includes("non valida"), "Dovrebbe indicare chiavi non valide");
        }
      });

      it("dovrebbe gestire errori nella derivazione della chiave condivisa", async function () {
        const receiverViewingKeyPair = await SEA.pair();
        
        try {
          await stealthChain.generateStealthAddress(
            undefined,
            receiverSpendingPrivateKey
          );
          assert.fail("Dovrebbe fallire con chiave undefined");
        } catch (error) {
          assert(error.message.includes("non valida"), "Dovrebbe indicare una chiave non valida");
        }
      });
    });
  });
}); 