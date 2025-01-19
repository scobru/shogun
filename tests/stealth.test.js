const { describe, it, beforeEach, afterEach } = require("mocha");
const assert = require("assert");
const { WalletManager } = require("../src/WalletManager");
const { StealthChain } = require("../src/StealthChain");

// Genera username unici
const generateUniqueUsername = () =>
  `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

describe("StealthChain Test Suite", function () {
  this.timeout(30000);
  
  let walletManager;
  let stealthChain;
  
  beforeEach(async function() {
    walletManager = new WalletManager();
    stealthChain = walletManager.getStealthChain();
    const alias = "test_" + Math.random().toString(36).substring(7);
    await walletManager.createAccount(alias, "password123!");
  });

  afterEach(function() {
    if (walletManager.getGun()) {
      walletManager.getGun().off();
    }
  });

  it("dovrebbe generare chiavi stealth valide", async function() {
    const stealthKeyPair = await stealthChain.generateStealthKeys();
    assert(stealthKeyPair && stealthKeyPair.pub && stealthKeyPair.priv && stealthKeyPair.epub && stealthKeyPair.epriv, 
      "Il keyPair dovrebbe contenere tutte le chiavi necessarie");
  });

  it("dovrebbe salvare e recuperare chiavi stealth", async function() {
    // Genera le chiavi
    const stealthKeyPair = await stealthChain.generateStealthKeys();
    
    // Salva le chiavi
    await stealthChain.saveStealthKeys(stealthKeyPair);
    
    // Recupera le chiavi
    const retrievedKeys = await stealthChain.retrieveStealthKeys();
    
    // Verifica che le chiavi siano state recuperate correttamente
    assert(retrievedKeys, "Le chiavi dovrebbero essere recuperate");
    assert(retrievedKeys.stealthKeyPair, "Dovrebbe contenere stealthKeyPair");
    assert.deepStrictEqual(retrievedKeys.stealthKeyPair, stealthKeyPair, "Le chiavi dovrebbero corrispondere esattamente");
  });

  it("dovrebbe gestire errori con chiavi non valide", async function() {
    try {
      await stealthChain.generateStealthAddress("invalid_pub_key", "invalid_epub_key");
      assert.fail("Dovrebbe lanciare un errore");
    } catch (error) {
      assert(error.message.includes("Chiavi non valide"), "L'errore dovrebbe indicare che le chiavi sono invalide");
    }
  });

  it("dovrebbe permettere al destinatario di recuperare l'indirizzo stealth", async function() {
    // Genera e salva le chiavi per il destinatario
    const recipientKeys = await stealthChain.generateStealthKeys();
    await stealthChain.saveStealthKeys(recipientKeys);

    // Genera un indirizzo stealth usando le chiavi pubbliche del destinatario
    const result = await stealthChain.generateStealthAddress(
      recipientKeys.pub,
      recipientKeys.epub
    );

    assert(result.stealthAddress, "Dovrebbe generare un indirizzo stealth");
    assert(result.ephemeralPublicKey, "Dovrebbe generare una chiave pubblica effimera");
    assert(result.encryptedWallet, "Dovrebbe generare un wallet cifrato");

    // Verifica che le chiavi siano nel formato corretto
    assert(recipientKeys.epriv, "Dovrebbe avere una chiave privata di visualizzazione");
    assert(recipientKeys.epub, "Dovrebbe avere una chiave pubblica di visualizzazione");

    // Il destinatario recupera l'indirizzo stealth
    const recoveredWallet = await stealthChain.openStealthAddress(
      result.stealthAddress,
      result.ephemeralPublicKey,
      result.encryptedWallet
    );

    assert(recoveredWallet.address, "Dovrebbe recuperare un indirizzo");
    assert.strictEqual(
      recoveredWallet.address.toLowerCase(),
      result.stealthAddress.toLowerCase(),
      "L'indirizzo recuperato dovrebbe corrispondere"
    );
  });
}); 