const { describe, it, beforeEach, afterEach } = require("mocha");
const assert = require("assert");
const { WalletManager } = require("../src/WalletManager");
const { Wallet } = require("../src/interfaces/Wallet");

// Simulate localStorage for Node.js
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
    // Create and authenticate a test user
    await walletManager.createAccount(testAlias, "password123");
    await walletManager.login(testAlias, "password123"); // Make sure user is logged in
    assert(walletManager.user.is, "User must be authenticated after login");
    testWallet = new Wallet("0xTestPublicKey", "testEntropy");
  });

  afterEach(function() {
    walletManager.logout();
    localStorage.clear();
  });

  describe("Local Storage", function() {
    it("should save and retrieve a wallet locally", async function() {
      await walletManager.saveWalletLocally(testWallet, testAlias);
      const retrieved = await walletManager.retrieveWalletLocally(testAlias);
      
      assert(retrieved, "Wallet should be retrieved");
      assert.strictEqual(retrieved.publicKey, testWallet.publicKey);
      assert.strictEqual(retrieved.entropy, testWallet.entropy);
    });

    it("should correctly verify local data", async function() {
      await walletManager.saveWalletLocally(testWallet, testAlias);
      await walletManager.getStealthChain().saveStealthKeysLocally(testAlias, {
        spendingKey: "test",
        viewingKey: "test"
      });

      const status = await walletManager.checkLocalData(testAlias);
      assert(status.hasWallet, "Should have a wallet");
      assert(status.hasStealthKeys, "Should have stealth keys");
    });

    it("should properly clean local data", async function() {
      await walletManager.saveWalletLocally(testWallet, testAlias);
      await walletManager.clearLocalData(testAlias);
      
      const status = await walletManager.checkLocalData(testAlias);
      assert(!status.hasWallet, "Should not have a wallet");
      assert(!status.hasStealthKeys, "Should not have stealth keys");
    });
  });

  describe("Gun KeyPair Export/Import", function() {
    it("should export and import a Gun keypair", async function() {
      // Re-authenticate user for safety
      await walletManager.login(testAlias, "password123");
      assert(walletManager.user.is, "User should be authenticated");
      
      const exported = await walletManager.exportGunKeyPair();
      // Save current keypair
      const originalPubKey = walletManager.getPublicKey();
      
      // Re-import without logout
      const importedPubKey = await walletManager.importGunKeyPair(exported);
      assert(importedPubKey, "Should return a public key");
      assert.strictEqual(importedPubKey, originalPubKey);
    });

    it("should handle invalid keypairs", async function() {
      try {
        await walletManager.importGunKeyPair('{"invalid":"data"}');
        assert.fail("Should throw an error");
      } catch (error) {
        assert(error.message.includes("Error importing key pair"), "Error message should mention importing key pair");
      }
    });
  });

  describe("Complete Data Export/Import", function() {
    it("should export and import all data", async function() {
      // Re-authenticate user for safety
      await walletManager.login(testAlias, "password123");
      assert(walletManager.user.is, "User should be authenticated");
      
      // Setup: save some data
      await walletManager.saveWalletLocally(testWallet, testAlias);
      await walletManager.getStealthChain().saveStealthKeysLocally(testAlias, {
        spendingKey: "test",
        viewingKey: "test"
      });

      // Export
      const exported = await walletManager.exportAllData(testAlias);
      
      // Clean local data but maintain authentication
      await walletManager.clearLocalData(testAlias);

      // Import in same session
      await walletManager.importAllData(exported, testAlias);
      
      // Verify
      const status = await walletManager.checkLocalData(testAlias);
      assert(status.hasWallet, "Should have a wallet after import");
      assert(status.hasStealthKeys, "Should have stealth keys after import");
    });

    it("should handle invalid export data", async function() {
      try {
        await walletManager.importAllData('{"invalid":"data"}', testAlias);
        assert.fail("Should throw an error");
      } catch (error) {
        assert(error.message.includes("Error importing data"), "Error message should mention importing data");
      }
    });
  });

  describe("Wallet Creation", function() {
    it("should create a wallet object from Gun keypair", async function() {
      // Re-authenticate user for safety
      await walletManager.login(testAlias, "password123");
      const gunKeyPair = walletManager.getCurrentUserKeyPair();
      
      const result = await WalletManager.createWalletObj(gunKeyPair);
      
      assert(result.walletObj instanceof Wallet, "Should return a Wallet instance");
      assert(result.entropy, "Should have entropy");
      assert(result.walletObj.publicKey.startsWith("0x"), "Public key should start with 0x");
      assert(result.walletObj.entropy === result.entropy, "Entropy should match");
    });

    it("should create wallet from salt", async function() {
      await walletManager.login(testAlias, "password123");
      const gunKeyPair = walletManager.getCurrentUserKeyPair();
      const testSalt = "test_salt_123";
      
      const wallet = await WalletManager.createWalletFromSalt(gunKeyPair, testSalt);
      
      assert(wallet instanceof Wallet, "Should return a Wallet instance");
      assert(wallet.publicKey.startsWith("0x"), "Public key should start with 0x");
    });

    it("should fail wallet creation with invalid Gun keypair", async function() {
      const invalidKeyPair = { pub: null };
      try {
        await WalletManager.createWalletObj(invalidKeyPair);
        assert.fail("Should throw an error");
      } catch (error) {
        assert(error.message.includes("Missing public key"));
      }
    });

    it("should create different wallets with different salts", async function() {
      await walletManager.login(testAlias, "password123");
      const gunKeyPair = walletManager.getCurrentUserKeyPair();
      
      const wallet1 = await WalletManager.createWalletFromSalt(gunKeyPair, "salt1");
      const wallet2 = await WalletManager.createWalletFromSalt(gunKeyPair, "salt2");
      
      assert.notStrictEqual(wallet1.publicKey, wallet2.publicKey, "Wallets should have different public keys");
    });
  });
}); 