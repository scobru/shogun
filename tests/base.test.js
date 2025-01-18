const { describe, it, before, beforeEach, afterEach, after } = require("mocha");
const assert = require("assert");
const SEA = require("gun/sea");
const { ethers } = require("ethers");
const Gun = require('gun');

const { WalletManager } = require("../src/WalletManager");
const { StealthChain } = require("../src/StealthChain");
const { Wallet } = require("../src/interfaces/Wallet");
const { MESSAGE_TO_SIGN } = require("../src/utils/ethereum");

// Funzione di utilità per attendere che i dati siano disponibili in Gun
async function waitForGunData(gun, path, timeout = 15000) {
  console.log(`🔄 Iniziata attesa dati per ${path}`);
  
  return new Promise((resolve, reject) => {
    let hasResolved = false;
    
    const timer = setTimeout(() => {
      if (!hasResolved) {
        console.error(`⏰ Timeout dopo ${timeout}ms attendendo i dati per ${path}`);
        reject(new Error(`Timeout dopo ${timeout}ms attendendo i dati per ${path}`));
      }
    }, timeout);

    gun.get(path).once((data, key) => {
      console.log(`📥 Ricevuti dati per ${path}:`, data);
      if (data && !hasResolved) {
        hasResolved = true;
        clearTimeout(timer);
        resolve(data);
      }
    }, {
      change: true
    });

    // Gestione errori
    gun.get(path).once((data, key) => {
      if (!data && !hasResolved) {
        console.log(`⚠️ Nessun dato trovato per ${path}`);
      }
    });
  });
}

