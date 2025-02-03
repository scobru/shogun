const { describe, it, beforeEach, afterEach } = require("mocha");
const assert = require("assert");
const { WalletManager } = require("../src/Shogun");
const { Wallet } = require("ethers");

// Configurazione di test per Gun e APP_KEY_PAIR
const gunOptions = {
  peers: ['http://localhost:8765/gun']
};

const APP_KEY_PAIR = {
  pub: "test_pub_key",
  priv: "test_priv_key"
};

describe("WalletManager Data Management", function() {
  this.timeout(30000);
  let walletManager;
  let testAlias;
  let testPublicKey;
  let testWallet;

  beforeEach(async function() {
    walletManager = new WalletManager(gunOptions, APP_KEY_PAIR);
    testAlias = `testuser_${Math.random().toString(36).substring(2)}`;
    
    // Create and authenticate a test user
    await walletManager.createAccount(testAlias, "password123");
    await walletManager.login(testAlias, "password123");
    testPublicKey = walletManager.getPublicKey();
    
    // Create a test wallet using ethers
    testWallet = Wallet.createRandom();
    Object.defineProperty(testWallet, 'entropy', {
      value: "testEntropy",
      writable: true,
      enumerable: true,
      configurable: true
    });
  });

  afterEach(function() {
    walletManager.logout();
  });

  describe("Gun Storage", function() {
    it("should save and retrieve a wallet", async function() {
      await walletManager.saveWallet(testWallet);
      const retrieved = await walletManager.getWallet();
      
      assert(retrieved, "Wallet should be retrieved");
      assert.strictEqual(retrieved.address, testWallet.address);
      assert.strictEqual(retrieved.privateKey, testWallet.privateKey);
      assert.strictEqual(retrieved.entropy, testWallet.entropy);
    });

    it("should handle wallet updates", async function() {
      await walletManager.saveWallet(testWallet);
      
      // Create and save a new wallet
      const newWallet = Wallet.createRandom();
      await walletManager.saveWallet(newWallet);
      
      const retrieved = await walletManager.getWallet();
      assert.strictEqual(retrieved.address, newWallet.address);
    });
  });

  describe("Gun KeyPair Export/Import", function() {
    it("should export and import a Gun keypair", async function() {
      const exported = await walletManager.exportGunKeyPair();
      const originalPubKey = walletManager.getPublicKey();
      
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
      await walletManager.saveWallet(testWallet);
      
      // Generate and save stealth keys
      const stealthChain = walletManager.getStealthChain();
      const stealthKeys = await stealthChain.generateStealthKeys();
      
      // Export all data
      const exported = await walletManager.exportAllData();
      
      // Logout and clear data
      walletManager.logout();
      
      // Create new session
      await walletManager.login(testAlias, "password123");
      
      // Import data
      await walletManager.importAllData(exported);
      
      // Verify wallet
      const retrievedWallet = await walletManager.getWallet();
      assert.strictEqual(retrievedWallet.address, testWallet.address);
      
      // Verify stealth keys
      const retrievedKeys = await stealthChain.getStealthKeys();
      assert.strictEqual(retrievedKeys.pub, stealthKeys.pub);
    });

    it("should handle invalid export data", async function() {
      try {
        await walletManager.importAllData('{"invalid":"data"}');
        assert.fail("Should throw an error");
      } catch (error) {
        assert(error.message.includes("Invalid data format"), "Error message should mention invalid format");
      }
    });
  });

  describe("Wallet Creation", function() {
    it("should create a wallet object from Gun keypair", async function() {
      const gunKeyPair = walletManager.getCurrentUserKeyPair();
      const result = await WalletManager.createWalletObj(gunKeyPair);
      
      assert(result.walletObj, "Should return a wallet object");
      assert(result.entropy, "Should have entropy");
      assert(result.walletObj.address.startsWith("0x"), "Address should start with 0x");
      assert(result.walletObj.entropy === result.entropy, "Entropy should match");
    });

    it("should create wallet from salt", async function() {
      const gunKeyPair = walletManager.getCurrentUserKeyPair();
      const testSalt = "test_salt_123";
      
      const wallet = await WalletManager.createWalletFromSalt(gunKeyPair, testSalt);
      
      assert(wallet instanceof Wallet, "Should return a Wallet instance");
      assert(wallet.address.startsWith("0x"), "Address should start with 0x");
      assert(wallet.entropy === testSalt, "Entropy should match salt");
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
      const gunKeyPair = walletManager.getCurrentUserKeyPair();
      
      const wallet1 = await WalletManager.createWalletFromSalt(gunKeyPair, "salt1");
      const wallet2 = await WalletManager.createWalletFromSalt(gunKeyPair, "salt2");
      
      assert.notStrictEqual(wallet1.address, wallet2.address, "Wallets should have different addresses");
    });
  });
}); 