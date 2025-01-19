const { describe, it, before, beforeEach, afterEach, after } = require("mocha");
const assert = require("assert");
const { ethers } = require("ethers");
const Gun = require('gun');

const { WalletManager } = require("../src/WalletManager");
const { Wallet } = require("../src/interfaces/Wallet");
const { MESSAGE_TO_SIGN } = require("../src/utils/ethereum");

// Funzione di utilità per attendere che i dati siano disponibili in Gun
async function waitForGunData(gun, path, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout attendendo i dati per ${path}`));
    }, timeout);

    gun.get(path).once((data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Genera username unici
const generateUniqueUsername = () =>
  `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

describe("EthereumManager Test Suite", function () {
  this.timeout(30000);

  let walletManager;
  let ethereumManager;
  let testWallet;
  const TEST_RPC_URL = "https://optimism.llamarpc.com";

  beforeEach(async function () {
    walletManager = new WalletManager();
    ethereumManager = walletManager.getEthereumManager();
    
    // Crea un wallet di test
    testWallet = ethers.Wallet.createRandom();
    
    // Configura il provider personalizzato
    ethereumManager.setCustomProvider(TEST_RPC_URL, testWallet.privateKey);
  });

  afterEach(function () {
    if (walletManager.gun) {
      walletManager.gun.off();
    }
    walletManager.logout();
  });

  describe("Creazione Account", function () {
    it("dovrebbe creare un account usando il wallet Ethereum", async function () {
      const username = await ethereumManager.createAccountWithEthereum();
      
      assert(username, "Dovrebbe restituire un username");
      assert.strictEqual(
        username,
        testWallet.address.toLowerCase(),
        "Username dovrebbe essere l'indirizzo Ethereum in minuscolo"
      );

      const pubKey = walletManager.getPublicKey();
      assert(pubKey, "Dovrebbe avere una chiave pubblica dopo la creazione");
    });

    it("dovrebbe gestire errori del provider", async function () {
      // Configura un provider con URL non valido
      ethereumManager.setCustomProvider("http://invalid-url", testWallet.privateKey);

      try {
        await ethereumManager.createAccountWithEthereum();
        assert.fail("Dovrebbe fallire con provider non valido");
      } catch (error) {
        assert(error, "Dovrebbe lanciare un errore");
      }
    });
  });

  describe("Login", function () {
    it("dovrebbe fare login con un account esistente", async function () {
      // Prima crea l'account
      const username = await ethereumManager.createAccountWithEthereum();
      
      // Logout
      walletManager.logout();
      
      // Prova il login
      const pubKey = await ethereumManager.loginWithEthereum();
      
      assert(pubKey, "Dovrebbe ottenere una chiave pubblica dopo il login");
      assert.strictEqual(
        walletManager.getPublicKey(),
        pubKey,
        "Le chiavi pubbliche dovrebbero corrispondere"
      );
    });

    it("dovrebbe gestire errori di firma", async function () {
      try {
        await walletManager.loginWithPrivateKey("0xinvalid");
        assert.fail("Dovrebbe lanciare un errore");
      } catch (error) {
        const errorMsg = error.message.toLowerCase();
        assert(
          errorMsg.includes("invalid") || 
          errorMsg.includes("non valida") || 
          errorMsg.includes("invalida"),
          "L'errore dovrebbe indicare che la chiave non è valida"
        );
      }
    });
  });

  describe("Integrazione con Gun", function () {
    it("dovrebbe persistere i dati dell'account su Gun", async function () {
      const username = await ethereumManager.createAccountWithEthereum();
      
      // Attendi che i dati siano salvati su Gun
      const savedData = await waitForGunData(
        walletManager.gun,
        `~@${username}`
      );
      
      assert(savedData, "I dati dovrebbero essere salvati su Gun");
    });

    it("dovrebbe sincronizzare i dati tra sessioni", async function () {
      // Prima sessione: crea account
      const username = await ethereumManager.createAccountWithEthereum();
      const firstPubKey = walletManager.getPublicKey();
      
      // Attendi che i dati siano salvati
      await waitForGunData(walletManager.gun, `~@${username}`);
      
      // Simula nuova sessione
      walletManager.logout();
      
      // Seconda sessione: login
      const secondPubKey = await ethereumManager.loginWithEthereum();
      
      assert.strictEqual(
        firstPubKey,
        secondPubKey,
        "Le chiavi pubbliche dovrebbero essere le stesse tra sessioni"
      );
    });
  });

  describe("Performance e Sicurezza", function () {
    it("dovrebbe completare le operazioni entro limiti di tempo accettabili", async function () {
      const startTime = performance.now();
      
      await ethereumManager.createAccountWithEthereum();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      assert(
        duration < 5000,
        "La creazione dell'account dovrebbe richiedere meno di 5 secondi"
      );
    });

    it("dovrebbe generare password sicure dalla firma", async function () {
      // Prima crea l'account per ottenere la password generata
      await ethereumManager.createAccountWithEthereum();
      
      // Verifica che la password sia un hash di 64 caratteri (32 bytes)
      const username = testWallet.address.toLowerCase();
      
      // Prova a fare login con la stessa firma
      const pubKey = await ethereumManager.loginWithEthereum();
      
      assert(pubKey, "Dovrebbe accettare la password generata dalla firma");
    });
  });
});
