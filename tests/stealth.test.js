const { describe, it, beforeEach, afterEach } = require("mocha");
const assert = require("assert");
const { WalletManager } = require("../src/WalletManager");

// Genera username unici
const generateUniqueUsername = () =>
  `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

describe("StealthChain Test Suite", function () {
  let walletManager;
  let stealthChain;

  beforeEach(async () => {
    walletManager = new WalletManager();
    stealthChain = walletManager.getStealthChain();
  });

  afterEach(() => {
    if (walletManager.gun) {
      walletManager.gun.off();
    }
  });

  it("dovrebbe generare chiavi stealth valide", async function() {
    this.timeout(10000);
    
    try {
      // Setup account
      const alias = generateUniqueUsername();
      await walletManager.createAccount(alias, "password");
      
      // Genera chiavi
      const stealthKeys = await stealthChain.generateStealthKeys();
      assert(stealthKeys?.stealthKeyPair?.pub, "Dovrebbe avere una chiave pubblica");
      assert(stealthKeys?.stealthKeyPair?.priv, "Dovrebbe avere una chiave privata");
      assert(stealthKeys?.stealthKeyPair?.epub, "Dovrebbe avere una chiave epub");
      assert(stealthKeys?.stealthKeyPair?.epriv, "Dovrebbe avere una chiave epriv");
    } catch (error) {
      console.error("❌ Errore nel test di generazione:", error);
      throw error;
    }
  });

  it("dovrebbe salvare e recuperare chiavi stealth", async function() {
    this.timeout(10000);
    
    try {
      // Setup
      const alias = generateUniqueUsername();
      await walletManager.createAccount(alias, "password");
      const publicKey = walletManager.getPublicKey();
      
      // Genera e salva
      const stealthKeys = await stealthChain.generateStealthKeys();
      await stealthChain.saveStealthKeys(stealthKeys);
      
      // Attendi sincronizzazione
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Recupera e verifica
      const retrievedKeys = await stealthChain.retrieveStealthKeys(publicKey);
      assert(retrievedKeys, "Dovrebbe recuperare le chiavi");
      assert.strictEqual(
        retrievedKeys.stealthKeyPair.epub,
        stealthKeys.stealthKeyPair.epub,
        "Le chiavi epub dovrebbero corrispondere"
      );
    } catch (error) {
      console.error("❌ Errore nel test di salvataggio/recupero:", error);
      throw error;
    }
  });

  it("dovrebbe gestire errori con chiavi non valide", async function() {
    try {
      await stealthChain.generateStealthAddress("invalid_key");
      assert.fail("Dovrebbe lanciare un errore");
    } catch (error) {
      assert(error.message.includes("non valid") || 
             error.message.includes("conversione") || 
             error.message.includes("Impossibile generare il segreto condiviso"));
    }
  });
}); 