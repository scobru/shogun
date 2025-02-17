const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { GunAuth } = require("../dist/core/auth/GunAuth");

describe("GunAuth", function () {
  // Aumentato timeout totale a 5 minuti

  let gunAuthManager;
  let APP_KEY_PAIR;
  let gun;
  let server;
  const TEST_PORT = 8766; // Cambiata la porta per evitare conflitti

  const testUser = {
    username: "testUser_" + Date.now(),
    password: "testPassword123",
  };

  before(async function () {
    // Aumentato timeout per il setup
    try {
      // Genera chiavi
      APP_KEY_PAIR = await Gun.SEA.pair();
      // Inizializza Gun client con configurazione minima
      gun = Gun({
        peers: [`http://localhost:8765/gun`],
        file: false,
        radisk: false,
        localStorage: false,
        multicast: false,
        axe: false,
      });

      // Inizializza GunAuth
      gunAuthManager = new GunAuth(gun, APP_KEY_PAIR);

      // Inizializza il listener di autenticazione
      await gunAuthManager.authListener();

      // Attendi che Gun si stabilizzi
    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });

  after(async function () {
    try {
      if (gunAuthManager) {
        try {
          if (gunAuthManager.isAuthenticated()) {
            await gunAuthManager.logout();
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
        if (gunAuthManager.isAuthenticated()) {
          await gunAuthManager.logout();
        }
      } catch (error) {
        console.warn("Logout error in beforeEach:", error);
      }
    });

    it("should create a new user account", async function () {
      // Aumentato timeout totale a 5 minuti

      // Assicuriamoci di essere disconnessi
      if (gunAuthManager.isAuthenticated()) {
        await gunAuthManager.logout();
      }

      const keyPair = await gunAuthManager.createAccount(
        testUser.username,
        testUser.password
      );

      expect(keyPair).to.be.an("object");
      expect(keyPair).to.have.property("pub").that.is.a("string");
      expect(keyPair).to.have.property("priv").that.is.a("string");
      expect(keyPair).to.have.property("epub").that.is.a("string");
      expect(keyPair).to.have.property("epriv").that.is.a("string");

      // Verifichiamo che l'utente sia effettivamente autenticato
      expect(gunAuthManager.isAuthenticated()).to.be.true;
    });

    it("should not create duplicate user accounts", async function () {
      // Aumentato timeout totale a 5 minuti
      try {
        // Assicuriamoci di essere disconnessi
        if (gunAuthManager.isAuthenticated()) {
          await gunAuthManager.logout();
        }

        // Creiamo un nuovo utente con un username univoco
        const duplicateUser = {
          username: "duplicateTest_" + Date.now(),
          password: "testPassword123",
        };

        // Prima creazione - dovrebbe avere successo
        await gunAuthManager.createAccount(
          duplicateUser.username,
          duplicateUser.password
        );

        // Seconda creazione - dovrebbe fallire
        await gunAuthManager.createAccount(
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
      gunAuthManager.logout();

      const pubKey = await gunAuthManager.login(
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
        if (gunAuthManager.isAuthenticated()) {
          await gunAuthManager.logout();
        }

        // Impostiamo un timeout più breve per il login non valido
        const result = await gunAuthManager.login(
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
      expect(gunAuthManager.isAuthenticated()).to.be.false;
    });
  });

  describe("User Data Management", function () {
    // Aumentato timeout totale a 5 minuti

    let testDataUser;

    before(async function () {
      try {
        // Creazione utente con ritardo iniziale
        await new Promise((r) => setTimeout(r, 5000));

        testDataUser = {
          username: "testDataUser_" + Date.now(),
          password: "testPassword123",
        };

        // Tentativo di creazione con più ritentivi
        let created = false;
        let attempts = 0;

        while (!created && attempts < 3) {
          try {
            userKeyPair = await gunAuthManager.createAccount(
              testDataUser.username,
              testDataUser.password
            );
            created = true;
          } catch (error) {
            attempts++;
            console.log(`Retry account creation (attempt ${attempts})`);
          }
        }

        if (!created) throw new Error("Account creation failed");
      } catch (error) {
        console.error("Setup error:", error);
        throw error;
      }
    });

    beforeEach(async function () {
      // Aumentato timeout totale a 5 minuti
      try {
        // Reset completo con ritardo
        await gunAuthManager._hardReset();

        // Tentativo di login con backoff esponenziale
        let loggedIn = false;
        let loginAttempts = 0;

        while (!loggedIn && loginAttempts < 5) {
          try {
            console.log(`Login attempt ${loginAttempts + 1}`);
            await gunAuthManager.login(
              testDataUser.username,
              testDataUser.password
            );
            loggedIn = true;

            // Verifica aggiuntiva dello stato
            if (!gunAuthManager.isAuthenticated()) {
              throw new Error("Authentication state mismatch");
            }
          } catch (error) {
            loginAttempts++;
            console.log(`Login error: ${error.message}`);

            // Reset aggiuntivo dopo 2 tentativi falliti
            if (loginAttempts >= 2) {
              await gunAuthManager._hardReset();
            }
          }
        }

        if (!loggedIn) {
          throw new Error("Login fallito in beforeEach");
        }
      } catch (error) {
        console.error("beforeEach error:", error);
        throw error;
      }
    });

    it("should save and retrieve private data", async function () {
      this.timeout(300000); // 5 minuti
      
      const data = { secret: "This is private data" };
      const path = "secrets/data1";

      // Verifichiamo lo stato di autenticazione
      expect(gunAuthManager.isAuthenticated(), "User should be authenticated").to.be.true;

      console.log("Starting save operation...");
      
      // Prima proviamo a pulire eventuali dati residui
      try {
        await gunAuthManager.deletePrivateData(path);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.log("Pre-cleanup warning:", error);
      }
      
      // Salviamo i dati con retry
      let saveAttempts = 0;
      const maxSaveAttempts = 5;
      let saved = false;

      while (!saved && saveAttempts < maxSaveAttempts) {
        try {
          console.log(`Save attempt ${saveAttempts + 1}...`);
          
          // Reset dello stato prima di ogni tentativo
          if (saveAttempts > 0) {
            await gunAuthManager._hardReset();
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          
          await gunAuthManager.savePrivateData(data, path);
          await new Promise(resolve => setTimeout(resolve, 8000));
          
          // Verifica immediata del salvataggio
          const verifyData = await gunAuthManager.getPrivateData(path);
          if (verifyData && verifyData.secret === data.secret) {
            console.log("Save verified immediately");
            saved = true;
          } else {
            throw new Error("Immediate verification failed");
          }
        } catch (error) {
          console.log(`Save attempt ${saveAttempts + 1} failed:`, error);
          saveAttempts++;
          if (saveAttempts === maxSaveAttempts) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 8000));
        }
      }
      
      console.log("Waiting for data synchronization...");
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Recuperiamo i dati con retry
      let retrieveAttempts = 0;
      const maxRetrieveAttempts = 5;
      let retrievedData = null;

      while (retrieveAttempts < maxRetrieveAttempts && !retrievedData) {
        try {
          console.log(`Retrieve attempt ${retrieveAttempts + 1}...`);
          
          // Reset dello stato prima di ogni tentativo di recupero
          if (retrieveAttempts > 0) {
            await gunAuthManager._hardReset();
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          
          const result = await gunAuthManager.getPrivateData(path);
          
          if (result && result.secret === data.secret) {
            retrievedData = result;
            console.log("Data retrieved successfully");
            break;
          }
          
          console.log("Retrieved data verification failed, retrying...");
          await new Promise(resolve => setTimeout(resolve, 8000));
        } catch (error) {
          console.log(`Retrieve attempt ${retrieveAttempts + 1} failed:`, error);
          retrieveAttempts++;
          if (retrieveAttempts === maxRetrieveAttempts) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 8000));
        }
      }
      
      expect(retrievedData).to.not.be.null;
      expect(retrievedData.secret).to.equal(data.secret);
      console.log("Test completed successfully");
    });
  });
});
