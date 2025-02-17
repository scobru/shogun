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

  const ensureAuthenticated = async () => {
    if (!testUser.is) {
      await new Promise((resolve, reject) => {
        testUser.auth(testUsername, testPassword, async (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else {
            await waitForSync(5000);
            resolve();
          }
        });
      });
    }
  };

  before(async function () {
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

      let created = false;
      for (let i = 0; i < 3; i++) {
        try {
          await new Promise((resolve, reject) => {
            testUser.create(testUsername, testPassword, async (ack) => {
              if (ack.err) reject(ack.err);
              else {
                await waitForSync(5000);
                testUser.auth(testUsername, testPassword, async (authAck) => {
                  if (authAck.err) reject(authAck.err);
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
          if (i === 2) throw error;
        }
      }

      if (!testUser.is) {
        throw new Error("Failed to authenticate user after creation");
      }

      hdKeyVault.user = testUser;

    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });

  beforeEach(async function() {
    await ensureAuthenticated();
    await waitForSync(5000);
  });

  afterEach(async function() {
    await ensureAuthenticated();
  });

  after(async function () {
    try {
      if (testUser && testUser.leave) {
        testUser.leave();
      }
      if (gun) {
        gun.off();
      }
      await waitForSync(2000);
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  describe("HD Key Management", function () {
    it("should create a new HD key", async function () {
      await ensureAuthenticated();
      console.log("Starting create HD key test");
      
      const walletData = await hdKeyVault.createAccount();
      await waitForSync();
      
      expect(walletData).to.be.an("object");
      expect(walletData).to.have.property("address").that.is.a("string");
      expect(walletData).to.have.property("privateKey").that.is.a("string");
      expect(walletData).to.have.property("entropy").that.is.a("string");
      expect(walletData).to.have.property("index").that.is.a("number");
      expect(walletData).to.have.property("timestamp").that.is.a("number");

      expect(ethers.isAddress(walletData.address)).to.be.true;
      expect(walletData.entropy).to.match(/^m\/44'\/60'\/0'\/0\/\d+$/);
      
      console.log("HD key creation test completed successfully");
    });

    it("should create multiple HD keys with sequential indices", async function () {
      await ensureAuthenticated();
      console.log("Starting multiple HD keys test");
      
      const wallet1 = await hdKeyVault.createAccount();
      const wallet2 = await hdKeyVault.createAccount();
      await waitForSync();
      
      expect(wallet2.index).to.equal(wallet1.index + 1);
      expect(wallet2.entropy).to.equal(`m/44'/60'/0'/0/${wallet1.index + 1}`);
      
      console.log("Multiple HD keys test completed successfully");
    });

    it("should retrieve all HD keys", async function () {
      await ensureAuthenticated();
      console.log("Starting retrieve all keys test");

      const hdWallet1 = await hdKeyVault.createAccount();
      const hdWallet2 = await hdKeyVault.createAccount();
      await waitForSync();

      const wallets = await hdKeyVault.getWallets();
      console.log(`Retrieved ${wallets.length} wallets`);

      expect(wallets).to.be.an("array");
      expect(wallets.length).to.be.at.least(2);

      const foundWallet1 = wallets.find(w => 
        w.address.toLowerCase() === hdWallet1.address.toLowerCase()
      );
      expect(foundWallet1, "First HD key not found").to.not.be.undefined;
      expect(foundWallet1.entropy).to.equal(hdWallet1.entropy);

      const foundWallet2 = wallets.find(w => 
        w.address.toLowerCase() === hdWallet2.address.toLowerCase()
      );
      expect(foundWallet2, "Second HD key not found").to.not.be.undefined;
      expect(foundWallet2.entropy).to.equal(hdWallet2.entropy);
      
      console.log("Retrieve all keys test completed successfully");
    });

    it("should maintain consistent HD derivation", async function () {
      await ensureAuthenticated();
      console.log("Starting HD derivation consistency test");
      
      const wallet1 = await hdKeyVault.createAccount();
      const index1 = wallet1.index;
      
      const newVault = new EthereumHDKeyVault(gun, APP_KEY_PAIR);
      newVault.user = testUser;
      
      const wallet2 = await newVault.createAccount();
      
      expect(wallet2.index).to.equal(index1 + 1);
      
      console.log("HD derivation consistency test completed successfully");
    });

    it("should get key by index", async function () {
      await ensureAuthenticated();
      console.log("Starting get key by index test");
      
      const wallet1 = await hdKeyVault.createAccount();
      await waitForSync();
      
      const retrievedWallet = await hdKeyVault.getWalletByIndex(wallet1.index);
      expect(retrievedWallet.address.toLowerCase()).to.equal(wallet1.address.toLowerCase());
      
      console.log("Get key by index test completed successfully");
    });

    it("should get key by address", async function () {
      await ensureAuthenticated();
      console.log("Starting get key by address test");
      
      const wallet1 = await hdKeyVault.createAccount();
      await waitForSync();
      
      const retrievedWallet = await hdKeyVault.getWalletByAddress(wallet1.address);
      expect(retrievedWallet.address.toLowerCase()).to.equal(wallet1.address.toLowerCase());
      
      console.log("Get key by address test completed successfully");
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
