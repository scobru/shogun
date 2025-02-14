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
  let testPassword;

  // Aumentiamo il timeout globale per tutti i test
  this.timeout(180000); // Aumentato a 3 minuti

  const waitForSync = async (ms = 10000) => {
    console.log(`Waiting ${ms}ms for synchronization...`);
    await new Promise(resolve => setTimeout(resolve, ms));
  };

  const waitForOperation = async (ms = 5000) => {
    console.log(`Waiting ${ms}ms for operation...`);
    await new Promise(resolve => setTimeout(resolve, ms));
  };

  const ensureAuthenticated = async () => {
    if (!testUser.is) {
      console.log("User not authenticated, attempting to re-authenticate...");
      await new Promise((resolve, reject) => {
        testUser.auth(testUsername, testPassword, async (ack) => {
          if (ack.err) {
            console.error("Re-authentication failed:", ack.err);
            reject(ack.err);
          } else {
            await waitForSync(5000);
            console.log("Re-authentication successful");
            resolve();
          }
        });
      });
    }
    return testUser.is;
  };

  before(async function () {
    try {
      // Genera chiavi
      APP_KEY_PAIR = await Gun.SEA.pair();

      // Inizializza Gun client con configurazione migliorata
      gun = Gun({
        peers: [`http://localhost:8765/gun`],
        file: false,
        radisk: false,
        localStorage: false,
        multicast: false,
        axe: false,
        retry: 2500,
      });

      // Inizializza WalletManager
      walletManager = new WalletManager(gun, APP_KEY_PAIR);

      // Crea un utente di test
      testUser = gun.user();
      testUsername = `testUser_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      testPassword = "password123";

      // Aggiungi tentativi multipli per la creazione e autenticazione
      let created = false;
      for (let i = 0; i < 3; i++) {
        try {
          await new Promise((resolve, reject) => {
            testUser.create(testUsername, testPassword, async (ack) => {
              if (ack.err) reject(ack.err);
              else {
                await waitForSync(5000);
                // Dopo la creazione, effettua il login
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

      // Verifica che l'utente sia autenticato
      if (!testUser.is) {
        throw new Error("Failed to authenticate user after creation");
      }

    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });

  beforeEach(async function() {
    // Verifichiamo l'autenticazione prima di ogni test
    await ensureAuthenticated();
    await waitForSync(5000);
  });

  afterEach(async function() {
    // Verifichiamo l'autenticazione dopo ogni test
    await ensureAuthenticated();
  });

  after(async function () {
    try {
      await ensureAuthenticated();
      if (testUser && testUser.is) {
        // Pulizia dei dati prima di uscire
        await new Promise(resolve => {
          testUser.get('private').get('wallets').put(null, () => {
            testUser.leave();
            resolve();
          });
        });
      }
      if (gun) {
        gun.off();
      }
      await waitForSync(5000);
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  describe("Wallet Creation and Management", function () {
    it("should create a new wallet", async function () {
      await ensureAuthenticated();
      console.log("Starting create wallet test");
      
      const walletData = await walletManager.createAccount();
      await waitForOperation(5000); // Aumentato il tempo di attesa
      
      expect(walletData).to.be.an("object");
      expect(walletData.ethereum).to.be.an("array");
      expect(walletData.ethereum[0]).to.have.property("address").that.is.a("string");
      expect(walletData.ethereum[0]).to.have.property("privateKey").that.is.a("string");
      expect(walletData.ethereum[0]).to.have.property("entropy").that.is.a("string");
      expect(walletData.ethereum[0]).to.have.property("timestamp").that.is.a("number");

      expect(ethers.isAddress(walletData.ethereum[0].address)).to.be.true;
      console.log("Wallet creation test completed successfully");
    });

    it("should retrieve all wallets", async function () {
      await ensureAuthenticated();
      console.log("Starting retrieve wallets test");
      console.log("Checking authentication status:", !!testUser.is);

      // Prima creiamo un nuovo wallet
      console.log("Creating new wallet for retrieval test...");
      const newWallet = ethers.Wallet.createRandom();
      await walletManager.save(newWallet);
      await waitForSync();
      console.log("Test wallet saved with address:", newWallet.address.toLowerCase());

      console.log("Creating new wallet for retrieval test...");
      const newWallet2 = ethers.Wallet.createRandom();
      await walletManager.save(newWallet2);
      await waitForSync();
      console.log("Test wallet saved with address:", newWallet2.address.toLowerCase());

      await ensureAuthenticated();
      console.log("Retrieving wallets...");
      const wallets = await walletManager.getWallets();
      console.log(`Retrieved ${wallets.length} wallets`);

      expect(wallets).to.be.an("array");
      expect(wallets.length).to.be.at.least(1);

      // Verifichiamo che il wallet appena creato sia presente
      console.log("Checking if new wallet exists in the list...");
      const foundWallet = wallets.find(w =>
        w.address.toLowerCase() === newWallet.address.toLowerCase()
      );
      console.log("Found wallet:", foundWallet);
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
      this.timeout(60000); // Aumentato a 60 secondi
      console.log("Starting save and retrieve wallet test");
      console.log("Checking authentication status:", !!testUser.is);
      
      console.log("Creating new wallet...");
      const wallet = ethers.Wallet.createRandom();
      
      console.log("Saving wallet...");
      await walletManager.save(wallet);

      // Attendiamo un po' per assicurarci che i dati siano sincronizzati
      await new Promise(resolve => setTimeout(resolve, 5000));

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
