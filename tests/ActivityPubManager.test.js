const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { ActivityPubManager } = require("../dist/managers/ActivityPubManager");

describe("ActivityPubManager", function () {
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

      // Inizializza ActivityPubManager
      activityPubManager = new ActivityPubManager(gun, APP_KEY_PAIR);

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
    this.timeout(30000);

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

    it("should create new ActivityPub keys", async function () {
      const keys = await activityPubManager.createAccount();
      
      expect(keys).to.be.an("object");
      expect(keys).to.have.property("publicKey").that.is.a("string");
      expect(keys).to.have.property("privateKey").that.is.a("string");
      expect(keys).to.have.property("createdAt").that.is.a("number");
      
      expect(keys.publicKey).to.include("-----BEGIN PUBLIC KEY-----");
      expect(keys.privateKey).to.include("-----BEGIN PRIVATE KEY-----");
    });

    it("should save and retrieve keys", async function () {
      const keys = await activityPubManager.createAccount();
      await activityPubManager.saveKeys(keys);
      await waitForOperation(2000);

      const retrievedKeys = await activityPubManager.getKeys();
      expect(retrievedKeys).to.deep.equal(keys);
    });

    it("should retrieve public key", async function () {
      const keys = await activityPubManager.createAccount();
      await activityPubManager.saveKeys(keys);
      await waitForOperation(2000);

      const publicKey = await activityPubManager.getPub();
      expect(publicKey).to.equal(keys.publicKey);
    });

    it("should delete keys", async function () {
      // Prima creiamo e salviamo le chiavi
      const keys = await activityPubManager.createAccount();
      console.log("Chiavi create:", !!keys);
      
      await activityPubManager.saveKeys(keys);
      console.log("Chiavi salvate");
      
      // Verifichiamo che le chiavi siano state salvate
      await waitForOperation(3000);
      const savedKeys = await activityPubManager.getKeys();
      console.log("Verifica chiavi salvate:", !!savedKeys);
      expect(savedKeys).to.deep.equal(keys);

      // Eliminiamo le chiavi
      console.log("Eliminazione chiavi...");
      await activityPubManager.deleteKeys();
      await waitForOperation(5000); // Aumentato il tempo di attesa

      // Verifichiamo che le chiavi siano state eliminate
      console.log("Verifica eliminazione...");
      try {
        const deletedKeys = await activityPubManager.getKeys();
        console.log("Chiavi dopo eliminazione:", deletedKeys);
        if (deletedKeys !== null) {
          throw new Error("Keys should have been deleted but were found: " + JSON.stringify(deletedKeys));
        }
      } catch (error) {
        if (!error.message.includes("Keys not found")) {
          throw error;
        }
      }

      // Verifichiamo anche la chiave pubblica
      const publicKey = await activityPubManager.getPub();
      expect(publicKey).to.be.undefined;
    });

    it("should fail to sign with invalid username", async function () {
      const testData = "Test message";
      try {
        await activityPubManager.sign(testData, "invalid_user");
        throw new Error("Expected an error but none was thrown");
      } catch (error) {
        expect(error.message).to.include("Private key not found");
      }
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