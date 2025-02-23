const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { EthereumHDKeyVault } = require("../dist/blockchain/wallets/EthereumHDKeyVault");
const { ethers } = require("ethers");

describe("EthereumHDKeyVault", function () {
  let hdKeyVault;
  let APP_KEY_PAIR;
  let gun;
  let testUser;
  let testUsername;
  let testPassword;

  this.timeout(180000);

  const waitForSync = async (ms = 5000) => {
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
          await waitForSync(delay);
        }
      }
    }
    throw lastError;
  };

  const ensureAuthenticated = async () => {
    return retryOperation(async () => {
      if (!testUser.is) {
        await new Promise((resolve, reject) => {
          testUser.auth(testUsername, testPassword, async (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else {
              await waitForSync(8000);
              resolve();
            }
          });
        });
      }
      if (!testUser.is || !testUser._.sea) {
        throw new Error("Autenticazione fallita o chiavi SEA non trovate");
      }
    });
  };

  const clearData = async () => {
    return retryOperation(async () => {
      if (testUser.is) {
        await new Promise(resolve => {
          testUser.get('wallets').put(null);
          testUser.get('hd_mnemonic').put(null);
          testUser.get('hd_accounts').put(null);
          setTimeout(resolve, 8000);
        });
      }
    });
  };

  before(async function () {
    this.timeout(120000);
    try {
      APP_KEY_PAIR = await Gun.SEA.pair();
      gun = Gun({
        peers: [`http://localhost:8765/gun`],
        file: false,
        radisk: false,
        localStorage: false,
        multicast: false,
        axe: false,
        retry: 2500,
      });

      hdKeyVault = new EthereumHDKeyVault(gun, APP_KEY_PAIR);
      testUser = gun.user();
      testUsername = `testUser_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      testPassword = "password123";

      await waitForSync(5000);

      let created = false;
      for (let i = 0; i < 5; i++) {
        try {
          await new Promise((resolve, reject) => {
            testUser.create(testUsername, testPassword, async (ack) => {
              if (ack.err) reject(new Error(ack.err));
              else {
                await waitForSync(5000);
                testUser.auth(testUsername, testPassword, async (authAck) => {
                  if (authAck.err) reject(new Error(authAck.err));
                  else {
                    await waitForSync(5000);
                    resolve();
                  }
                });
              }
            });
          });
          created = true;
          break;
        } catch (error) {
          console.log(`Attempt ${i + 1} failed:`, error);
          await waitForSync(5000);
          if (i === 4) throw error;
        }
      }

      if (!created || !testUser.is) {
        throw new Error("Failed to create and authenticate user");
      }

      hdKeyVault.user = testUser;
      await clearData();
      await waitForSync(5000);

    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });

  beforeEach(async function() {
    this.timeout(30000);
    await ensureAuthenticated();
    await clearData();
    await waitForSync(5000);
  });

  afterEach(async function() {
    this.timeout(30000);
    await clearData();
    await waitForSync(5000);
  });

  after(async function () {
    this.timeout(30000);
    try {
      await clearData();
      if (testUser && testUser.leave) {
        testUser.leave();
      }
      if (gun) {
        gun.off();
      }
      await waitForSync(5000);
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  describe("HD Key Management", function () {
    it("should create a new HD key", async function () {
      await ensureAuthenticated();
      console.log("Starting create HD key test");
      
      const walletData = await retryOperation(async () => {
        const data = await hdKeyVault.createAccount();
        await waitForSync(15000);
        return data;
      });
      
      console.log("Wallet data:", walletData);
      
      expect(walletData).to.be.an("object");
      expect(walletData.address).to.be.a("string");
      expect(walletData.index).to.equal(0);
    });

    it("should create multiple HD keys with sequential indices", async function () {
      await ensureAuthenticated();
      console.log("Starting multiple HD keys test");
      
      const results = await retryOperation(async () => {
        const wallet1 = await hdKeyVault.createAccount();
        await waitForSync(15000);
        const wallet2 = await hdKeyVault.createAccount();
        await waitForSync(15000);
        return [wallet1, wallet2];
      });
      
      expect(results[0].index).to.equal(0);
      expect(results[1].index).to.equal(1);
    });

    it("should retrieve all HD keys", async function () {
      await ensureAuthenticated();
      console.log("Starting retrieve all HD keys test");
      
      await retryOperation(async () => {
        // Create test wallets
        await hdKeyVault.createAccount();
        await waitForSync(15000);
        await hdKeyVault.createAccount();
        await waitForSync(15000);
      });

      const wallets = await retryOperation(async () => {
        const allWallets = await hdKeyVault.getWallets();
        await waitForSync(15000);
        return allWallets;
      });
      
      expect(wallets).to.be.an("array");
      expect(wallets).to.have.lengthOf(2);
    });

    it("should maintain consistent HD derivation", async function () {
      await ensureAuthenticated();
      console.log("Starting HD derivation consistency test");
      
      const result = await retryOperation(async () => {
        const wallet = await hdKeyVault.createAccount();
        await waitForSync(15000);
        const retrieved = await hdKeyVault.getWalletByIndex(0);
        await waitForSync(15000);
        return { created: wallet, retrieved };
      });
      
      expect(result.created.address).to.equal(result.retrieved.address);
    });

    it("should get key by index", async function () {
      await ensureAuthenticated();
      console.log("Starting get key by index test");
      
      const createdWallet = await retryOperation(async () => {
        const wallet = await hdKeyVault.createAccount();
        await waitForSync(15000);
        return wallet;
      });

      console.log("Created wallet with index:", createdWallet.index);

      const retrievedWallet = await retryOperation(async () => {
        const result = await hdKeyVault.getWalletByIndex(createdWallet.index);
        await waitForSync(15000);
        return result;
      });
      
      expect(retrievedWallet).to.be.an("object");
      expect(retrievedWallet.index).to.equal(createdWallet.index);
      expect(retrievedWallet.address).to.equal(createdWallet.address);
    });

    it("should get key by address", async function () {
      await ensureAuthenticated();
      console.log("Starting get key by address test");
      
      const address = await retryOperation(async () => {
        const wallet = await hdKeyVault.createAccount();
        await waitForSync(15000);
        return wallet.address;
      });

      const wallet = await retryOperation(async () => {
        const result = await hdKeyVault.getWalletByAddress(address);
        await waitForSync(15000);
        return result;
      });
      
      expect(wallet).to.be.an("object");
      expect(wallet.address).to.equal(address);
    });
  });

  describe("Gun Key Integration", function () {
    it("should get legacy key from Gun private key", async function () {
      await ensureAuthenticated();
      console.log("Starting get legacy key test");
      
      const legacyWallet = await hdKeyVault.getLegacyWallet();
      expect(ethers.isAddress(legacyWallet.address)).to.be.true;
      
      const gunPrivateKey = testUser._.sea.epriv;
      const derivedPrivateKey = hdKeyVault.convertToEthPk(gunPrivateKey);
      const expectedWallet = new ethers.Wallet(derivedPrivateKey);
      
      expect(legacyWallet.address.toLowerCase()).to.equal(expectedWallet.address.toLowerCase());
      
      console.log("Get legacy key test completed successfully");
    });

    it("should convert Gun private key to Ethereum private key", function () {
      const gunPrivateKey = testUser._.sea.priv;
      const ethPrivateKey = hdKeyVault.convertToEthPk(gunPrivateKey);

      expect(ethPrivateKey).to.be.a("string");
      expect(ethPrivateKey).to.match(/^0x[0-9a-f]{64}$/i);

      const wallet = new ethers.Wallet(ethPrivateKey);
      expect(ethers.isAddress(wallet.address)).to.be.true;
    });

    it("should fail with invalid Gun private key", function () {
      expect(() => 
        hdKeyVault.convertToEthPk("")
      ).to.throw("Chiave privata Gun non valida");
    });
  });
});
