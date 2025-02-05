const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { WalletManager } = require("../dist/managers/WalletManager");
const { ethers } = require("ethers");

describe("WalletManager", function () {
  let walletManager;
  let APP_KEY_PAIR;
  let gun;
  let testUser;
  let testUsername;

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

      // Inizializza WalletManager
      walletManager = new WalletManager(gun, APP_KEY_PAIR);

      // Crea un utente di test
      testUser = gun.user();
      testUsername = `testUser_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      // Aggiungi tentativi multipli per la creazione e autenticazione
      let created = false;
      for (let i = 0; i < 3; i++) {
        try {
          await new Promise((resolve, reject) => {
            testUser.create(testUsername, "password123", (ack) => {
              if (ack.err) reject(ack.err);
              else {
                // Dopo la creazione, effettua il login
                testUser.auth(testUsername, "password123", (authAck) => {
                  if (authAck.err) reject(authAck.err);
                  else resolve();
                });
              }
            });
          });
          created = true;
          break;
        } catch (error) {
          console.log(`Attempt ${i + 1} failed:`, error);
          if (i === 2) throw error;
        }
      }

      // Verifica che l'utente sia autenticato
      if (!testUser.is) {
        throw new Error("Failed to authenticate user after creation");
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
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  describe("Wallet Creation and Management", function () {

    beforeEach(async function () {
      console.log("Running beforeEach...");
      console.log("Authentication completed");
    });

    it("should create a new wallet", async function () {
      console.log("Starting create wallet test");
      console.log("Checking authentication status:", !!testUser.is);
      
      const walletData = await walletManager.createAccount();
      console.log("Wallet created, verifying data...");

      expect(walletData).to.be.an("array");
      expect(walletData[0]).to.have.property("address").that.is.a("string");
      expect(walletData[0]).to.have.property("privateKey").that.is.a("string");
      expect(walletData[0]).to.have.property("entropy").that.is.a("string");
      expect(walletData[0]).to.have.property("timestamp").that.is.a("number");

      expect(ethers.isAddress(walletData[0].address)).to.be.true;
      console.log("Wallet creation test completed successfully");
    });

    it("should retrieve all wallets", async function () {
      console.log("Starting retrieve wallets test");
      console.log("Checking authentication status:", !!testUser.is);
      
      // Prima creiamo un nuovo wallet
      console.log("Creating new wallet for retrieval test...");
      const newWallet = ethers.Wallet.createRandom();
      await walletManager.saveWallet(newWallet);
      console.log("Test wallet saved");
      
      console.log("Retrieving wallets...");
      const wallets = await walletManager.getWallets();
      console.log(`Retrieved ${wallets.length} wallets`);
      
      expect(wallets).to.be.an("array");
      expect(wallets.length).to.be.at.least(1);

      wallets.forEach((wallet, index) => {
        console.log(`Checking wallet ${index + 1}/${wallets.length}`);
        expect(wallet).to.have.property("address").that.is.a("string");
        expect(ethers.isAddress(wallet.address)).to.be.true;
        expect(wallet).to.have.property("privateKey").that.is.a("string");
      });

      // Verifichiamo che il wallet appena creato sia presente
      console.log("Checking if new wallet exists in the list...");
      const foundWallet = wallets.find(w => 
        w.address.toLowerCase() === newWallet.address.toLowerCase()
      );
      expect(foundWallet, "New wallet not found in the list").to.not.be.undefined;
      console.log("Wallet retrieval test completed successfully");
    });

    it("should create a wallet from salt", async function () {
      const gunKeyPair = testUser._.sea;
      const salt = `test_salt_${Date.now()}`;

      const wallet = await walletManager.createWalletFromSalt(gunKeyPair, salt);

      expect(wallet).to.have.property("address").that.is.a("string");
      expect(wallet).to.have.property("privateKey").that.is.a("string");
      expect(ethers.isAddress(wallet.address)).to.be.true;
      expect(wallet).to.have.property("entropy").that.equals(salt);
    });

    it("should fail to create wallet with invalid salt", async function () {
      const gunKeyPair = testUser._.sea;

      try {
        await walletManager.createWalletFromSalt(gunKeyPair, "");
        throw new Error("Should have failed with invalid salt");
      } catch (error) {
        expect(error.message).to.include("Invalid salt provided");
      }
    });

    it("should convert Gun private key to Ethereum private key", function () {
      const gunPrivateKey = testUser._.sea.priv;
      const ethPrivateKey = walletManager.convertToEthPk(gunPrivateKey);

      expect(ethPrivateKey).to.be.a("string");
      expect(ethPrivateKey).to.match(/^0x[0-9a-f]{64}$/i);

      // Verifica che sia una chiave privata valida creando un wallet
      const wallet = new ethers.Wallet(ethPrivateKey);
      expect(ethers.isAddress(wallet.address)).to.be.true;
    });

    it("should save and retrieve a wallet", async function () {
      console.log("Starting save and retrieve wallet test");
      console.log("Checking authentication status:", !!testUser.is);
      
      console.log("Creating new wallet...");
      const wallet = ethers.Wallet.createRandom();
      
      console.log("Saving wallet...");
      await walletManager.saveWallet(wallet);

      console.log("Retrieving all wallets...");
      const wallets = await walletManager.getWallets();
      console.log(`Retrieved ${wallets.length} wallets`);
      
      console.log("Looking for saved wallet...");
      const savedWallet = wallets.find(w => 
        w.address.toLowerCase() === wallet.address.toLowerCase()
      );

      expect(savedWallet, "Il wallet salvato non è stato trovato").to.not.be.undefined;
      expect(savedWallet.address.toLowerCase()).to.equal(wallet.address.toLowerCase());
      expect(savedWallet.privateKey).to.equal(wallet.privateKey);
      console.log("Save and retrieve wallet test completed successfully");
    });
  });
});
