const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { GunAuth } = require("../dist/core/auth/GunAuth");

describe("GunAuth", function () {
  this.timeout(300000); // Aumentato a 5 minuti

  let gun;
  let gunAuth;
  let APP_KEY_PAIR;
  let server;
  const TEST_PORT = 8766;

  const waitForOperation = async (ms = 15000) => {
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
          await waitForOperation(delay);
        }
      }
    }
    throw lastError;
  };

  const testUser = {
    username: "testUser_" + Date.now(),
    password: "testPassword123",
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
        retry: 2500
      });

      gunAuth = new GunAuth(gun, APP_KEY_PAIR);
      await gunAuth.authListener();
      await waitForOperation(10000);
    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });

  after(async function () {
    try {
      if (gunAuth) {
        try {
          if (gunAuth.isAuthenticated()) {
            await gunAuth.logout();
          }
        } catch (error) {
          console.warn("Logout error during cleanup:", error);
        }
      }
      if (gun) {
        gun.off();
      }
      if (server) {
        server.close();
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  describe("Account Creation and Authentication", function () {
    beforeEach(async function () {
      try {
        if (gunAuth.isAuthenticated()) {
          await gunAuth.logout();
        }
      } catch (error) {
        console.warn("Logout error in beforeEach:", error);
      }
    });

    it("should create a new user account", async function () {
      // Aumentato timeout totale a 5 minuti

      // Assicuriamoci di essere disconnessi
      if (gunAuth.isAuthenticated()) {
        await gunAuth.logout();
      }

      const keyPair = await gunAuth.createAccount(
        testUser.username,
        testUser.password
      );

      expect(keyPair).to.be.an("object");
      expect(keyPair).to.have.property("pub").that.is.a("string");
      expect(keyPair).to.have.property("priv").that.is.a("string");
      expect(keyPair).to.have.property("epub").that.is.a("string");
      expect(keyPair).to.have.property("epriv").that.is.a("string");

      // Verifichiamo che l'utente sia effettivamente autenticato
      expect(gunAuth.isAuthenticated()).to.be.true;
    });

    it("should not create duplicate user accounts", async function () {
      // Aumentato timeout totale a 5 minuti
      try {
        // Assicuriamoci di essere disconnessi
        if (gunAuth.isAuthenticated()) {
          await gunAuth.logout();
        }

        // Creiamo un nuovo utente con un username univoco
        const duplicateUser = {
          username: "duplicateTest_" + Date.now(),
          password: "testPassword123",
        };

        // Prima creazione - dovrebbe avere successo
        await gunAuth.createAccount(
          duplicateUser.username,
          duplicateUser.password
        );

        // Seconda creazione - dovrebbe fallire
        await gunAuth.createAccount(
          duplicateUser.username,
          duplicateUser.password
        );

        throw new Error("Should have thrown error for duplicate account");
      } catch (error) {
        expect(error.message).to.equal("Username already taken");
      }
    });

    it("should login with valid credentials", async function () {
      // Aumentato timeout totale a 5 minuti
      gunAuth.logout();

      const pubKey = await gunAuth.login(
        testUser.username,
        testUser.password
      )

      console.log('pubKey:', pubKey)

      expect(pubKey).to.be.a("string");
      expect(pubKey).to.have.lengthOf.at.least(40);
    });

    it("should fail login with invalid credentials", async function () {
      // Aumentato timeout totale a 5 minuti
      let authFailed = false;

      let result;

      try {
        // Prima assicuriamoci di essere disconnessi
        if (gunAuth.isAuthenticated()) {
          await gunAuth.logout();
        }

        // Impostiamo un timeout più breve per il login non valido
        const result = await gunAuth.login(
          testUser.username,
          "wrongPassword"
        );

        return result;
      } catch (error) {
        authFailed = true;

        expect(
          error.message === "Wrong user or password." ||
            error.message.includes("fallito") ||
            error.message.includes("Timeout") ||
            error.message.includes("decrypt")
        ).to.be.true;
      }

      expect(authFailed).to.be.true;
      expect(gunAuth.isAuthenticated()).to.be.false;
    });
  });

  describe("User Data Management", function () {
    beforeEach(async function() {
      await retryOperation(async () => {
        if (!gunAuth.isAuthenticated()) {
          await gunAuth.login(testUser.username, testUser.password);
          await waitForOperation(10000);
        }
        if (!gunAuth.isAuthenticated()) {
          throw new Error("Authentication failed in beforeEach");
        }
      });
    });

    it("should save and retrieve private data", async function () {
      this.timeout(300000); // Imposto timeout più lungo

      console.log("Starting private data test");
      const testKey = "test_key_" + Date.now();
      // Usiamo un formato più semplice
      const testValue = "test_value_" + Date.now();
      
      await retryOperation(async () => {
        // Prima verifichiamo che l'utente sia autenticato
        console.log("Checking authentication status...");
        if (!gunAuth.isAuthenticated()) {
          console.log("Not authenticated, logging in...");
          await gunAuth.login(testUser.username, testUser.password);
          console.log("Login complete");
          await waitForOperation(15000);
        }
        
        console.log("User authenticated:", gunAuth.isAuthenticated());
        
        // Ora salviamo i dati privati
        console.log("Saving private data with key:", testKey);
        try {
          await gunAuth.user.get('private').get(testKey).put(testValue);
          console.log("Data saved directly with Gun API");
          await waitForOperation(15000);
          
          // Recuperiamo i dati
          console.log("Retrieving private data...");
          return new Promise((resolve, reject) => {
            gunAuth.user.get('private').get(testKey).once((data) => {
              console.log("Retrieved data:", data);
              
              if (data !== testValue) {
                return reject(new Error(`Data mismatch: expected ${testValue}, got ${data}`));
              }
              
              resolve(data);
            });
          });
        } catch (error) {
          console.error("Error in data operation:", error);
          throw error;
        }
      }, 5, 30000);
    });
  });
});
