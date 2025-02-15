const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { ethers } = require("ethers");
const { EthereumConnector } = require("../dist/connector/EthereumConnector");

describe("EthereumConnector", function () {
  let ethereumConnector;
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
      ethereumConnector = new EthereumConnector(gun, APP_KEY_PAIR);
      
      // Configura il provider personalizzato per i test
      ethereumConnector.setCustomProvider(TEST_RPC_URL, testWallet.privateKey);
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
      ethereumConnector.setCustomProvider(TEST_RPC_URL, newWallet.privateKey);
      expect(ethereumConnector).to.have.property("customProvider");
      expect(ethereumConnector).to.have.property("customWallet");
    });

    it("should fail with invalid RPC URL", function () {
      expect(() => 
        ethereumConnector.setCustomProvider("", testWallet.privateKey)
      ).to.throw("RPC URL non valido");
    });

    it("should fail with invalid private key", function () {
      expect(() => 
        ethereumConnector.setCustomProvider(TEST_RPC_URL, "")
      ).to.throw("Chiave privata non valida");
    });
  });

  describe("Account Management", function () {
    beforeEach(async function () {
      // Reset dello stato prima di ogni test
      if (ethereumConnector.user.is) {
        ethereumConnector.user.leave();
      }
      // Riconfigura il provider
      ethereumConnector.setCustomProvider(TEST_RPC_URL, testWallet.privateKey);
    });

    it("should create an Ethereum account", async function () {
      const account = await ethereumConnector.createAccount();
      expect(account).to.be.an("object");
      expect(account).to.have.property("pub").that.is.a("string");
      expect(account).to.have.property("priv").that.is.a("string");
      expect(account).to.have.property("epub").that.is.a("string");
      expect(account).to.have.property("epriv").that.is.a("string");
    });

    it("should login with Ethereum account", async function () {
      const publicKey = await ethereumConnector.login();
      expect(publicKey).to.be.a("string");
      expect(publicKey).to.have.length.greaterThan(0);
    });

    it("should get Ethereum signer", async function () {
      const signer = await ethereumConnector.getSigner();
      expect(signer).to.be.an("object");
      expect(signer.address).to.equal(testWallet.address);
    });
  });

  describe("Signature Management", function () {
    const testMessage = "Test message";

    it("should generate password from signature", async function () {
      const signature = await testWallet.signMessage(testMessage);
      const password = await ethereumConnector.generatePassword(signature);
      expect(password).to.be.a("string");
      expect(password).to.have.length(64); // 32 bytes in hex
    });

    it("should verify signature", async function () {
      const signature = await testWallet.signMessage(testMessage);
      const recoveredAddress = await ethereumConnector.verifySignature(testMessage, signature);
      expect(recoveredAddress.toLowerCase()).to.equal(testWallet.address.toLowerCase());
    });

    it("should fail with invalid signature", async function () {
      try {
        await ethereumConnector.verifySignature(testMessage, "invalid_signature");
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
      if (ethereumConnector.user) {
        ethereumConnector.user.leave();
      }
      
      // Attendiamo un tempo sufficiente per la disconnessione
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        await ethereumConnector.createAccount();
      } catch (error) {
        if (error.message.includes("already created")) {
          // Se l'account esiste già, proviamo a fare il login
          await ethereumConnector.login();
        } else {
          throw error;
        }
      }
      
      // Attendiamo che l'account sia pronto
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    it("should save and retrieve private data", async function () {
      const testData = { test: "data" };
      await ethereumConnector.savePrivateData(testData, "test");
      const retrievedData = await ethereumConnector.getPrivateData("test");
      expect(retrievedData).to.deep.equal(testData);
    });

    it("should save and retrieve public data", async function () {
      const testData = { test: "public_data" };
      await ethereumConnector.savePublicData(testData, "test");
      const publicKey = ethereumConnector.getCurrentPublicKey();
      const retrievedData = await ethereumConnector.getPublicData(publicKey, "test");
      expect(retrievedData).to.deep.equal(testData);
    });
  });

  describe("Error Handling", function () {
    it("should handle authentication errors", async function () {
      ethereumConnector.user.leave();
      try {
        await ethereumConnector.getPrivateData("test");
        throw new Error("Should have failed");
      } catch (error) {
        expect(error.message).to.include("not authenticated");
      }
    });

    it("should handle invalid Ethereum addresses", async function () {
      try {
        await ethereumConnector.login();
        const invalidAddress = "0xinvalid";
        await ethereumConnector.verifySignature("test", invalidAddress);
        throw new Error("Should have failed");
      } catch (error) {
        expect(error.message).to.include("Messaggio o firma non validi");
      }
    });
  });
}); 