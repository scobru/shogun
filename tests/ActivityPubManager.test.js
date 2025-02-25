const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { ActivityPub } = require("../dist/extensions/activitypub/ActivityPub");

describe("ActivityPub", function () {
  let activityPubManager;
  let APP_KEY_PAIR;
  let gun;
  let testUser;
  let testUsername;

  const waitForOperation = async (ms = 5000) => {
    await new Promise(resolve => setTimeout(resolve, ms));
  };

  before(async function () {
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

      // Inizializza ActivityPub
      activityPubManager = new ActivityPub(gun, APP_KEY_PAIR);

      // Crea un utente di test
      testUser = gun.user();
      testUsername = "testUser_" + Date.now();

      // Prima creiamo l'utente
      await new Promise((resolve, reject) => {
        testUser.create(testUsername, "password123", (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      await waitForOperation(3000);

      // Poi effettuiamo il login
      await new Promise((resolve, reject) => {
        testUser.auth(testUsername, "password123", (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      // Importante: assegniamo l'utente autenticato all'activityPubManager
      activityPubManager.user = testUser;

      // Verifica che l'utente sia autenticato
      if (!testUser.is || !testUser.is.pub) {
        throw new Error("User authentication failed");
      }
    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });

  after(async function () {
    try {
      if (testUser && testUser.leave) {
        testUser.leave();
      }
      if (gun) {
        gun.off();
      }
      await waitForOperation(2000);
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  describe("Key Management", function () {
    this.timeout(120000);

    beforeEach(async function () {
      // Verifica che l'utente sia ancora autenticato prima di ogni test
      if (!testUser.is || !testUser.is.pub) {
        await new Promise((resolve, reject) => {
          testUser.auth(testUsername, "password123", async (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else {
              await waitForOperation(5000);
              resolve();
            }
          });
        });
      }
    });

    it("should create new ActivityPub keys", async function () {
      console.log("Starting create new ActivityPub keys test...");
      const keys = await activityPubManager.createAccount();
      await waitForOperation(5000);
      
      expect(keys).to.be.an("object");
      expect(keys).to.have.property("publicKey").that.is.a("string");
      expect(keys).to.have.property("privateKey").that.is.a("string");
      expect(keys).to.have.property("createdAt").that.is.a("number");
      
      expect(keys.publicKey).to.include("-----BEGIN PUBLIC KEY-----");
      expect(keys.privateKey).to.include("-----BEGIN PRIVATE KEY-----");
      console.log("Create new ActivityPub keys test completed");
    });

    it("should save and retrieve keys", async function () {
      console.log("Starting save and retrieve keys test...");
      const keys = await activityPubManager.createAccount();
      console.log("Keys created, saving...");
      await activityPubManager.saveKeys(keys);
      await waitForOperation(5000);

      console.log("Retrieving keys...");
      const retrievedKeys = await activityPubManager.getKeys();
      expect(retrievedKeys).to.deep.equal(keys);
      console.log("Save and retrieve keys test completed");
    });

    it("should delete keys", async function () {
      this.timeout(180000);

      console.log("Creating new keys...");
      const keys = await activityPubManager.createAccount();
      console.log("Saving keys...");
      await activityPubManager.saveKeys(keys);
      await waitForOperation(10000);

      console.log("Verifying keys exist...");
      const keysBeforeDelete = await activityPubManager.getKeys();
      expect(keysBeforeDelete).to.deep.equal(keys);

      console.log("Starting key deletion process...");
      await activityPubManager.deleteKeys();
      
      // Aumentiamo il tempo di attesa iniziale
      await waitForOperation(20000);

      // Verifica con retry più lunghi
      let verificationAttempts = 0;
      const maxVerificationAttempts = 10;
      
      while (verificationAttempts < maxVerificationAttempts) {
        try {
          console.log(`Verification attempt ${verificationAttempts + 1}...`);
          const keysAfterDelete = await activityPubManager.getKeys();
          
          if (!keysAfterDelete || !keysAfterDelete.publicKey) {
            console.log("Keys successfully deleted");
            return;
          }
          
          console.log("Keys still exist, retrying verification...");
          verificationAttempts++;
          await waitForOperation(10000);
        } catch (error) {
          if (error.message.includes("not found") || error.message.includes("non trovate")) {
            console.log("Keys successfully deleted (error confirms deletion)");
            return;
          }
          throw error;
        }
      }
      
      throw new Error("Keys still exist after deletion");
    });

    it("should fail to sign with invalid username", async function () {
      const testData = "Test message";
      
      console.log("Testing sign with invalid username...");
      
      let error;
      try {
        await activityPubManager.sign(testData, "invalid_user");
      } catch (err) {
        error = err;
      }
      
      expect(error).to.exist;
      expect(error.message).to.equal('Username "invalid_user" non valido');
      
      console.log("Invalid username test completed successfully");
    });

    it("should sign with any username if authenticated", async function () {
      const testData = "Test message";
      
      console.log("Testing sign with any username...");
      
      // Prima creiamo e salviamo le chiavi
      const keys = await activityPubManager.createAccount();
      await activityPubManager.saveKeys(keys);
      await waitForOperation(5000);
      
      // Ora proviamo a firmare con un username qualsiasi
      const { signature, signatureHeader } = await activityPubManager.sign(
        testData,
        "any_username"
      );

      expect(signature).to.be.a("string");
      expect(signatureHeader).to.be.a("string");
      expect(signatureHeader).to.include("any_username");
      expect(signatureHeader).to.include("rsa-sha256");
      
      console.log("Sign test completed successfully");
    });
  });

  describe("Signing Operations", function () {
    this.timeout(30000);
    let testKeys;

    beforeEach(async function () {
      if (!testUser.is || !testUser.is.pub) {
        await new Promise((resolve, reject) => {
          testUser.auth(testUsername, "password123", (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
        });
      }

      testKeys = await activityPubManager.createAccount();
      await activityPubManager.saveKeys(testKeys);
      await waitForOperation(2000);
    });

    it("should sign data", async function () {
      const testData = "Test message to sign";
      const { signature, signatureHeader } = await activityPubManager.sign(
        testData,
        testUsername
      );

      expect(signature).to.be.a("string");
      expect(signatureHeader).to.be.a("string");
      expect(signatureHeader).to.include(testUsername);
      expect(signatureHeader).to.include("rsa-sha256");
    });
  });
}); 