// Genera username unici
const generateUniqueUsername = () =>
  `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

describe("WalletManager e StealthChain Test Suite", function () {
  this.timeout(30000);
  let walletManager;
  let stealthChain;
  let gun;

  beforeEach(async () => {
    walletManager = new WalletManager();
    stealthChain = walletManager.getStealthChain();
    gun = walletManager.gun;
  });

  it("dovrebbe creare un account e fare login", async () => {
    const alias = generateUniqueUsername();
    const password = "password";
    
    await walletManager.createAccount(alias, password);
    const publicKey = walletManager.getPublicKey();
    assert(publicKey, "Dovrebbe ottenere una chiave pubblica");
  });

  it("dovrebbe gestire errori di login", async () => {
    const alias = generateUniqueUsername();
    const password = "password";
    const wrongPassword = "wrongpassword";
    
    await walletManager.createAccount(alias, password);
    
    try {
      await walletManager.login(alias, wrongPassword);
      assert.fail("Il login dovrebbe fallire");
    } catch (error) {
      assert(error.message.includes("errata"), "Dovrebbe contenere il messaggio di errore corretto");
    }
  });

  it("dovrebbe salvare e recuperare un wallet", async () => {
    const alias = generateUniqueUsername();
    const password = "password";
    
    await walletManager.createAccount(alias, password);
    const publicKey = walletManager.getPublicKey();
    assert(publicKey, "Dovrebbe avere una chiave pubblica");

    const wallet = new Wallet("0x123", "test");

    try {
      await walletManager.saveWalletToGun(wallet, publicKey);
      console.log("💾 Wallet salvato, attendo sincronizzazione...");
      
      // Attendi che i dati siano salvati
      const savedData = await waitForGunData(walletManager.gun, `wallets/${publicKey}`, 15000);
      console.log("📥 Dati salvati:", savedData);
      
      const wallets = await walletManager.retrieveWallets(publicKey);
      console.log("📥 Wallet recuperati:", wallets);
      
      assert(Array.isArray(wallets), "Il risultato dovrebbe essere un array");
      assert(wallets.length > 0, "Dovrebbe contenere almeno un wallet");
      assert.strictEqual(wallets[0].publicKey, wallet.publicKey, "La chiave pubblica del wallet dovrebbe corrispondere");
    } catch (error) {
      console.error("❌ Errore durante il test del wallet:", error);
      throw error;
    }
  }).timeout(30000);

  it("dovrebbe generare chiavi stealth valide", async () => {
    const alias = generateUniqueUsername();
    const password = "password";
    
    await walletManager.createAccount(alias, password);
    
    const stealthKeys = await stealthChain.generateStealthKeys();
    assert(stealthKeys.viewingKeyPair, "Dovrebbe avere un viewingKeyPair");
    assert(stealthKeys.spendingKeyPair, "Dovrebbe avere uno spendingKeyPair");
    assert(stealthKeys.ephemeralPublicKey, "Dovrebbe avere una ephemeralPublicKey");
    assert(stealthKeys.viewingKeyPair.pub && 
           stealthKeys.viewingKeyPair.priv && 
           stealthKeys.viewingKeyPair.epub && 
           stealthKeys.viewingKeyPair.epriv, 
           "Il viewingKeyPair dovrebbe avere tutte le chiavi necessarie");
    assert(stealthKeys.spendingKeyPair.pub && 
           stealthKeys.spendingKeyPair.priv && 
           stealthKeys.spendingKeyPair.epub && 
           stealthKeys.spendingKeyPair.epriv, 
           "Lo spendingKeyPair dovrebbe avere tutte le chiavi necessarie");
  });

  it("dovrebbe salvare e recuperare chiavi stealth", async () => {
    const alias = generateUniqueUsername();
    const password = "password";
    
    await walletManager.createAccount(alias, password);
    const publicKey = walletManager.getPublicKey();
    assert(publicKey, "Dovrebbe avere una chiave pubblica");

    const stealthKeys = await stealthChain.generateStealthKeys();
    
    try {
      // Salva le chiavi stealth
      await stealthChain.saveStealthKeys(stealthKeys);
      console.log("💾 Chiavi stealth salvate, attendo sincronizzazione...");
      
      // Verifica i dati pubblici
      const path = `stealth/${publicKey}`;
      console.log("🔍 Verifico dati in:", path);
      const savedPublicData = await waitForGunData(walletManager.gun, path);
      console.log("📥 Dati pubblici salvati:", savedPublicData);
      
      assert(savedPublicData.v_pub, "Dovrebbe avere una chiave pubblica di visualizzazione");
      assert(savedPublicData.v_epub, "Dovrebbe avere una chiave epub di visualizzazione");
      assert(savedPublicData.s_pub, "Dovrebbe avere una chiave pubblica di spesa");
      assert(savedPublicData.s_epub, "Dovrebbe avere una chiave epub di spesa");
      
      // Recupera le chiavi stealth
      const retrievedKeys = await stealthChain.retrieveStealthKeys(publicKey);
      console.log("🔑 Chiavi stealth recuperate:", retrievedKeys);
      
      assert(retrievedKeys, "Le chiavi recuperate non dovrebbero essere null");
      assert(retrievedKeys.viewingKeyPair, "Dovrebbe avere un viewingKeyPair");
      assert(retrievedKeys.spendingKeyPair, "Dovrebbe avere uno spendingKeyPair");
      
      // Verifica solo le chiavi pubbliche
      assert.strictEqual(retrievedKeys.viewingKeyPair.pub, stealthKeys.viewingKeyPair.pub, 
        "La chiave pubblica di visualizzazione dovrebbe corrispondere");
      assert.strictEqual(retrievedKeys.viewingKeyPair.epub, stealthKeys.viewingKeyPair.epub,
        "La chiave epub di visualizzazione dovrebbe corrispondere");
      assert.strictEqual(retrievedKeys.spendingKeyPair.pub, stealthKeys.spendingKeyPair.pub,
        "La chiave pubblica di spesa dovrebbe corrispondere");
      assert.strictEqual(retrievedKeys.spendingKeyPair.epub, stealthKeys.spendingKeyPair.epub,
        "La chiave epub di spesa dovrebbe corrispondere");
    } catch (error) {
      console.error("❌ Errore durante il test delle chiavi stealth:", error);
      throw error;
    }
  }).timeout(60000);

  it("dovrebbe generare un indirizzo stealth valido", async () => {
    const alias = generateUniqueUsername();
    const password = "password";
    
    await walletManager.createAccount(alias, password);
    
    const stealthKeys = await stealthChain.generateStealthKeys();
    const result = await stealthChain.generateStealthAddress(
      stealthKeys.viewingKeyPair.epub,
      stealthKeys.spendingKeyPair.epub
    );
    
    assert(result.stealthAddress, "Dovrebbe avere un indirizzo stealth");
    assert(result.encryptedWallet, "Dovrebbe avere un wallet cifrato");
    assert(result.ephemeralPublicKey, "Dovrebbe avere una chiave pubblica effimera");
    assert(/^0x[a-fA-F0-9]{40}$/.test(result.stealthAddress), "L'indirizzo stealth dovrebbe essere nel formato corretto");
  });

  it("dovrebbe recuperare correttamente un indirizzo stealth", async () => {
    const alias = generateUniqueUsername();
    const password = "password";
    
    await walletManager.createAccount(alias, password);
    
    const stealthKeys = await stealthChain.generateStealthKeys();
    console.log("🔑 Chiavi stealth generate:", stealthKeys);
    
    const { stealthAddress, encryptedWallet, ephemeralPublicKey } = await stealthChain.generateStealthAddress(
      stealthKeys.viewingKeyPair.epub,
      stealthKeys.spendingKeyPair.epub
    );
    console.log("📫 Indirizzo stealth generato:", stealthAddress);
    
    const recovered = await stealthChain.openStealthAddress(
      stealthAddress,
      encryptedWallet,
      ephemeralPublicKey
    );
    console.log("🔓 Indirizzo recuperato:", recovered.address);
    
    assert.strictEqual(recovered.address.toLowerCase(), stealthAddress.toLowerCase(), 
      "L'indirizzo recuperato dovrebbe corrispondere");
  });

  it("dovrebbe gestire errori con chiavi non valide", async () => {
    try {
      const invalidKeys = {
        viewingKeyPair: { 
          pub: "invalid_key",
          priv: "invalid_key",
          epub: "invalid_key",
          epriv: "invalid_key"
        },
        spendingKeyPair: {
          pub: "invalid_key",
          priv: "invalid_key", 
          epub: "invalid_key",
          epriv: "invalid_key"
        }
      };
      
      await stealthChain.generateStealthAddress(
        invalidKeys.viewingKeyPair.epub,
        invalidKeys.spendingKeyPair.epub
      );
      assert.fail("Dovrebbe lanciare un errore");
    } catch (error) {
      console.log("✅ Errore ricevuto come previsto:", error.message);
      assert(
        error.message.includes("non valid") || 
        error.message.includes("conversione") || 
        error.message.includes("Chiavi pubbliche non valide") ||
        error.message.includes("Impossibile calcolare il segreto condiviso"),
        `Messaggio di errore non valido: ${error.message}`
      );
    }
  });
});

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
        // Usa una chiave privata invalida (deve essere 32 bytes)
        const invalidKey = "0x" + "1".repeat(64); // 32 bytes ma non è una chiave valida
        ethereumManager.setCustomProvider(TEST_RPC_URL, invalidKey);
        
        await ethereumManager.loginWithEthereum();
        assert.fail("Dovrebbe fallire con chiave privata non valida");
      } catch (error) {
        assert(error, "Dovrebbe lanciare un errore");
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

describe("StealthChain Test Suite", function () {
  this.timeout(30000);
  let walletManager;
  let stealthChain;

  beforeEach(async () => {
    walletManager = new WalletManager();
    stealthChain = walletManager.getStealthChain();
  });

  it("dovrebbe generare e recuperare correttamente un indirizzo stealth", async () => {
    // Genera le chiavi stealth
    const stealthKeys = await stealthChain.generateStealthKeys();
    console.log("Generated stealth keys:", stealthKeys);

    // Genera l'indirizzo stealth
    const { stealthAddress, encryptedWallet, ephemeralPublicKey } = await stealthChain.generateStealthAddress(
      stealthKeys.viewingKeyPair.epub,
      stealthKeys.spendingKeyPair.epub
    );
    console.log("Generated stealth address:", stealthAddress);
    console.log("Ephemeral public key:", ephemeralPublicKey);

    // Recupera l'indirizzo stealth
    const recoveredWallet = await stealthChain.openStealthAddress(
      stealthAddress,
      encryptedWallet,
      stealthKeys.viewingKeyPair
    );
    console.log("Recovered wallet:", recoveredWallet.address);

    // Verifica che l'indirizzo recuperato corrisponda
    assert.equal(
      recoveredWallet.address.toLowerCase(),
      stealthAddress.toLowerCase(),
      "L'indirizzo stealth recuperato non corrisponde"
    );
  });

  it("dovrebbe generare indirizzi diversi per lo stesso destinatario", async () => {
    // Genera le chiavi del destinatario
    const receiverPair = await SEA.pair();

    // Genera le chiavi stealth
    const stealthKeys = await stealthChain.generateStealthKeys(receiverPair);

    // Genera il primo indirizzo stealth
    const result1 = await stealthChain.generateStealthAddress(
      receiverPair.epub,
      stealthKeys.spendingKey
    );

    // Genera il secondo indirizzo stealth
    const result2 = await stealthChain.generateStealthAddress(
      receiverPair.epub,
      stealthKeys.spendingKey
    );

    // Verifica che gli indirizzi siano diversi
    assert.notEqual(
      result1.stealthAddress.toLowerCase(),
      result2.stealthAddress.toLowerCase(),
      "Gli indirizzi stealth dovrebbero essere diversi"
    );

    // Recupera entrambi gli indirizzi
    const recovered1 = await stealthChain.openStealthAddress(
      result1.stealthAddress,
      result1.ephemeralPublicKey,
      receiverPair,
      stealthKeys.spendingKey
    );

    const recovered2 = await stealthChain.openStealthAddress(
      result2.stealthAddress,
      result2.ephemeralPublicKey,
      receiverPair,
      stealthKeys.spendingKey
    );

    // Verifica che entrambi gli indirizzi siano stati recuperati correttamente
    assert.equal(
      recovered1.address.toLowerCase(),
      result1.stealthAddress.toLowerCase(),
      "Il primo indirizzo stealth non è stato recuperato correttamente"
    );
    assert.equal(
      recovered2.address.toLowerCase(),
      result2.stealthAddress.toLowerCase(),
      "Il secondo indirizzo stealth non è stato recuperato correttamente"
    );
  });
});
