const { describe, it, before, beforeEach, afterEach, after } = require("mocha");
const assert = require("assert");
const { ethers } = require("ethers");
const Gun = require('gun');
require('gun/sea');

const { WalletManager } = require("../src/WalletManager");

// Configurazione di test per Gun e APP_KEY_PAIR
const gunOptions = {
  peers: ['http://localhost:8765/gun'],
  file: 'radata_test',
  radisk: false,
  localStorage: false,
  multicast: false
};

const APP_KEY_PAIR = {
  pub: "test_pub_key",
  priv: "test_priv_key"
};

// Utility function to wait for Gun data
async function waitForGunData(path, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for data at ${path}`));
    }, timeout);

    gun.get(path).once((data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Utility function to wait for authentication
async function waitForAuth(walletManager, timeout = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (walletManager.getPublicKey()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Authentication timeout');
}

// Generate unique usernames
const generateUniqueUsername = () =>
  `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

describe("EthereumManager Test Suite", function () {
  this.timeout(30000);

  let walletManager;
  let ethereumManager;
  let testWallet;
  const TEST_RPC_URL = "https://optimism.llamarpc.com";

  beforeEach(async function () {
    walletManager = new WalletManager(gunOptions, APP_KEY_PAIR);
    ethereumManager = walletManager.getEthereumManager();
    
    // Create a test wallet
    testWallet = ethers.Wallet.createRandom();
    
    // Configure custom provider
    ethereumManager.setCustomProvider(TEST_RPC_URL, testWallet.privateKey);
  });

  afterEach(async function () {
    if (walletManager) {
      walletManager.logout();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  });

  describe("Account Creation", function () {
    it("should create an account using Ethereum wallet", async function () {
      const address = await ethereumManager.createAccountWithEthereum();
      await waitForAuth(walletManager);
      
      assert(address, "Should return an address");
      assert.strictEqual(
        address,
        testWallet.address.toLowerCase(),
        "Address should be the lowercase Ethereum address"
      );

      const pubKey = walletManager.getPublicKey();
      assert(pubKey, "Should have a public key after creation");
    });

    it("should handle provider errors", async function () {
      // Configure provider with invalid URL
      ethereumManager.setCustomProvider("http://invalid-url", testWallet.privateKey);

      try {
        await ethereumManager.createAccountWithEthereum();
        assert.fail("Should fail with invalid provider");
      } catch (error) {
        assert(error, "Should throw an error");
      }
    });
  });

  describe("Login", function () {
    it("should login with an existing account", async function () {
      // First create the account
      const address = await ethereumManager.createAccountWithEthereum();
      
      // Logout
      walletManager.logout();
      
      // Try login
      const pubKey = await ethereumManager.loginWithEthereum();
      
      assert(pubKey, "Should get a public key after login");
      assert.strictEqual(
        walletManager.getPublicKey(),
        pubKey,
        "Public keys should match"
      );
    });

    it("should handle signature errors", async function () {
      try {
        await walletManager.loginWithPrivateKey("0xinvalid");
        assert.fail("Should throw an error");
      } catch (error) {
        const errorMsg = error.message.toLowerCase();
        assert(
          errorMsg.includes("invalid") || 
          errorMsg.includes("non valida") || 
          errorMsg.includes("invalida"),
          "Error should indicate that the key is invalid"
        );
      }
    });
  });

  describe("Gun Integration", function () {
    it("should persist account data to Gun", async function () {
      const address = await ethereumManager.createAccountWithEthereum();
      const pubKey = walletManager.getPublicKey();
      
      // Get wallet from Gun
      const wallet = await walletManager.getWallet();
      assert(wallet, "Wallet should be saved to Gun");
      assert.strictEqual(wallet.address.toLowerCase(), address.toLowerCase(), "Addresses should match");
    });

    it("should sync data between sessions", async function () {
      // First session: create account
      await ethereumManager.createAccountWithEthereum();
      const firstPubKey = walletManager.getPublicKey();
      const firstWallet = await walletManager.getWallet();
      
      // Logout
      walletManager.logout();
      
      // Second session: login
      const secondPubKey = await ethereumManager.loginWithEthereum();
      const secondWallet = await walletManager.getWallet();
      
      assert.strictEqual(
        firstPubKey,
        secondPubKey,
        "Public keys should be the same between sessions"
      );
      assert.strictEqual(
        firstWallet.address.toLowerCase(),
        secondWallet.address.toLowerCase(),
        "Wallet addresses should be the same between sessions"
      );
    });
  });

  describe("Performance and Security", function () {
    it("should complete operations within acceptable time limits", async function () {
      const startTime = performance.now();
      
      await ethereumManager.createAccountWithEthereum();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      assert(
        duration < 5000,
        "Account creation should take less than 5 seconds"
      );
    });

    it("should generate secure passwords from signature", async function () {
      // First create account to get generated password
      const address = await ethereumManager.createAccountWithEthereum();
      const pubKey = walletManager.getPublicKey();
      
      // Try to login with same signature
      const loginPubKey = await ethereumManager.loginWithEthereum();
      
      assert(loginPubKey, "Should accept password generated from signature");
      assert.strictEqual(loginPubKey, pubKey, "Public keys should match");
    });
  });
});
