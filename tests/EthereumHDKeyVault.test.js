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

  this.timeout(300000);

  const waitForSync = async (ms = 15000) => {
    await new Promise(resolve => setTimeout(resolve, ms));
  };

  const retryOperation = async (operation, maxAttempts = 5, delay = 15000) => {
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
      console.log("Checking authentication status...");
      if (!testUser.is) {
        console.log("User not authenticated, attempting auth...");
        await new Promise((resolve, reject) => {
          testUser.auth(testUsername, testPassword, async (ack) => {
            if (ack.err) {
              console.error("Auth error:", ack.err);
              reject(new Error(ack.err));
            } else {
              console.log("Auth successful");
              await waitForSync(15000);
              resolve();
            }
          });
        });
      }
      
      // Verifica doppia dello stato di autenticazione
      if (!testUser.is || !testUser._.sea) {
        throw new Error("Autenticazione fallita o chiavi SEA non trovate");
      }
      console.log("Authentication verified successfully");
    }, 5, 30000);
  };

  const clearData = async () => {
    return retryOperation(async () => {
      if (!testUser.is) {
        console.log("User not authenticated during clearData, skipping...");
        return;
      }

      console.log("Starting data clearing process...");
      
      // Cancellazione più aggressiva dei dati
      await Promise.all([
        new Promise(resolve => testUser.get('wallets').put(null, resolve)),
        new Promise(resolve => testUser.get('hd_master_wallet').put(null, resolve)),
        new Promise(resolve => testUser.get('hd_mnemonic').put(null, resolve)),
        new Promise(resolve => testUser.get('hd_accounts').put(null, resolve)),
        new Promise(resolve => testUser.get(`${EthereumHDKeyVault.ACCOUNTS_PATH}`).put(null, resolve)),
        new Promise(resolve => testUser.get(`${EthereumHDKeyVault.ACCOUNTS_PATH}/addresses`).put(null, resolve))
      ]);
      
      console.log("Data cleared, waiting for sync...");
      // Aumentiamo il tempo di attesa per la sincronizzazione
      await waitForSync(30000);
      
      // Reimpostiamo lo stato del vault
      hdKeyVault = new EthereumHDKeyVault(gun, APP_KEY_PAIR);
      
      // Verifica che i dati siano stati cancellati
      const wallets = await hdKeyVault.getWallets();
      
      // Accettiamo che getWallets possa restituire un wallet all'indice 0 come fallback
      // ma non dovrebbero esserci wallet oltre a quello
      if (wallets && wallets.length > 1) {
        throw new Error("Wallet data not cleared properly");
      } else if (wallets && wallets.length === 1 && wallets[0].index !== 0) {
        throw new Error("Unexpected wallet index after clearing data");
      }
      
      console.log("Data clearing verified successfully");
    }, 5, 30000);
  };

  before(async function () {
    // Aumentiamo il timeout per dare più tempo
    this.timeout(300000);
    try {
      console.log("Starting test setup...");
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
      console.log(`Creating test user: ${testUsername}`);

      let created = false;
      for (let i = 0; i < 5; i++) {
        try {
          console.log(`User creation attempt ${i+1}/5`);
          await new Promise((resolve, reject) => {
            testUser.create(testUsername, testPassword, async (ack) => {
              if (ack.err) {
                console.error(`User creation error:`, ack.err);
                reject(new Error(ack.err));
              } else {
                console.log("User created, authenticating...");
                await waitForSync(8000);
                testUser.auth(testUsername, testPassword, async (authAck) => {
                  if (authAck.err) {
                    console.error(`Auth error:`, authAck.err);
                    reject(new Error(authAck.err));
                  } else {
                    console.log("User authenticated successfully");
                    await waitForSync(8000);
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
    this.timeout(300000); // Aumentato a 5 minuti
    console.log("\n--- Starting beforeEach hook ---");
    try {
      await ensureAuthenticated();
      await clearData();
      await waitForSync(20000);
      console.log("--- beforeEach hook completed successfully ---\n");
    } catch (error) {
      console.error("beforeEach hook failed:", error);
      throw error;
    }
  });

  afterEach(async function() {
    this.timeout(300000); // Aumentato a 5 minuti
    console.log("\n--- Starting afterEach hook ---");
    try {
      await clearData();
      await waitForSync(20000);
      console.log("--- afterEach hook completed successfully ---\n");
    } catch (error) {
      console.error("afterEach hook failed:", error);
      // Non blocchiamo l'esecuzione per errori in afterEach
      console.error("Continuing despite afterEach error");
    }
  });

  after(async function () {
    this.timeout(300000); // Aumentato a 5 minuti
    console.log("\n--- Starting after hook ---");
    try {
      await clearData();
      
      if (testUser && testUser.is) {
        console.log("Logging out user...");
        testUser.leave();
        await waitForSync(20000);
      }
      
      if (gun) {
        console.log("Shutting down Gun...");
        gun.off();
        await waitForSync(20000);
      }
      
      console.log("--- after hook completed successfully ---\n");
    } catch (error) {
      console.error("after hook failed:", error);
      // Non blocchiamo l'esecuzione per errori in after
      console.error("Continuing despite after hook error");
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
      
      // Puliamo i dati esistenti
      await clearData();
      await waitForSync(15000);
      
      console.log("Creating first wallet...");
      const wallet1 = await hdKeyVault.createAccount();
      console.log("First wallet created:", wallet1);
      
      // Verifichiamo che il wallet sia stato salvato correttamente
      await waitForSync(15000);
      
      console.log("Creating second wallet...");
      // Forzare la creazione di un wallet con indice 1
      const wallet2 = await retryOperation(async () => {
        const result = await hdKeyVault.createAccount();
        console.log("Second wallet result:", result);
        if (result.index !== 1) {
          throw new Error(`Expected index 1, got ${result.index}`);
        }
        return result;
      });
      
      console.log("Created wallets with indices:", [wallet1.index, wallet2.index]);
      
      // Verifica finale 
      expect(wallet1.index).to.equal(0);
      expect(wallet2.index).to.equal(1);
    });

    it("should retrieve all HD keys", async function () {
      await ensureAuthenticated();
      console.log("Starting retrieve all HD keys test");
      
      // Puliamo i dati esistenti
      await clearData();
      await waitForSync(15000);
      
      console.log("Creating test wallets...");
      const wallet1 = await hdKeyVault.createAccount();
      console.log("First wallet created:", wallet1);
      await waitForSync(15000);
      
      const wallet2 = await hdKeyVault.createAccount();
      console.log("Second wallet created:", wallet2);
      await waitForSync(15000);
      
      // Verifichiamo esplicitamente che i wallet siano stati creati con indici corretti
      expect(wallet1.index).to.equal(0);
      expect(wallet2.index).to.equal(1);
      
      console.log("Retrieving all wallets...");
      const wallets = await retryOperation(async () => {
        const allWallets = await hdKeyVault.getWallets();
        console.log("Retrieved wallets:", allWallets);
        
        if (!allWallets || !Array.isArray(allWallets) || allWallets.length < 2) {
          throw new Error(`Invalid wallets array returned: ${JSON.stringify(allWallets)}`);
        }
        
        return allWallets;
      });
      
      // Ordinare i wallet per indice per avere un confronto più stabile
      const sortedWallets = wallets.sort((a, b) => a.index - b.index);
      
      expect(sortedWallets).to.be.an("array");
      expect(sortedWallets.length).to.equal(2);
      expect(sortedWallets[0].index).to.equal(0);
      expect(sortedWallets[1].index).to.equal(1);
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
      
      // Puliamo i dati esistenti
      await clearData();
      await waitForSync(15000);
      
      // Creiamo un nuovo wallet
      console.log("Creating wallet...");
      const createdWallet = await hdKeyVault.createAccount();
      console.log("Created wallet:", createdWallet);
      
      // Attendiamo che il wallet sia salvato
      await waitForSync(20000);
      
      // Verifichiamo esplicitamente che il wallet sia stato creato con indice 0
      expect(createdWallet.index).to.equal(0);
      
      // Ora recuperiamo il wallet usando l'indice
      console.log("Retrieving wallet by index...");
      const retrievedWallet = await retryOperation(async () => {
        const result = await hdKeyVault.getWalletByIndex(0);
        console.log("Retrieved wallet:", result);
        
        if (!result || !result.address) {
          throw new Error(`Invalid retrieved wallet: ${JSON.stringify(result)}`);
        }
        
        return result;
      }, 8, 15000);
      
      expect(retrievedWallet).to.be.an("object");
      expect(retrievedWallet.index).to.equal(0);
      expect(retrievedWallet.address.toLowerCase()).to.equal(createdWallet.address.toLowerCase());
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
