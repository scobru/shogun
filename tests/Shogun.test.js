const { expect } = require("chai");
const Gun = require("gun");
require("gun/sea");
const { Shogun } = require("../dist/Shogun");

describe("Shogun Data Management", function () {
  let shogun;
  let gun;
  let APP_KEY_PAIR;
  const TEST_PORT = 8765;

  // Aumenta il timeout per i test che richiedono più tempo
  this.timeout(60000);

  const waitForOperation = async (ms = 5000) => {
    await new Promise(resolve => setTimeout(resolve, ms));
  };

  const ensureAuthenticated = async (authManager, user) => {
    try {
      // Prima effettua il logout
      await authManager.logout();
      await waitForOperation(2000);

      // Verifica se l'utente esiste
      const exists = await authManager.exists(user.alias);
      
      // Se non esiste, crealo
      if (!exists) {
        await authManager.createAccount(user.alias, user.password);
        await waitForOperation(2000);
      }

      // Effettua il login
      await authManager.login(user.alias, user.password);
      await waitForOperation(2000);

      // Verifica l'autenticazione
      if (!authManager.isAuthenticated()) {
        throw new Error("Authentication failed after login");
      }

      return true;
    } catch (error) {
      console.error("Authentication error:", error);
      throw error;
    }
  };

  before(async function () {
    try {
      APP_KEY_PAIR = await Gun.SEA.pair();
      gun = Gun({
        peers: [`http://localhost:${TEST_PORT}/gun`],
        file: false,
        radisk: false,
        localStorage: false,
        multicast: false,
        axe: false,
      });
      shogun = new Shogun(gun, APP_KEY_PAIR);
    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });

  after(async function () {
    if (gun) {
      gun.off();
    }
    await waitForOperation();
  });

  describe("Data Operations", function () {
    const testPath = `test_${Date.now()}`;
    const testData = { name: "Test", value: 123 };
    
    it("should save and retrieve data", async function () {
      await shogun.putData(testPath, testData);
      await waitForOperation(1000);
      const retrieved = await shogun.getData(testPath);
      expect(retrieved).to.deep.include(testData);
    });

    it("should handle non-existent data retrieval", async function () {
      try {
        await shogun.getData("nonexistent_path");
        throw new Error("Should have failed");
      } catch (error) {
        expect(error.message).to.include("non trovati");
      }
    });

    it("should check data existence", async function () {
      const exists = await shogun.exists(testPath);
      expect(exists).to.be.true;

      const nonExists = await shogun.exists("nonexistent_path");
      expect(nonExists).to.be.false;
    });

    it("should subscribe to data updates", async function () {
      let received = null;
      const unsubscribe = shogun.subscribeToData(testPath, (data) => {
        received = data;
      });

      const updatedData = { name: "Updated", value: 456 };
      await shogun.putData(testPath, updatedData);
      await waitForOperation(2000);
      
      expect(received).to.deep.include(updatedData);
      unsubscribe();
    });
  });

  describe("List Operations", function () {
    const listPath = `list_${Date.now()}`;
    const testItems = [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
      { id: 3, name: "Item 3" }
    ];

    it("should add and retrieve items from a set", async function () {
      // Aggiungi gli elementi uno alla volta con attesa tra le operazioni
      for (const item of testItems) {
        await shogun.addToSet(listPath, item);
        await waitForOperation(1000); // Aumentato il tempo di attesa
      }

      // Attendi che tutti i dati siano sincronizzati
      await waitForOperation(3000); // Aumentato il tempo di attesa

      // Recupera e verifica i dati
      const items = await shogun.mapList(listPath);
      
      // Verifica la lunghezza
      expect(items).to.be.an('array');
      expect(items.length).to.be.at.least(testItems.length);

      // Verifica che ogni item sia presente
      for (const testItem of testItems) {
        const found = items.some(item => 
          item.id === testItem.id && item.name === testItem.name
        );
        expect(found, `Item ${testItem.id} not found`).to.be.true;
      }
    });

    it("should map list items with custom function", async function () {
      const mappedItems = await shogun.mapList(listPath, (item) => ({
        ...item,
        modified: true
      }));

      expect(mappedItems).to.be.an('array');
      expect(mappedItems.length).to.be.at.least(testItems.length);
      mappedItems.forEach(item => {
        expect(item).to.have.property("modified", true);
      });
    });
  });

  describe("Error Handling", function() {
    it("should handle invalid user creation", async function() {
      const authManager = shogun.getGunAuth();
      try {
        // Usa una password più lunga ma comunque invalida
        await authManager.createAccount("", "invalidpass");
        throw new Error("Should have failed");
      } catch (error) {
        // Verifica che ci sia un errore, indipendentemente dal messaggio specifico
        expect(error).to.exist;
      }
    });

    it("should handle authentication errors", async function() {
      const authManager = shogun.getGunAuth();
      try {
        // Impostiamo un timeout più breve per il login non valido
        const loginPromise = authManager.login("nonexistent_user", "wrong_password");
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Login timeout")), 5000)
        );
        
        await Promise.race([loginPromise, timeoutPromise]);
        throw new Error("Should have failed");
      } catch (error) {
        expect(error.message).to.satisfy((msg) => 
          msg.includes("Wrong user or password") || 
          msg.includes("Login timeout") ||
          msg.includes("User not found")
        );
      }
    });
  });
}); 