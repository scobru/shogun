const chai = require("chai");
const { expect } = chai;
const Gun = require("gun");
require("gun/sea");
const { GunAuthManager } = require("../dist/managers/GunAuthManager");

describe("GunAuthManager", function () {
  this.timeout(5000); // Aumentato timeout totale a 5 minuti

  let gunAuthManager;
  let APP_KEY_PAIR;
  let gun;
  let server;
  const TEST_PORT = 8766; // Cambiata la porta per evitare conflitti

  const testUser = {
    username: "testUser_" + Date.now(),
    password: "testPassword123",
  };

  const waitForAuth = async (ms = 5000) => {
    await new Promise(resolve => setTimeout(resolve, ms));
  };

  before(async function () {
    this.timeout(10000); // Aumentato timeout per il setup
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
        axe: false
      });

      // Inizializza GunAuthManager
      gunAuthManager = new GunAuthManager(gun, APP_KEY_PAIR);
      
      // Attendi che il server sia pronto
      await waitForAuth(3000);
      
      // Inizializza il listener di autenticazione
      await gunAuthManager.authListener();
      
      // Attendi che Gun si stabilizzi
      await waitForAuth(2000);
    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });

  after(async function () {
    this.timeout(300000); // Aumentato timeout per la cleanup
    try {
      if (gunAuthManager) {
        try {
          if (gunAuthManager.isAuthenticated()) {
            await gunAuthManager.logout();
            await waitForAuth(2000);
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
      await waitForAuth(2000);
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  describe("Account Creation and Authentication", function () {
    this.timeout(300000);

    beforeEach(async function () {
      try {
        if (gunAuthManager.isAuthenticated()) {
          await gunAuthManager.logout();
          await waitForAuth(5000);
        }
      } catch (error) {
        console.warn("Logout error in beforeEach:", error);
      }
    });

    it("should create a new user account", async function () {
      this.timeout(180000);
      
      // Assicuriamoci di essere disconnessi
      if (gunAuthManager.isAuthenticated()) {
        await gunAuthManager.logout();
        await waitForAuth(3000);
      }
      
      await waitForAuth(3000); // Attendi prima di creare l'account
      
      const keyPair = await gunAuthManager.createAccount(
        testUser.username,
        testUser.password
      );
      
      await waitForAuth(5000); // Aumentiamo il tempo di attesa dopo la creazione
      
      expect(keyPair).to.be.an("object");
      expect(keyPair).to.have.property("pub").that.is.a("string");
      expect(keyPair).to.have.property("priv").that.is.a("string");
      expect(keyPair).to.have.property("epub").that.is.a("string");
      expect(keyPair).to.have.property("epriv").that.is.a("string");
      
      // Verifichiamo che l'utente sia effettivamente autenticato
      expect(gunAuthManager.isAuthenticated()).to.be.true;
    });

    it("should not create duplicate user accounts", async function () {
      this.timeout(120000);
      try {
        // Assicuriamoci di essere disconnessi
        if (gunAuthManager.isAuthenticated()) {
          await gunAuthManager.logout();
          await waitForAuth(3000);
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
        
        await waitForAuth(5000);
        
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
      this.timeout(120000);
      await gunAuthManager.logout();
      await waitForAuth(5000);
      
      const pubKey = await gunAuthManager.login(testUser.username, testUser.password);
      expect(pubKey).to.be.a('string');
      expect(pubKey).to.have.lengthOf.at.least(40);
      expect(gunAuthManager.isAuthenticated()).to.be.true;
    });

    it("should fail login with invalid credentials", async function () {
      this.timeout(90000);
      let authFailed = false;
      
      try {
        // Prima assicuriamoci di essere disconnessi
        if (gunAuthManager.isAuthenticated()) {
          await gunAuthManager.logout();
          await waitForAuth(5000);
        }

        // Impostiamo un timeout più breve per il login non valido
        const loginPromise = gunAuthManager.login(testUser.username, "wrongPassword");
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout durante il login")), 30000)
        );

        await Promise.race([loginPromise, timeoutPromise]);
      } catch (error) {
        authFailed = true;
        expect(
          error.message === "Credenziali non valide" ||
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
    this.timeout(300000);

    let testDataUser;

    before(async function() {
      this.timeout(300000);
      try {
        // Creazione utente con ritardo iniziale
        await new Promise(r => setTimeout(r, 5000));
        
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
            await waitForAuth(10000 * attempts);
          }
        }

        if (!created) throw new Error("Account creation failed");
        
        await waitForAuth(20000); // Attesa estesa dopo la creazione
      } catch (error) {
        console.error("Setup error:", error);
        throw error;
      }
    });

    beforeEach(async function () {
      this.timeout(180000);
      try {
        // Reset completo con ritardo
        await gunAuthManager._hardReset();
        await waitForAuth(10000);

        // Tentativo di login con backoff esponenziale
        let loggedIn = false;
        let loginAttempts = 0;
        
        while (!loggedIn && loginAttempts < 5) {
          try {
            console.log(`Login attempt ${loginAttempts + 1}`);
            await gunAuthManager.login(testDataUser.username, testDataUser.password);
            loggedIn = true;
            
            // Verifica aggiuntiva dello stato
            if (!gunAuthManager.isAuthenticated()) {
              throw new Error("Authentication state mismatch");
            }
          } catch (error) {
            loginAttempts++;
            console.log(`Login error: ${error.message}`);
            await waitForAuth(5000 * loginAttempts);
            
            // Reset aggiuntivo dopo 2 tentativi falliti
            if (loginAttempts >= 2) {
              await gunAuthManager._hardReset();
              await waitForAuth(10000);
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
      this.timeout(180000);
      const data = { secret: "This is private data" };
      const path = "secrets/data1";

      await gunAuthManager.savePrivateData(data, path);
      const retrievedData = await gunAuthManager.getPrivateData(path);

      // Verifica solo il contenuto effettivo ignorando i metadati GUN
      expect(retrievedData).to.have.nested.property('secret', data.secret);
      
      // Opzione alternativa: pulizia dei metadati
      const cleanData = JSON.parse(JSON.stringify(retrievedData));
      delete cleanData._;
      delete cleanData['#'];
      expect(cleanData).to.deep.equal(data);
    });
  });
});

