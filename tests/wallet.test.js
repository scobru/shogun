const { describe, it, beforeEach, afterEach } = require("mocha");
const assert = require("assert");
const { WalletManager } = require("../src/WalletManager");
const { Wallet } = require("../src/interfaces/Wallet");

// Simula localStorage per Node.js
if (typeof localStorage === 'undefined' || localStorage === null) {
  const LocalStorage = require('node-localstorage').LocalStorage;
  global.localStorage = new LocalStorage('./scratch');
}

function generateRandomAlias() {
  return `testuser_${Math.random().toString(36).substring(2)}`;
}

describe("WalletManager Data Management", function() {
  this.timeout(30000);
  let walletManager;
  let testAlias;
  let testWallet;

  beforeEach(async function() {
    walletManager = new WalletManager();
    testAlias = generateRandomAlias();
    // Crea e autentica un utente di test
    await walletManager.createAccount(testAlias, "password123");
    await walletManager.login(testAlias, "password123"); // Assicurati che l'utente sia loggato
    assert(walletManager.user.is, "L'utente deve essere autenticato dopo il login");
    testWallet = new Wallet("0xTestPublicKey", "testEntropy");
  });

  afterEach(function() {
    walletManager.logout();
    localStorage.clear();
  });

  describe("Local Storage", function() {
    it("dovrebbe salvare e recuperare un wallet localmente", async function() {
      await walletManager.saveWalletLocally(testWallet, testAlias);
      const retrieved = await walletManager.retrieveWalletLocally(testAlias);
      
      assert(retrieved, "Il wallet dovrebbe essere recuperato");
      assert.strictEqual(retrieved.publicKey, testWallet.publicKey);
      assert.strictEqual(retrieved.entropy, testWallet.entropy);
    });

    it("dovrebbe verificare correttamente i dati locali", async function() {
      await walletManager.saveWalletLocally(testWallet, testAlias);
      await walletManager.getStealthChain().saveStealthKeysLocally(testAlias, {
        spendingKey: "test",
        viewingKey: "test"
      });

      const status = await walletManager.checkLocalData(testAlias);
      assert(status.hasWallet, "Dovrebbe avere un wallet");
      assert(status.hasStealthKeys, "Dovrebbe avere chiavi stealth");
    });

    it("dovrebbe pulire correttamente i dati locali", async function() {
      await walletManager.saveWalletLocally(testWallet, testAlias);
      await walletManager.clearLocalData(testAlias);
      
      const status = await walletManager.checkLocalData(testAlias);
      assert(!status.hasWallet, "Non dovrebbe avere un wallet");
      assert(!status.hasStealthKeys, "Non dovrebbe avere chiavi stealth");
    });
  });

  describe("Gun KeyPair Export/Import", function() {
    it("dovrebbe esportare e importare un keypair di Gun", async function() {
      // Riautentica l'utente per sicurezza
      await walletManager.login(testAlias, "password123");
      assert(walletManager.user.is, "L'utente dovrebbe essere autenticato");
      
      const exported = await walletManager.exportGunKeyPair();
      // Salva il keypair corrente
      const originalPubKey = walletManager.getPublicKey();
      
      // Re-importa senza logout
      const importedPubKey = await walletManager.importGunKeyPair(exported);
      assert(importedPubKey, "Dovrebbe restituire una chiave pubblica");
      assert.strictEqual(importedPubKey, originalPubKey);
    });

    it("dovrebbe gestire keypair non validi", async function() {
      try {
        await walletManager.importGunKeyPair('{"invalid":"data"}');
        assert.fail("Dovrebbe lanciare un errore");
      } catch (error) {
        assert(error.message.includes("non valida"));
      }
    });
  });

  describe("Complete Data Export/Import", function() {
    it("dovrebbe esportare e importare tutti i dati", async function() {
      // Riautentica l'utente per sicurezza
      await walletManager.login(testAlias, "password123");
      assert(walletManager.user.is, "L'utente dovrebbe essere autenticato");
      
      // Setup: salva alcuni dati
      await walletManager.saveWalletLocally(testWallet, testAlias);
      await walletManager.getStealthChain().saveStealthKeysLocally(testAlias, {
        spendingKey: "test",
        viewingKey: "test"
      });

      // Esporta
      const exported = await walletManager.exportAllData(testAlias);
      
      // Pulisci i dati locali ma mantieni l'autenticazione
      await walletManager.clearLocalData(testAlias);

      // Importa nella stessa sessione
      await walletManager.importAllData(exported, testAlias);
      
      // Verifica
      const status = await walletManager.checkLocalData(testAlias);
      assert(status.hasWallet, "Dovrebbe avere un wallet dopo l'import");
      assert(status.hasStealthKeys, "Dovrebbe avere chiavi stealth dopo l'import");
    });

    it("dovrebbe gestire dati di export non validi", async function() {
      try {
        await walletManager.importAllData('{"invalid":"data"}', testAlias);
        assert.fail("Dovrebbe lanciare un errore");
      } catch (error) {
        assert(error.message.includes("non valido"));
      }
    });
  });
}); 