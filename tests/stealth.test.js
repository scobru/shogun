// test/stealthChainAlternative.test.js

const { describe, it, beforeEach, afterEach } = require("mocha");
const assert = require("assert");
const Gun = require("gun");
require("gun/sea");

// Import the class we want to test
const { StealthChain } = require("../src/chains/StealthChain");

// Import (or instantiate) the WalletManager
// The important thing is that we can extract the same Gun instance used by it
const { WalletManager } = require("../src/Shogun");

// Configurazione di test per Gun e APP_KEY_PAIR
const gunOptions = {
  peers: ['http://localhost:8765/gun']
  
};


const APP_KEY_PAIR = {
  pub: "test_pub_key",
  priv: "test_priv_key"
};

/**
 * Execute a pause (for example to give Gun time to sync)
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic polling, calls `checkFn` repeatedly until it returns true
 * or until attempts are exhausted.
 */
async function waitUntil(checkFn, maxAttempts = 15, interval = 500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (await checkFn()) return true;
    await sleep(interval);
  }
  throw new Error(`Condition not met after ${maxAttempts} attempts`);
}

describe("StealthChain Test Suite", function () {
  this.timeout(120000);

  let walletManager;
  let stealthChain;
  let testAlias;

  beforeEach(async function () {
    this.timeout(30000);
    
    console.log("\n=== Setup: creating manager and initializing StealthChain ===");
    
    walletManager = new WalletManager(gunOptions, APP_KEY_PAIR);
    stealthChain = walletManager.getStealthChain();
    testAlias = `testuser_${Math.random().toString(36).substring(2)}`;

    // Create and authenticate test user
    await walletManager.createAccount(testAlias, "password123");
    await walletManager.login(testAlias, "password123");

    console.log("=== Setup completed ===\n");
  });

  afterEach(async function () {
    console.log("\n=== Teardown: cleanup ===");
    walletManager.logout();
    await sleep(1000);
    console.log("=== Teardown completed ===\n");
  });

  it("should generate stealth keys and save them", async function () {
    console.log("Test: generating and saving stealth keys");
    
    // Generate stealth keys
    const generatedKeyPair = await stealthChain.generateStealthKeys();
    
    assert(generatedKeyPair, "generateStealthKeys returned nothing");
    assert(generatedKeyPair.pub, "Missing public key");
    assert(generatedKeyPair.priv, "Missing private key");
    assert(generatedKeyPair.epub, "Missing ephemeral public key");
    assert(generatedKeyPair.epriv, "Missing ephemeral private key");

    // Wait for Gun to sync
    await sleep(2000);

    // Retrieve keys
    const retrievedKeys = await stealthChain.getStealthKeys();
    
    assert(retrievedKeys, "No keys retrieved");
    assert.strictEqual(
      retrievedKeys.pub,
      generatedKeyPair.pub,
      "Retrieved stealth keys don't match (pub)"
    );
    assert.strictEqual(
      retrievedKeys.priv,
      generatedKeyPair.priv,
      "Retrieved stealth keys don't match (priv)"
    );
    
    console.log("✅ Stealth keys generated and saved successfully");
  });

  it("should generate and open a stealth address", async function () {
    console.log("Test: generating and opening a stealth address");
    
    // Generate stealth keys
    console.log("Generating stealth keys...");
    const generatedKeyPair = await stealthChain.generateStealthKeys();
    
    // Wait for Gun to sync
    await sleep(2000);

    const publicKey = walletManager.getPublicKey();
    
    // Generate stealth address
    console.log("Generating stealth address for:", publicKey);
    const stealthData = await stealthChain.generateStealthAddress(publicKey);
    
    assert(stealthData.stealthAddress, "Missing generated stealth address");
    assert(stealthData.ephemeralPublicKey, "Missing generated ephemeralPublicKey");
    assert.strictEqual(
      stealthData.recipientPublicKey,
      publicKey,
      "Recipient public key doesn't match"
    );

    // Wait for Gun to sync
    await sleep(2000);

    // Open stealth address
    console.log("Opening stealth address...");
    const recoveredWallet = await stealthChain.openStealthAddress(
      stealthData.stealthAddress,
      stealthData.ephemeralPublicKey
    );

    assert(recoveredWallet.address, "Decrypted wallet has no address");
    assert(recoveredWallet.privateKey, "Decrypted wallet has no private key");
    assert.strictEqual(
      recoveredWallet.address.toLowerCase(),
      stealthData.stealthAddress.toLowerCase(),
      "Recovered address doesn't match generated one"
    );
    
    console.log("✅ Stealth address generated and opened successfully");
  });
});
