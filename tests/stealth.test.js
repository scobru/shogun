// test/stealthChainAlternative.test.js

const { describe, it, beforeEach, afterEach } = require("mocha");
const assert = require("assert");

// Import the class we want to test
const { StealthChain } = require("../src/StealthChain");

// Import (or instantiate) the WalletManager
// The important thing is that we can extract the same Gun instance used by it
const { WalletManager } = require("../src/WalletManager");

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

describe("StealthChain (using WalletManager's Gun instance)", function () {
  this.timeout(120000);

  let manager;        // WalletManager instance
  let gun;            // Gun instance extracted from manager
  let user;           // Gun user for manual creation/login
  let stealthChain;   // StealthChain instance based on gun
  let testPublicKey;  // Public key of the test user

  beforeEach(async function () {
    this.timeout(30000);
    
    console.log("\n=== Setup: creating manager and retrieving Gun ===");
    // 1. Create a new manager
    manager = new WalletManager();

    // 2. Get Gun instance from manager
    gun = manager.getGun();
    if (!gun) {
      throw new Error("Unable to get Gun instance from manager");
    }

    // 3. Create Gun user manually (without using manager.createAccount)
    user = gun.user();

    const testAlias = `testuser_${Math.random().toString(36).substring(2)}`;
    const passphrase = "passwordTest";

    console.log("Creating user with alias:", testAlias);

    // Try to create user with multiple attempts
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        await new Promise((resolve, reject) => {
          user.create(testAlias, passphrase, async (ack) => {
            if (ack.err) {
              if (ack.err.includes("already created")) {
                console.log("Account already exists, trying login...");
                user.auth(testAlias, passphrase, (authAck) => {
                  if (authAck.err) reject(new Error(`Login failed: ${authAck.err}`));
                  else resolve();
                });
              } else {
                reject(new Error(`User creation error: ${ack.err}`));
              }
            } else {
              console.log("Account created, performing login...");
              user.auth(testAlias, passphrase, (authAck) => {
                if (authAck.err) reject(new Error(`Login failed: ${authAck.err}`));
                else resolve();
              });
            }
          });
        });
        break;
      } catch (error) {
        attempts++;
        if (attempts === maxAttempts) throw error;
        console.log(`Attempt ${attempts} failed, retrying...`);
        await sleep(1000);
      }
    }

    // Wait for Gun to be ready
    await sleep(2000);

    // Verify login with multiple attempts
    await waitUntil(() => {
      const isLogged = !!gun.user().is;
      if (!isLogged) console.log("Waiting for login...");
      return isLogged;
    }, 15, 1000);

    testPublicKey = user.is.pub;
    console.log("🔑 User created/logged in successfully:", testPublicKey);

    // 4. Instantiate StealthChain using manager's Gun
    stealthChain = new StealthChain(gun);

    // Verify StealthChain is ready
    if (!stealthChain) {
      throw new Error("StealthChain not properly initialized");
    }

    console.log("=== Setup completed ===\n");
  });

  afterEach(async function () {
    console.log("\n=== Teardown: user logout and Gun disconnection ===");
    try {
      if (gun && gun.user()) {
        gun.user().leave();
        console.log("👤 User disconnected from Gun");
      }
      // Gun doesn't have a real "close", but we can remove listeners
      if (gun && gun.off) {
        gun.off();
      }
      await sleep(1000);
    } catch (err) {
      console.warn("❌ Error in afterEach:", err.message);
    }
    console.log("=== Teardown completed ===\n");
  });

  it("should generate stealth keys and save them", async function () {
    console.log("Test: generating and saving stealth keys");
    // 1. Generate stealth keys
    const generatedKeyPair = await new Promise((resolve, reject) => {
      stealthChain.generateStealthKeys((err, result) => {
        if (err) {
          console.error("Error generating keys:", err);
          return reject(err);
        }
        console.log("Keys generated:", result);
        resolve(result);
      });
    });

    // Verify keys were generated correctly
    assert(generatedKeyPair, "generateStealthKeys returned nothing");
    assert(generatedKeyPair.pub, "Missing public key");
    assert(generatedKeyPair.priv, "Missing private key");
    assert(generatedKeyPair.epub, "Missing ephemeral public key");
    assert(generatedKeyPair.epriv, "Missing ephemeral private key");

    // Wait for Gun to be ready before saving
    await sleep(1000);

    // Save stealth keys with error handling
    await new Promise((resolve, reject) => {
      stealthChain.saveStealthKeys(generatedKeyPair, (err) => {
        if (err) {
          console.error("Error saving keys:", err);
          return reject(err);
        }
        console.log("Keys saved successfully");
        resolve();
      });
    });

    // Wait for Gun to sync data
    await sleep(2000);

    const publicKey = gun.user()._.sea.pub

    // Retrieve keys with error handling
    const retrievedKeys = await stealthChain.retrieveStealthKeysFromUser(publicKey);


    // Verify retrieved keys
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

  it("should generate and 'open' a stealth address", async function () {
    console.log("Test: generating and opening a stealth address");
    
    // 1. Generate + Save stealth keys
    console.log("Generating stealth keys...");
    const generatedKeyPair = await new Promise((resolve, reject) => {
      stealthChain.generateStealthKeys((err, result) => {
        if (err) {
          console.error("Error generating keys:", err);
          return reject(err);
        }
        console.log("Keys generated:", result);
        resolve(result);
      });
    });

    // Wait for Gun to be ready
    await sleep(1000);

    console.log("Saving stealth keys...");
    await new Promise((resolve, reject) => {
      stealthChain.saveStealthKeys(generatedKeyPair, (err) => {
        if (err) {
          console.error("Error saving keys:", err);
          return reject(err);
        }
        console.log("Keys saved successfully");
        resolve();
      });
    });

    // Wait for Gun to sync data
    await sleep(2000);

    // 2. Generate stealth address for the same public key (self-recipient)
    console.log("Generating stealth address for:", testPublicKey);
    
    const stealthData = await new Promise((resolve, reject) => {
      stealthChain.generateStealthAddress(testPublicKey, (err, data) => {
        if (err) {
          console.error("Error generating stealth address:", err);
          return reject(err);
        }
        console.log("Stealth address generated:", data);
        resolve(data);
      });
    });

    assert(stealthData.stealthAddress, "Missing generated stealth address");
    assert(stealthData.ephemeralPublicKey, "Missing generated ephemeralPublicKey");
    assert.strictEqual(
      stealthData.recipientPublicKey,
      testPublicKey,
      "Recipient public key doesn't match"
    );

    // Wait for Gun to sync data
    await sleep(2000);

    // 3. Open stealth address
    console.log("Opening stealth address...");
    const recoveredWallet = await new Promise((resolve, reject) => {
      stealthChain.openStealthAddress(
        stealthData.stealthAddress,
        stealthData.ephemeralPublicKey,
        (err, wallet) => {
          if (err) {
            console.error("Error opening stealth address:", err);
            return reject(err);
          }
          console.log("Wallet recovered:", wallet.address);
          resolve(wallet);
        }
      );
    });

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
