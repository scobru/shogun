const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { ethers } = require("ethers");
const { EthereumManager } = require("../dist/managers/EthereumManager");
const { GunAuthManager } = require("../dist/managers/GunAuthManager");
const Firegun = require("../dist/db/Firegun2").default;

describe("EthereumManager", function () {
  let ethereumManager;
  let gunAuthManager;
  let APP_KEY_PAIR;
  let firegun;
  let testUsername;
  let testPassword;
  let testWallet;
  let gun;
  const TEST_RPC_URL = "http://localhost:8545";

  const waitForOperation = (ms = 2000) => new Promise(resolve => setTimeout(resolve, ms));

  before(async function() {    
    this.timeout(5000);
    console.log("Starting setup...");

    try {
      // Inizializza Gun direttamente
      gun = Gun({
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

      // Crea un wallet di test
      testWallet = ethers.Wallet.createRandom();
      console.log("Test wallet created");

      testUsername = `test_${Date.now()}`;
      testPassword = "password123";

      // Inizializza managers
      gunAuthManager = new GunAuthManager(gun, APP_KEY_PAIR);
      ethereumManager = new EthereumManager(gun, APP_KEY_PAIR);
      console.log("Managers initialized");

      // Crea utente usando GunAuthManager
      console.log("Creating user...");
      try {
        await gunAuthManager.createAccount(testUsername, testPassword);
        console.log("User created");
      } catch (error) {
        console.error("Error creating user:", error);
        throw error;
      }

      await waitForOperation(2000);

      // Login
      console.log("Logging in...");
      try {
        await gunAuthManager.login(testUsername, testPassword);
        console.log("Login successful");
      } catch (error) {
        console.error("Error logging in:", error);
        throw error;
      }

      await waitForOperation(2000);

      // Sincronizza Firegun con Gun
      const gunUser = gun.user();
      if (!gunUser || !gunUser.is) {
        throw new Error("Gun user not properly initialized");
      }
      
      firegun.user = gunUser;

      // Configura il provider personalizzato
      ethereumManager.setCustomProvider(TEST_RPC_URL, testWallet.privateKey);
      console.log("Custom provider configured");

      // Sincronizza utente con i manager
      const userObject = {
        alias: testUsername,
        pair: gunUser._.sea,
        is: gunUser.is,
        _: gunUser._
      };

      gunAuthManager.setUser(userObject);
      ethereumManager.setUser(userObject);

      console.log("User state:", {
        gunUser: gunUser.is,
        firegunUser: firegun.user,
        managerUser: ethereumManager.user,
        isAuth: ethereumManager.isAuthenticated(),
        userAlias: ethereumManager.user.alias,
        userPair: ethereumManager.user.pair
      });

      console.log("User synchronized with managers");

      await waitForOperation(2000);

      // Verifica managers
      if (!gunAuthManager.isAuthenticated()) {
        throw new Error("GunAuthManager authentication failed");
      }
      if (!ethereumManager.isAuthenticated()) {
        throw new Error("EthereumManager authentication failed");
      }
      console.log("Manager authentication verified");

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
    if (gun) {
      gun.off();
      console.log("Gun instance closed");
    }
    await waitForOperation(1000);
    console.log("Cleanup complete");
  });

  describe("Provider Configuration", function() {
    beforeEach(async function() {
      this.timeout(10000);
      console.log("Running beforeEach...");
      if (!ethereumManager.isAuthenticated()) {
        console.log("Re-authenticating...");
        try {
          await gunAuthManager.login(testUsername, testPassword);
          console.log("Re-authentication successful");
        } catch (error) {
          console.error("Re-authentication failed:", error);
          throw error;
        }
      } else {
        console.log("Already authenticated");
      }
      await waitForOperation(1000);
    });

    it("should set custom provider correctly", async function() {
      const newWallet = ethers.Wallet.createRandom();
      ethereumManager.setCustomProvider(TEST_RPC_URL, newWallet.privateKey);
      
      expect(ethereumManager).to.have.property("customProvider");
      expect(ethereumManager).to.have.property("customWallet");
      
      const signer = await ethereumManager.getSigner();
      expect(signer.address.toLowerCase()).to.equal(newWallet.address.toLowerCase());
    });

    it("should fail with invalid RPC URL", function() {
      expect(() => 
        ethereumManager.setCustomProvider("", testWallet.privateKey)
      ).to.throw("RPC URL non valido");
    });

    it("should fail with invalid private key", function() {
      expect(() => 
        ethereumManager.setCustomProvider(TEST_RPC_URL, "")
      ).to.throw("Chiave privata non valida");
    });
  });

  describe("Account Management", function() {
    it("should create an Ethereum account", async function() {
      this.timeout(10000);
      const account = await ethereumManager.createAccount();
      await waitForOperation(2000);

      expect(account).to.be.an("object");
      expect(account).to.have.property("pub").that.is.a("string");
      expect(account).to.have.property("priv").that.is.a("string");
      expect(account).to.have.property("epub").that.is.a("string");
      expect(account).to.have.property("epriv").that.is.a("string");
    });

    it("should login with Ethereum account", async function() {
      this.timeout(10000);
      const publicKey = await ethereumManager.login();
      await waitForOperation(2000);

      expect(publicKey).to.be.a("string");
      expect(publicKey).to.have.length.greaterThan(0);
    });

    it("should get Ethereum signer", async function() {
      const signer = await ethereumManager.getSigner();
      expect(signer).to.be.an("object");
      expect(signer.address.toLowerCase()).to.equal(testWallet.address.toLowerCase());
    });
  });

  describe("Signature Management", function() {
    const testMessage = "Test message";

    it("should generate password from signature", async function() {
      const signature = await testWallet.signMessage(testMessage);
      const password = await ethereumManager.generatePassword(signature);
      
      expect(password).to.be.a("string");
      expect(password).to.have.length(64); // 32 bytes in hex
    });

    it("should verify signature", async function() {
      const signature = await testWallet.signMessage(testMessage);
      const recoveredAddress = await ethereumManager.verifySignature(testMessage, signature);
      
      expect(recoveredAddress.toLowerCase()).to.equal(testWallet.address.toLowerCase());
    });

    it("should fail with invalid signature", async function() {
      try {
        await ethereumManager.verifySignature(testMessage, "invalid_signature");
        throw new Error("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Messaggio o firma non validi");
      }
    });
  });

  describe("Data Storage", function() {
    this.timeout(60000);

    it("should save and retrieve private data", async function() {
      const testData = { test: "data" };
      await ethereumManager.savePrivateData(testData, "test");
      await waitForOperation(2000);

      const retrievedData = await ethereumManager.getPrivateData("test");
      expect(retrievedData).to.deep.equal(testData);
    });

    it("should save and retrieve public data", async function() {
      const testData = { test: "public_data" };
      await ethereumManager.savePublicData(testData, "test");
      await waitForOperation(2000);

      const retrievedData = await ethereumManager.getPublicData("test");
      expect(retrievedData).to.deep.equal(testData);
    });
  });
}); 