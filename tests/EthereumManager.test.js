const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { ethers } = require("ethers");
const { EthereumManager } = require("../dist/managers/EthereumManager");

describe("EthereumManager", function () {
  let ethereumManager;
  let APP_KEY_PAIR;
  let gun;
  let testWallet;
  const TEST_RPC_URL = "http://localhost:8545";

  before(async function () {
    try {
      // Genera chiavi per l'app
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

      // Crea un wallet di test
      testWallet = ethers.Wallet.createRandom();

      // Inizializza EthereumManager
      ethereumManager = new EthereumManager(gun, APP_KEY_PAIR);
      
      // Configura il provider personalizzato per i test
      ethereumManager.setCustomProvider(TEST_RPC_URL, testWallet.privateKey);
    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });

  after(function () {
    if (gun) {
      gun.off();
    }
  });

  describe("Provider Configuration", function () {
    it("should set custom provider correctly", function () {
      const newWallet = ethers.Wallet.createRandom();
      ethereumManager.setCustomProvider(TEST_RPC_URL, newWallet.privateKey);
      expect(ethereumManager).to.have.property("customProvider");
      expect(ethereumManager).to.have.property("customWallet");
    });

    it("should fail with invalid RPC URL", function () {
      expect(() => 
        ethereumManager.setCustomProvider("", testWallet.privateKey)
      ).to.throw("RPC URL non valido");
    });

    it("should fail with invalid private key", function () {
      expect(() => 
        ethereumManager.setCustomProvider(TEST_RPC_URL, "")
      ).to.throw("Chiave privata non valida");
    });
  });

  describe("Account Management", function () {
    beforeEach(async function () {
      // Reset dello stato prima di ogni test
      if (ethereumManager.user.is) {
        ethereumManager.user.leave();
      }
      // Riconfigura il provider
      ethereumManager.setCustomProvider(TEST_RPC_URL, testWallet.privateKey);
    });

    it("should create an Ethereum account", async function () {
      const account = await ethereumManager.createAccount();
      expect(account).to.be.an("object");
      expect(account).to.have.property("pub").that.is.a("string");
      expect(account).to.have.property("priv").that.is.a("string");
      expect(account).to.have.property("epub").that.is.a("string");
      expect(account).to.have.property("epriv").that.is.a("string");
    });

    it("should login with Ethereum account", async function () {
      const publicKey = await ethereumManager.login();
      expect(publicKey).to.be.a("string");
      expect(publicKey).to.have.length.greaterThan(0);
    });

    it("should get Ethereum signer", async function () {
      const signer = await ethereumManager.getSigner();
      expect(signer).to.be.an("object");
      expect(signer.address).to.equal(testWallet.address);
    });
  });

  describe("Signature Management", function () {
    const testMessage = "Test message";

    it("should generate password from signature", async function () {
      const signature = await testWallet.signMessage(testMessage);
      const password = await ethereumManager.generatePassword(signature);
      expect(password).to.be.a("string");
      expect(password).to.have.length(64); // 32 bytes in hex
    });

    it("should verify signature", async function () {
      const signature = await testWallet.signMessage(testMessage);
      const recoveredAddress = await ethereumManager.verifySignature(testMessage, signature);
      expect(recoveredAddress.toLowerCase()).to.equal(testWallet.address.toLowerCase());
    });

    it("should fail with invalid signature", async function () {
      try {
        await ethereumManager.verifySignature(testMessage, "invalid_signature");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Messaggio o firma non validi");
      }
    });
  });

  describe("Data Storage", function () {
    beforeEach(async function () {
      // Aumentiamo il timeout
      this.timeout(10000);
      
      // Assicuriamoci che l'utente sia completamente disconnesso
      if (ethereumManager.user) {
        ethereumManager.user.leave();
      }
      
      // Attendiamo un tempo sufficiente per la disconnessione
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        await ethereumManager.createAccount();
      } catch (error) {
        if (error.message.includes("already created")) {
          // Se l'account esiste già, proviamo a fare il login
          await ethereumManager.login();
        } else {
          throw error;
        }
      }
      
      // Attendiamo che l'account sia pronto
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    it("should save and retrieve private data", async function () {
      const testData = { test: "data" };
      await ethereumManager.savePrivateData(testData, "test");
      const retrievedData = await ethereumManager.getPrivateData("test");
      expect(retrievedData).to.deep.equal(testData);
    });

    it("should save and retrieve public data", async function () {
      const testData = { test: "public_data" };
      await ethereumManager.savePublicData(testData, "test");
      const publicKey = ethereumManager.getCurrentPublicKey();
      const retrievedData = await ethereumManager.getPublicData(publicKey, "test");
      expect(retrievedData).to.deep.equal(testData);
    });
  });

  describe("Error Handling", function () {
    it("should handle authentication errors", async function () {
      ethereumManager.user.leave();
      try {
        await ethereumManager.getPrivateData("test");
        throw new Error("Should have failed");
      } catch (error) {
        expect(error.message).to.include("not authenticated");
      }
    });

    it("should handle invalid Ethereum addresses", async function () {
      try {
        await ethereumManager.login();
        const invalidAddress = "0xinvalid";
        await ethereumManager.verifySignature("test", invalidAddress);
        throw new Error("Should have failed");
      } catch (error) {
        expect(error.message).to.include("Messaggio o firma non validi");
      }
    });
  });
}); 