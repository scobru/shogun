const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { ethers } = require("ethers");
const { JsonRpcConnector } = require("../dist/blockchain/connectors/JsonRpcConnector");
const { EthereumHDKeyVault } = require("../dist/blockchain/wallets/EthereumHDKeyVault");

describe("JsonRpcConnector", function () {
  let ethereumConnector;
  let hdKeyVault;
  let APP_KEY_PAIR;
  let gun;
  let testWallet;
  const TEST_RPC_URL = "http://localhost:8545";

  const waitForOperation = async (ms = 8000) => {
    await new Promise(resolve => setTimeout(resolve, ms));
  };

  const retryOperation = async (operation, maxAttempts = 3, delay = 8000) => {
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
      ethereumConnector = new JsonRpcConnector(gun, APP_KEY_PAIR);
      hdKeyVault = new EthereumHDKeyVault(gun, APP_KEY_PAIR);
      
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
      this.timeout(120000);
      
      // Ensure authentication before each test
      await retryOperation(async () => {
        if (!hdKeyVault.user || !hdKeyVault.user.is) {
          await new Promise((resolve, reject) => {
            hdKeyVault.user.auth(testUsername, testPassword, async (ack) => {
              if (ack.err) reject(new Error(ack.err));
              else {
                await waitForOperation(10000);
                resolve();
              }
            });
          });
        }
        
        if (!hdKeyVault.user.is) {
          throw new Error("Authentication failed");
        }
      });

      // Riconfigura il provider
      ethereumConnector.setCustomProvider(TEST_RPC_URL, testWallet.privateKey);
    });

    it("should create an Ethereum account", async function () {
      const account = await retryOperation(async () => {
        const result = await hdKeyVault.createAccount();
        await waitForOperation(10000);
        return result;
      });

      expect(account).to.be.an("object");
      expect(account.address).to.be.a("string");
      expect(ethers.isAddress(account.address)).to.be.true;
    });

    it("should login with Ethereum account", async function () {
      const publicKey = await retryOperation(async () => {
        const result = await ethereumConnector.login();
        await waitForOperation(10000);
        return result;
      });

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
      this.timeout(180000);
      
      await retryOperation(async () => {
        // Ensure clean state
        if (ethereumConnector.user) {
          ethereumConnector.user.leave();
          await waitForOperation(5000);
        }
        
        try {
          await ethereumConnector.createAccount();
          await waitForOperation(10000);
        } catch (error) {
          if (error.message.includes("already created")) {
            await ethereumConnector.login();
            await waitForOperation(10000);
          } else {
            throw error;
          }
        }
        
        if (!ethereumConnector.isAuthenticated()) {
          throw new Error("Authentication failed");
        }
      });
    });

    it("should save and retrieve private data", async function () {
      const testData = { test: "data_" + Date.now() };
      
      await retryOperation(async () => {
        await ethereumConnector.savePrivateData(testData, "test");
        await waitForOperation(10000);
        
        const retrievedData = await ethereumConnector.getPrivateData("test");
        expect(retrievedData).to.deep.equal(testData);
      });
    });

    it("should save and retrieve public data", async function () {
      const testData = { test: "public_data_" + Date.now() };
      
      await retryOperation(async () => {
        await ethereumConnector.savePublicData(testData, "test");
        await waitForOperation(10000);
        
        const publicKey = ethereumConnector.getCurrentPublicKey();
        const retrievedData = await ethereumConnector.getPublicData(publicKey, "test");
        expect(retrievedData).to.deep.equal(testData);
      });
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