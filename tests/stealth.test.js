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
      // Prova a generare un indirizzo stealth con chiavi non valide
      await stealthChain.generateStealthAddress(
        "invalid_pub_key",
        "invalid_epub_key"
      );
      assert.fail("Dovrebbe lanciare un errore");
    } catch (error) {
      assert(error instanceof Error, "Dovrebbe lanciare un errore");
      assert(error.message.includes("Impossibile generare il segreto condiviso") ||
             error.message.includes("invalid") ||
             error.message.includes("Invalid"),
             "L'errore dovrebbe indicare che le chiavi sono invalide");
    }
  });

  it("dovrebbe permettere al destinatario di recuperare l'indirizzo stealth", async function() {
    this.timeout(15000);
    
    try {
      // Setup mittente
      const senderAlias = generateUniqueUsername();
      await walletManager.createAccount(senderAlias, "password");
      
      // Genera e salva chiavi stealth del mittente
      const senderKeys = await stealthChain.generateStealthKeys();
      await stealthChain.saveStealthKeys(senderKeys);
      
      // Attendi sincronizzazione
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Setup destinatario
      const recipientWalletManager = new WalletManager();
      const recipientStealthChain = recipientWalletManager.getStealthChain();
      
      const recipientAlias = generateUniqueUsername();
      await recipientWalletManager.createAccount(recipientAlias, "password");
      
      // Genera e salva chiavi stealth del destinatario
      const recipientKeys = await recipientStealthChain.generateStealthKeys();
      await recipientStealthChain.saveStealthKeys(recipientKeys);
      
      // Attendi sincronizzazione
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verifica che le chiavi del destinatario siano valide
      assert(recipientKeys.stealthKeyPair.pub, "Dovrebbe avere una chiave pubblica");
      assert(recipientKeys.stealthKeyPair.epub, "Dovrebbe avere una chiave epub");
      
      // Il mittente genera un indirizzo stealth per il destinatario
      const result = await stealthChain.generateStealthAddress(
        recipientKeys.stealthKeyPair.pub,
        recipientKeys.stealthKeyPair.epub
      );
      
      assert(result.stealthAddress, "Dovrebbe generare un indirizzo stealth");
      assert(result.ephemeralPublicKey, "Dovrebbe generare una chiave pubblica effimera");
      assert(result.encryptedWallet, "Dovrebbe generare un wallet cifrato");
      
      console.log("📝 Dati generati:", {
        stealthAddress: result.stealthAddress,
        ephemeralPublicKey: result.ephemeralPublicKey,
        encryptedWallet: result.encryptedWallet?.substring(0, 50) + "..."
      });
      
      // Il destinatario recupera l'indirizzo stealth
      const recoveredWallet = await recipientStealthChain.openStealthAddress(
        result.stealthAddress,
        result.encryptedWallet,
        result.ephemeralPublicKey
      );
      
      // Verifica che l'indirizzo recuperato corrisponda
      assert(recoveredWallet, "Dovrebbe recuperare il wallet");
      assert(recoveredWallet.address, "Il wallet dovrebbe avere un indirizzo");
      assert.strictEqual(
        recoveredWallet.address.toLowerCase(),
        result.stealthAddress.toLowerCase(),
        "L'indirizzo recuperato dovrebbe corrispondere all'indirizzo stealth originale"
      );
      
      // Cleanup
      recipientWalletManager.gun.off();
      
    } catch (error) {
      console.error("❌ Errore nel test di recupero stealth:", error);
      throw error;
    }
  });
}); 