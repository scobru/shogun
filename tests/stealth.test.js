const { describe, it, beforeEach, afterEach } = require("mocha");
const assert = require("assert");
const { WalletManager } = require("../src/WalletManager");
const { StealthChain } = require("../src/StealthChain");

// Genera username unici
const generateUniqueUsername = () =>
  `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

describe("StealthChain Test Suite", function () {
  this.timeout(90000);
  
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
    try {
      const stealthKeyPair = await stealthChain.generateStealthKeys();
      assert(stealthKeyPair && stealthKeyPair.stealthKeyPair, "Il keyPair dovrebbe esistere");
      assert(stealthKeyPair.stealthKeyPair.pub, "Dovrebbe contenere la chiave pubblica");
      assert(stealthKeyPair.stealthKeyPair.priv, "Dovrebbe contenere la chiave privata");
      assert(stealthKeyPair.stealthKeyPair.epub, "Dovrebbe contenere la chiave pubblica effimera");
      assert(stealthKeyPair.stealthKeyPair.epriv, "Dovrebbe contenere la chiave privata effimera");
    } catch (error) {
      assert.fail(`Errore inatteso: ${error.message}`);
    }
  });

  it("dovrebbe salvare e recuperare chiavi stealth", async function() {
    try {
      // Genera le chiavi
      const stealthKeyPair = await stealthChain.generateStealthKeys();
      
      // Verifica che le chiavi siano state generate correttamente
      assert(stealthKeyPair && stealthKeyPair.stealthKeyPair, "Le chiavi dovrebbero essere generate");
      
      // Salva le chiavi
      await stealthChain.saveStealthKeys(stealthKeyPair.stealthKeyPair);
      
      // Aspetta un momento per assicurarsi che il salvataggio sia completato
      await new Promise(resolve => setTimeout(resolve, 8000)); // Aumentato a 8 secondi
      
      // Recupera le chiavi
      const retrievedKeys = await stealthChain.retrieveStealthKeysFromUser();
      
      // Verifica che le chiavi siano state recuperate correttamente
      assert(retrievedKeys, "Le chiavi dovrebbero essere recuperate");
      assert(retrievedKeys.stealthKeyPair, "Dovrebbe contenere stealthKeyPair");
      
      // Verifica ogni campo delle chiavi separatamente
      const expected = stealthKeyPair.stealthKeyPair;
      const actual = retrievedKeys.stealthKeyPair;
      assert.strictEqual(actual.pub, expected.pub, "La chiave pubblica dovrebbe corrispondere");
      assert.strictEqual(actual.priv, expected.priv, "La chiave privata dovrebbe corrispondere");
      assert.strictEqual(actual.epub, expected.epub, "La chiave pubblica effimera dovrebbe corrispondere");
      assert.strictEqual(actual.epriv, expected.epriv, "La chiave privata effimera dovrebbe corrispondere");

      // Verifica che la chiave pubblica effimera sia stata salvata nel registro pubblico
      const publicKey = walletManager.getGun().user()._.sea.pub;
      const pubStealthKey = await stealthChain.retrieveStealthKeysFromRegistry(publicKey);
      assert(pubStealthKey, "La chiave pubblica effimera dovrebbe essere nel registro");
      assert.strictEqual(pubStealthKey, expected.epub, "La chiave pubblica effimera dovrebbe corrispondere");
    } catch (error) {
      assert.fail(`Errore nel salvataggio/recupero delle chiavi: ${error.message}`);
    }
  });

  it("dovrebbe gestire errori con chiavi non valide", async function() {
    try {
      await stealthChain.generateStealthAddress("invalid_pub_key");
      assert.fail("Dovrebbe lanciare un errore");
    } catch (error) {
      assert(error.message.includes("Chiavi non valide"), 
             "L'errore dovrebbe indicare un problema con le chiavi");
    }
  });

  it("dovrebbe permettere al destinatario di recuperare l'indirizzo stealth", async function() {
    try {
      // Genera e salva le chiavi per il destinatario
      const recipientKeys = await stealthChain.generateStealthKeys();
      await stealthChain.saveStealthKeys(recipientKeys.stealthKeyPair);
      
      // Aspetta un momento per assicurarsi che il salvataggio sia completato
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Ottieni la chiave pubblica del destinatario
      const publicKey = walletManager.getGun().user()._.sea.pub;
      
      // Verifica che la chiave pubblica effimera sia stata salvata
      const pubStealthKey = await stealthChain.retrieveStealthKeysFromRegistry(publicKey);
      assert(pubStealthKey, "La chiave pubblica effimera dovrebbe essere nel registro");

      // Genera un indirizzo stealth usando la chiave pubblica del destinatario
      const result = await stealthChain.generateStealthAddress(publicKey);

      assert(result.stealthAddress, "Dovrebbe generare un indirizzo stealth");
      assert(result.ephemeralPublicKey, "Dovrebbe generare una chiave pubblica effimera");
      assert.strictEqual(result.recipientPublicKey, publicKey, "Dovrebbe includere la chiave pubblica del destinatario");

      // Il destinatario recupera l'indirizzo stealth
      const recoveredWallet = await stealthChain.openStealthAddress(
        result.stealthAddress,
        result.ephemeralPublicKey
      );

      assert(recoveredWallet.address, "Dovrebbe recuperare un indirizzo");
      assert(recoveredWallet.privateKey, "Dovrebbe recuperare una chiave privata");
      assert.strictEqual(
        recoveredWallet.address.toLowerCase(),
        result.stealthAddress.toLowerCase(),
        "L'indirizzo recuperato dovrebbe corrispondere"
      );
    } catch (error) {
      assert.fail(`Errore nel test dell'indirizzo stealth: ${error.message}`);
    }
  });
}); 