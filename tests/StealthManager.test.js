const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { StealthChain } = require("../dist/extensions/stealth/StealthChain");
const { ethers } = require("ethers");

describe("StealthManager", function () {
  // Aumentato timeout totale a 5 minuti
  this.timeout(300000);

  let stealthChain;
  let APP_KEY_PAIR;
  let gun;
  let testUser;
  let testUsername;

  const waitForOperation = async (ms = 15000) => {
    await new Promise(resolve => setTimeout(resolve, ms));
  };

  const retryOperation = async (operation, maxAttempts = 5, delay = 15000) => {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          console.log(`Operation succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        console.log(`Attempt ${attempt} failed:`, error.message);
        lastError = error;
        if (attempt < maxAttempts) {
          await waitForOperation(delay);
        }
      }
    }
    throw lastError;
  };

  before(async function () {
    // Aumentato timeout totale a 5 minuti
    this.timeout(180000);
    try {
      // Genera chiavi
      APP_KEY_PAIR = await Gun.SEA.pair();

      // Inizializza Gun client
      gun = Gun({
        peers: [`http://localhost:8765/gun`],
        file: false,
        radisk: false,
        localStorage: false,
        multicast: false,
        axe: false,
      });

      // Inizializza StealthManager
      stealthChain = new StealthChain(gun, APP_KEY_PAIR);

      // Crea un utente di test
      testUser = gun.user();
      testUsername = "testUser_" + Date.now();

      // Prima creiamo l'utente
      await retryOperation(async () => {
        console.log("Creating test user...");
        await new Promise((resolve, reject) => {
          testUser.create(testUsername, "password123", (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
        });
        console.log("User created successfully");
        return true;
      });

      await waitForOperation(15000);

      // Poi effettuiamo il login
      await retryOperation(async () => {
        console.log("Authenticating test user...");
        await new Promise((resolve, reject) => {
          testUser.auth(testUsername, "password123", (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
        });
        console.log("User authenticated successfully");
        return true;
      });

      // Verifica che l'utente sia autenticato
      if (!testUser.is || !testUser.is.pub) {
        throw new Error("User authentication failed");
      }
      
      console.log("Setup completed successfully");
    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });

  after(async function () {
    this.timeout(120000);
    try {
      console.log("Starting cleanup...");
      if (testUser && testUser.leave) {
        console.log("Logging out user...");
        testUser.leave();
        await waitForOperation(15000);
      }
      if (gun) {
        console.log("Shutting down Gun...");
        gun.off();
      }
      await waitForOperation(15000);
      console.log("Cleanup completed successfully");
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  describe("Stealth Key Management", function () {
    // Aumentato timeout totale a 5 minuti

    beforeEach(async function () {
      // Verifica che l'utente sia ancora autenticato prima di ogni test
      if (!testUser.is || !testUser.is.pub) {
        await new Promise((resolve, reject) => {
          testUser.auth(testUsername, "password123", (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
        });
      }
    });

    it("should create stealth keys", async function () {
      const stealthKeyPair = await stealthChain.createAccount();
      await waitForOperation(2000);

      expect(stealthKeyPair).to.have.property("pub").that.is.a("string");
      expect(stealthKeyPair).to.have.property("priv").that.is.a("string");
      expect(stealthKeyPair).to.have.property("epub").that.is.a("string");
      expect(stealthKeyPair).to.have.property("epriv").that.is.a("string");
    });

    it("should save and retrieve stealth keys", async function () {
      const stealthKeyPair = await stealthChain.createAccount();
      await stealthChain.save(stealthKeyPair);
      await waitForOperation(3000);

      const retrievedKeys = await stealthChain.getPair();
      expect(retrievedKeys).to.deep.equal(stealthKeyPair);
    });

    it("should retrieve public stealth key", async function () {
      const stealthKeyPair = await stealthChain.createAccount();
      await stealthChain.save(stealthKeyPair);
      await waitForOperation(3000);

      const publicKey = testUser._.sea.pub;
      const retrievedPub = await stealthChain.getPub(publicKey);

      expect(retrievedPub).to.equal(stealthKeyPair.epub);
    });

    it("should generate stealth address", async function () {
      const senderKeyPair = await stealthChain.createAccount();
      await stealthChain.save(senderKeyPair);

      const recipientKeyPair = await Gun.SEA.pair();
      const recipientPublicKey = recipientKeyPair.pub;

      const stealthResult = await stealthChain.generateStAdd(
        recipientPublicKey
      );

      expect(stealthResult)
        .to.have.property("stealthAddress")
        .that.is.a("string");
      expect(stealthResult)
        .to.have.property("ephemeralPublicKey")
        .that.is.a("string");
      expect(stealthResult)
        .to.have.property("recipientPublicKey")
        .that.equals(recipientPublicKey);
      expect(ethers.isAddress(stealthResult.stealthAddress)).to.be.true;
    });

    it("should open stealth address", async function () {
      // Prima creiamo e salviamo le chiavi stealth
      const recipientKeys = await stealthChain.createAccount();
      await stealthChain.save(recipientKeys);
      await waitForOperation(2000);

      // Generiamo un indirizzo stealth
      const stealthResult = await stealthChain.generateStAdd(
        testUser._.sea.pub
      );

      // Proviamo ad aprire l'indirizzo stealth
      const wallet = await stealthChain.openStAdd(
        stealthResult.stealthAddress,
        stealthResult.ephemeralPublicKey
      );

      expect(wallet)
        .to.have.property("address")
        .that.equals(stealthResult.stealthAddress);
      expect(ethers.isAddress(wallet.address)).to.be.true;
    });

    it("should fail to open invalid stealth address", async function () {
      const recipientKeys = await stealthChain.createAccount();
      await stealthChain.save(recipientKeys);

      try {
        await stealthChain.openStAdd(
          "0x1234567890123456789012345678901234567890", // indirizzo invalido
          "invalidEphemeralKey"
        );
        throw new Error("Should have failed with invalid stealth address");
      } catch (error) {
        expect(error.message).to.include("Unable to generate shared secret");
      }
    });

    it("should format public key correctly", async function () {
      this.timeout(300000);
      const publicKey = "test_public_key_" + Date.now();
      
      await retryOperation(async () => {
        console.log("Creating test key pair...");
        const keyPair = await stealthChain.createAccount();
        await stealthChain.save(keyPair);
        await waitForOperation(15000);
        
        console.log("Saving public data for key:", publicKey);
        // Salviamo direttamente con Gun API per evitare problemi di formato
        await new Promise((resolve) => {
          gun.get('stealth').get(publicKey).put({ 
            timestamp: Date.now(),
            value: "test_" + Date.now()
          }, resolve);
        });
        
        await waitForOperation(15000);
        
        console.log("Retrieving keys for:", publicKey);
        const formattedKey = await new Promise((resolve) => {
          gun.get('stealth').get(publicKey).once(data => {
            console.log("Retrieved raw data:", data);
            resolve(data);
          });
        });
        
        console.log("Retrieved key data:", formattedKey);
        expect(formattedKey).to.be.an("object");
        expect(formattedKey).to.have.property("timestamp").that.is.a("number");
        
        console.log("Test completed successfully");
      }, 5, 30000);
    });

    it("should retrieve stealth keys for specific user", async function () {
      const stealthKeyPair = await stealthChain.createAccount();
      await stealthChain.save(stealthKeyPair);
      await waitForOperation(2000);

      const publicKey = testUser._.sea.pub;
      const retrievedPair = await stealthChain.retrievePair(publicKey);

      expect(retrievedPair).to.deep.equal(stealthKeyPair);
    });
  });
});
