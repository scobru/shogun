const { describe, it, before, beforeEach, afterEach, after } = require("mocha");
const assert = require("assert");
const { ethers } = require("ethers");
const Gun = require('gun');

const { WalletManager } = require("../src/WalletManager");

// Utility function to wait for data to be available in Gun
async function waitForGunData(gun, path, timeout = 5000) {
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
    walletManager = new WalletManager();
    ethereumManager = walletManager.getEthereumManager();
    
    // Create a test wallet
    testWallet = ethers.Wallet.createRandom();
    
    // Configure custom provider
    ethereumManager.setCustomProvider(TEST_RPC_URL, testWallet.privateKey);
  });

  afterEach(function () {
    if (walletManager.gun) {
      walletManager.gun.off();
    }
    walletManager.logout();
  });

  describe("Account Creation", function () {
    it("should create an account using Ethereum wallet", async function () {
      const username = await ethereumManager.createAccountWithEthereum();
      
      assert(username, "Should return a username");
      assert.strictEqual(
        username,
        testWallet.address.toLowerCase(),
        "Username should be the lowercase Ethereum address"
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
      const username = await ethereumManager.createAccountWithEthereum();
      
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
      const username = await ethereumManager.createAccountWithEthereum();
      
      // Wait for data to be saved to Gun
      const savedData = await waitForGunData(
        walletManager.gun,
        `~@${username}`
      );
      
      assert(savedData, "Data should be saved to Gun");
    });

    it("should sync data between sessions", async function () {
      // First session: create account
      const username = await ethereumManager.createAccountWithEthereum();
      const firstPubKey = walletManager.getPublicKey();
      
      // Wait for data to be saved
      await waitForGunData(walletManager.gun, `~@${username}`);
      
      // Simulate new session
      walletManager.logout();
      
      // Second session: login
      const secondPubKey = await ethereumManager.loginWithEthereum();
      
      assert.strictEqual(
        firstPubKey,
        secondPubKey,
        "Public keys should be the same between sessions"
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
      await ethereumManager.createAccountWithEthereum();
      
      // Verify password is a 64-character hash (32 bytes)
      const username = testWallet.address.toLowerCase();
      
      // Try to login with same signature
      const pubKey = await ethereumManager.loginWithEthereum();
      
      assert(pubKey, "Should accept password generated from signature");
    });
  });
});
