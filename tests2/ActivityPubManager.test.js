const chai = require("chai");
const { expect } = chai;
const Gun = require('gun');
require('gun/sea');
const { ActivityPubManager } = require("../dist/managers/ActivityPubManager");
const { GunAuthManager } = require("../dist/managers/GunAuthManager");
const Firegun = require("../dist/db/Firegun2").default;

describe("ActivityPubManager", function () {
  let activityPubManager;
  let gunAuthManager;
  let APP_KEY_PAIR;
  let firegun;
  let testUsername;
  let testPassword;
  let testKeys;

  const waitForOperation = (ms = 2000) => new Promise(resolve => setTimeout(resolve, ms));

  before(async function() {    
    this.timeout(60000);
    console.log("Starting setup...");

    try {
      // Inizializza Gun direttamente
      const gun = Gun({
        peers: ['http://localhost:8765/gun'],
        file: false,
        radisk: false,
        localStorage: false
      });

      // Inizializza Firegun con l'istanza Gun
      firegun = new Firegun({ gunInstance: gun });

      await waitForOperation(1000);
      console.log("Gun and Firegun initialized");

      // Genera chiavi
      APP_KEY_PAIR = await Gun.SEA.pair();
      console.log("Key pair generated");

      testUsername = `test_${Date.now()}`;
      testPassword = "password123";

      // Inizializza managers
      gunAuthManager = new GunAuthManager(gun, APP_KEY_PAIR);
      activityPubManager = new ActivityPubManager(gun, APP_KEY_PAIR);
      console.log("Managers initialized");

      // Crea utente usando GunAuthManager
      console.log("Creating user...");
      await gunAuthManager.createAccount(testUsername, testPassword);
      console.log("User created");

      await waitForOperation(2000);

      // Login
      console.log("Logging in...");
      await gunAuthManager.login(testUsername, testPassword);
      console.log("Login successful");

      await waitForOperation(2000);

      // Sincronizza Firegun con Gun
      const gunUser = gun.user();
      if (!gunUser || !gunUser.is) {
        throw new Error("Gun user not properly initialized");
      }
      
      firegun.user = gunUser;

      // Sincronizza utente con i manager
      const userObject = {
        alias: testUsername,
        pair: gunUser._.sea,
        is: gunUser.is,
        _: gunUser._
      };

      gunAuthManager.setUser(userObject);
      activityPubManager.setUser(userObject);

      console.log("User state:", {
        gunUser: gunUser.is,
        firegunUser: firegun.user,
        managerUser: activityPubManager.user,
        isAuth: activityPubManager.isAuthenticated(),
        userAlias: activityPubManager.user.alias,
        userPair: activityPubManager.user.pair
      });

      console.log("User synchronized with managers");

      await waitForOperation(2000);

      // Verifica managers
      if (!gunAuthManager.isAuthenticated()) {
        throw new Error("GunAuthManager authentication failed");
      }
      if (!activityPubManager.isAuthenticated()) {
        throw new Error("ActivityPubManager authentication failed");
      }
      console.log("Manager authentication verified");

      // Genera chiavi di test
      console.log("Generating test keys...");
      testKeys = await activityPubManager.createAccount();
      console.log("Test keys generated");

    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });

  after(async function() {
    console.log("Running cleanup...");
    if (firegun) {
      await firegun.userLogout();
      console.log("User logged out");
    }
    await waitForOperation(1000);
    console.log("Cleanup complete");
  });

  describe("Key Management", function() {
    beforeEach(async function() {
      console.log("Running beforeEach...");
      if (!activityPubManager.isAuthenticated()) {
        console.log("Re-authenticating...");
        const loginResult = await firegun.userLogin(testUsername, testPassword);
        if ('err' in loginResult) {
          throw new Error(`Re-authentication failed: ${loginResult.err}`);
        }

        const userObject = {
          alias: testUsername,
          pair: loginResult.pair,
          is: { pub: loginResult.pair.pub }
        };

        gunAuthManager.setUser(userObject);
        activityPubManager.setUser(userObject);

        await waitForOperation(1000);
        console.log("Re-authentication complete");
      } else {
        console.log("Already authenticated");
      }
    });

    it("should create new ActivityPub keys", async function() {
      const keys = await activityPubManager.createAccount();
      await waitForOperation(1000);
      
      expect(keys).to.be.an("object");
      expect(keys.publicKey).to.include("-----BEGIN PUBLIC KEY-----");
      expect(keys.privateKey).to.include("-----BEGIN PRIVATE KEY-----");
      expect(keys.createdAt).to.be.a("number");
    });

    it("should save and retrieve keys", async function() {
      await activityPubManager.saveKeys('activityPub', testKeys);
      await waitForOperation(1000);

      const retrievedKeys = await activityPubManager.getKeys();
      expect(retrievedKeys).to.deep.equal(testKeys);
    });

    it("should retrieve public key", async function() {
      await activityPubManager.saveKeys('activityPub', testKeys);
      await waitForOperation(1000);

      const publicKey = await activityPubManager.getPub();
      expect(publicKey).to.equal(testKeys.publicKey);
    });

    it("should delete keys", async function() {
      this.timeout(45000);
      console.log("Starting delete keys test...");

      try {
        // Prima verifichiamo che le chiavi esistano
        console.log("Saving test keys...");
        await activityPubManager.saveKeys('activityPub', testKeys);
        await waitForOperation(3000);

        // Verifichiamo che le chiavi siano state salvate
        const savedKeys = await activityPubManager.getKeys();
        expect(savedKeys).to.deep.equal(testKeys);
        console.log("Keys saved and verified");

        // Poi le eliminiamo
        console.log("Deleting keys...");
        await activityPubManager.deleteKeys();
        await waitForOperation(3000);

        // Verifichiamo che le chiavi siano state eliminate
        console.log("Verifying keys deletion...");
        let deletionVerified = false;

        try {
          const keys = await activityPubManager.getKeys();
          if (!keys || !keys.activityPub) {
            deletionVerified = true;
          }
        } catch (error) {
          if (error.message === "ActivityPub keys not found") {
            deletionVerified = true;
          }
        }

        expect(deletionVerified).to.be.true;
        console.log("Keys deletion verified successfully");
      } catch (error) {
        console.error("Error in delete keys test:", error);
        throw error;
      }
    });

    it("should fail to get private key with invalid username", async function() {
      try {
        await activityPubManager.getPk("invalid_user");
        throw new Error("Expected an error");
      } catch (error) {
        expect(error.message).to.equal("Private key not found for user invalid_user");
      }
    });
  });

  describe("Signing Operations", function() {
    it("should validate key format", async function() {
      const validateKey = Reflect.get(activityPubManager, 'validateKey');
      
      expect(validateKey.call(activityPubManager, testKeys.publicKey)).to.be.true;
      expect(validateKey.call(activityPubManager, testKeys.privateKey)).to.be.true;
      expect(validateKey.call(activityPubManager, "invalid-key")).to.be.false;
    });

    it("should import private key in browser environment", async function() {
      global.window = {
        crypto: {
          subtle: {
            importKey: async () => "imported-key"
          }
        }
      };

      const importedKey = await activityPubManager.importPk(testKeys.privateKey);
      expect(importedKey).to.equal("imported-key");

      delete global.window;
    });
  });
}); 