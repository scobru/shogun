const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { ActivityPubManager } = require("../dist/managers/ActivityPubManager");
const { GunAuthManager } = require("../dist/managers/GunAuthManager");

describe("ActivityPubManager", function () {
  let activityPubManager;
  let APP_KEY_PAIR;
  let gun;
  let testUsername;
  let testPassword;

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
      const gunAuthManager = new GunAuthManager(gun, APP_KEY_PAIR);

      // Crea credenziali test
      testUsername = "testUser_" + Date.now();
      testPassword = "password123";

      await gunAuthManager.gun.userNew(testUsername, testPassword);

      // Effettua il login e verifica l'autenticazione
      await activityPubManager.login(testUsername, testPassword);
      
      // Verifica ulteriormente l'autenticazione
      if (!activityPubManager.isAuthenticated()) {
        throw new Error("Authentication failed after login");
      }

    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });

  after(async function () {
    try {
      if (activityPubManager.user && activityPubManager.user.leave) {
        activityPubManager.user.leave();
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
      // Verifica autenticazione prima di ogni test
      if (!activityPubManager.isAuthenticated()) {
        console.log("Re-authenticating user before test...");
        await activityPubManager.login(testUsername, testPassword);
        await waitForOperation(1000);
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
      await activityPubManager.save(keys);
      await waitForOperation(2000);

      const retrievedKeys = await activityPubManager.getKeys();
      expect(retrievedKeys).to.deep.equal(keys);
    });

    it("should retrieve public key", async function () {
      const keys = await activityPubManager.createAccount();
      await activityPubManager.save(keys);
      await waitForOperation(2000);

      const publicKey = await activityPubManager.getPub();
      expect(publicKey).to.equal(keys.publicKey);
    });

    it("should delete keys", async function () {
      const keys = await activityPubManager.createAccount();
      await activityPubManager.save(keys);
      await waitForOperation(2000);

      await activityPubManager.deleteKeys();
      await waitForOperation(2000);

      // Verifica che le chiavi siano state eliminate
      try {
        await activityPubManager.getKeys();
        throw new Error("Keys should have been deleted, but were found");
      } catch (error) {
        expect(error.message).to.equal("Keys not found");
      }

      try {
        await activityPubManager.getPub();
      } catch (error) {
        expect(error.message).to.equal("Cannot read properties of undefined (reading 'publicKey')");
      }
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
      if (!activityPubManager.user || !activityPubManager.user.is || !activityPubManager.user.is.pub) {
        await activityPubManager.login(testUsername, testPassword);
      }

      testKeys = await activityPubManager.createAccount();
      await activityPubManager.save(testKeys);
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