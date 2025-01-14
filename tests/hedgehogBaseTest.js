/***********************************************************
 *  hedgehogBaseTest.js
 ***********************************************************/

const { describe, it, beforeEach, afterEach } = require("mocha");
const assert = require("assert");
const SEA = require("gun/sea");
const Gun = require("gun");

const { Hedgehog } = require("../src/Hedgehog");
const { WalletManager } = require("../src/WalletManager");
const { GunHedgehog } = require("../src/GunHedgehog");
const { waitUntil, convertToEthPk } = require("../src/utils");

// ============================
// Funzioni helper
// ============================

// Genera username unici
const generateUniqueUsername = () =>
  `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

// Attende che un certo path in Gun soddisfi la predicate (con un timeout di default)
const waitForGunData = (gun, path, predicate, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    let timeoutId;
    let intervalId;
    let attempts = 0;
    const maxAttempts = 50; // 5 secondi con intervallo di 100ms

    const check = () => {
      attempts++;
      gun.get(path).once((data) => {
        if (data && predicate(data)) {
          clearTimeout(timeoutId);
          clearInterval(intervalId);
          resolve(data);
        } else if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          reject(new Error(`Timeout waiting for Gun data at path: ${path}`));
        }
      });
    };

    // Controlliamo periodicamente
    intervalId = setInterval(check, 100);
    
    // Timeout per evitare attese infinite
    timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      reject(new Error(`Timeout waiting for Gun data at path: ${path}`));
    }, timeout);

    // Prima verifica immediata
    check();
  });
};

// Pulisce i dati in un path di Gun


// ============================
// Inizio test
// ============================

describe("Hedgehog Test Suite", function () {
  // Impostiamo un timeout ampio per tutti i test (es. 60 secondi)
  this.timeout(60000);

  // -----------------------------------------------------------
  // 1) Test sulla classe base Hedgehog
  // -----------------------------------------------------------
  describe("Hedgehog Base Class", function () {
    let hedgehog;

    beforeEach(function () {
      hedgehog = new Hedgehog();
    });

    describe("Costruttore e Stato", function () {
      it("dovrebbe essere pronto dopo la costruzione", function () {
        assert(
          hedgehog.isReady(),
          "Hedgehog dovrebbe essere pronto dopo la costruzione"
        );
      });

      it("dovrebbe iniziare senza wallet", function () {
        assert(
          !hedgehog.isLoggedIn(),
          "Hedgehog non dovrebbe avere un wallet inizialmente"
        );
        assert(
          hedgehog.getWallet() === null,
          "getWallet dovrebbe restituire null inizialmente"
        );
      });
    });

    describe("Metodi di Ready State", function () {
      it("dovrebbe attendere fino a quando è pronto", async function () {
        await hedgehog.waitUntilReady();
        assert(
          hedgehog.isReady(),
          "Hedgehog dovrebbe essere pronto dopo waitUntilReady"
        );
      });

      it("dovrebbe gestire multiple chiamate a waitUntilReady", async function () {
        await Promise.all([
          hedgehog.waitUntilReady(),
          hedgehog.waitUntilReady(),
          hedgehog.waitUntilReady(),
        ]);
        assert(
          hedgehog.isReady(),
          "Hedgehog dovrebbe essere pronto dopo multiple chiamate"
        );
      });
    });
  });

  // -----------------------------------------------------------
  // 2) Test sulle funzioni di utilità
  // -----------------------------------------------------------
  describe("Utility Functions", function () {
    describe("waitUntil", function () {
      it("dovrebbe risolvere quando la condizione diventa vera", async function () {
        let flag = false;
        setTimeout(() => {
          flag = true;
        }, 200);

        await waitUntil(() => flag);
        assert(flag, "Il flag dovrebbe essere true dopo waitUntil");
      });

      it("dovrebbe gestire condizioni che sono già vere", async function () {
        const flag = true;
        await waitUntil(() => flag);
        assert(
          flag,
          "Dovrebbe risolvere immediatamente se la condizione è già vera"
        );
      });

      it("dovrebbe continuare a controllare fino a quando la condizione diventa vera", async function () {
        let counter = 0;
        const condition = () => {
          counter++;
          return counter >= 3;
        };

        await waitUntil(condition);
        assert(
          counter >= 3,
          "Dovrebbe controllare multiple volte fino a quando la condizione è vera"
        );
      });
    });

    describe("convertToEthPk", function () {
      it("dovrebbe convertire una chiave privata Gun valida in formato Ethereum", async function () {
        const pair = await SEA.pair();
        const gunPrivateKey = pair.epriv;

        const ethPrivateKey = await convertToEthPk(gunPrivateKey);

        assert(
          ethPrivateKey.startsWith("0x"),
          "La chiave privata Ethereum dovrebbe iniziare con 0x"
        );
        assert(
          ethPrivateKey.length === 66,
          "La chiave privata Ethereum dovrebbe essere lunga 66 caratteri (0x + 64)"
        );
        assert(
          /^0x[0-9a-f]{64}$/i.test(ethPrivateKey),
          "La chiave privata dovrebbe contenere solo caratteri esadecimali validi"
        );
      });

      it("dovrebbe gestire chiavi private Gun non valide", async function () {
        const invalidKey = "invalid-key";

        try {
          await convertToEthPk(invalidKey);
          assert.fail("Dovrebbe lanciare un errore per chiavi non valide");
        } catch (error) {
          assert(error instanceof Error);
          assert(
            error.message === "Impossibile convertire la chiave privata",
            "Dovrebbe lanciare l'errore corretto per chiavi non valide"
          );
        }
      });

      it("dovrebbe gestire chiavi private Gun vuote", async function () {
        try {
          await convertToEthPk("");
          assert.fail("Dovrebbe lanciare un errore per chiavi vuote");
        } catch (error) {
          assert(error instanceof Error);
          assert(
            error.message === "Impossibile convertire la chiave privata",
            "Dovrebbe lanciare l'errore corretto per chiavi vuote"
          );
        }
      });

      it("dovrebbe gestire chiavi private Gun con caratteri non validi", async function () {
        const invalidKey = "!@#$%^&*()";

        try {
          await convertToEthPk(invalidKey);
          assert.fail(
            "Dovrebbe lanciare un errore per chiavi con caratteri non validi"
          );
        } catch (error) {
          assert(error instanceof Error);
          assert(
            error.message === "Impossibile convertire la chiave privata",
            "Dovrebbe lanciare l'errore corretto per caratteri non validi"
          );
        }
      });

      it("dovrebbe gestire chiavi private Gun di lunghezza errata", async function () {
        // Una chiave troppo corta
        const shortKey = "AAAA";

        try {
          await convertToEthPk(shortKey);
          assert.fail("Dovrebbe lanciare un errore per chiavi troppo corte");
        } catch (error) {
          assert(error instanceof Error);
          // A seconda di come gestisci l'errore:
          assert(
            error.message === "Impossibile convertire la chiave privata" ||
              error.message === "Lunghezza chiave privata non valida",
            "Dovrebbe lanciare l'errore corretto per lunghezza errata"
          );
        }
      });
    });
  });

  // -----------------------------------------------------------
  // 3) Test sul WalletManager
  // -----------------------------------------------------------
  describe("WalletManager", function () {
    let gunKeyPair;
    let accountData;

    beforeEach(async function () {
      gunKeyPair = await SEA.pair();
      accountData = {
        username: generateUniqueUsername(),
        wallets: {},
        selectedWallet: undefined
      };
    });

    describe("Creazione e Gestione Wallet", function () {
      it("dovrebbe creare un wallet da una coppia di chiavi GUN", async function () {
        const wallet = await WalletManager.createWalletFromGunKeyPair(gunKeyPair);
        assert(wallet, "Il wallet dovrebbe essere creato");
        assert(wallet.address.startsWith("0x"), "L'indirizzo dovrebbe essere in formato Ethereum");
      });

      it("dovrebbe creare un oggetto wallet completo", async function () {
        const result = await WalletManager.createWalletObj(gunKeyPair);
        assert(!(result instanceof Error), "Non dovrebbe restituire un errore");
        if (!(result instanceof Error)) {
          assert(result.walletObj, "Dovrebbe contenere un oggetto wallet");
          assert(result.entropy, "Dovrebbe contenere l'entropia");
        }
      });
    });

    describe("Gestione Account", function () {
      it("dovrebbe salvare e recuperare i dati dell'account", async function () {
        const walletResult = await WalletManager.createWalletObj(gunKeyPair);
        if (walletResult instanceof Error) throw walletResult;

        const walletData = {
          address: walletResult.walletObj.address,
          entropy: walletResult.entropy,
          name: "Test Wallet"
        };

        // Aggiungi wallet all'account
        accountData = await WalletManager.addWallet(accountData, walletData);

        assert(accountData, "I dati dell'account dovrebbero esistere");
        assert(accountData.wallets[walletResult.walletObj.address], "Il wallet dovrebbe essere presente");
        assert.strictEqual(
          accountData.wallets[walletResult.walletObj.address].name,
          "Test Wallet",
          "Il nome del wallet dovrebbe corrispondere"
        );
      });

      it("dovrebbe gestire la selezione del wallet", async function () {
        // Crea e aggiungi il primo wallet
        const wallet1 = await WalletManager.createWalletObj(gunKeyPair);
        if (wallet1 instanceof Error) throw wallet1;
        
        const walletData1 = {
          address: wallet1.walletObj.address,
          entropy: wallet1.entropy,
          name: "Wallet 1"
        };
        accountData = await WalletManager.addWallet(accountData, walletData1);

        // Crea e aggiungi il secondo wallet
        const wallet2 = await WalletManager.createWalletObj(gunKeyPair);
        if (wallet2 instanceof Error) throw wallet2;
        
        const walletData2 = {
          address: wallet2.walletObj.address,
          entropy: wallet2.entropy,
          name: "Wallet 2"
        };
        accountData = await WalletManager.addWallet(accountData, walletData2);

        // Seleziona il secondo wallet
        await WalletManager.setSelectedWallet(accountData, wallet2.walletObj.address);

        assert.strictEqual(
          accountData.selectedWallet,
          wallet2.walletObj.address,
          "Il wallet selezionato dovrebbe essere il secondo"
        );
      });

      it("dovrebbe rimuovere un wallet", async function () {
        // Crea e aggiungi un wallet
        const wallet = await WalletManager.createWalletObj(gunKeyPair);
        if (wallet instanceof Error) throw wallet;
        
        const walletData = {
          address: wallet.walletObj.address,
          entropy: wallet.entropy,
          name: "Test Wallet"
        };
        accountData = await WalletManager.addWallet(accountData, walletData);

        // Rimuovi il wallet
        await WalletManager.removeWallet(accountData, wallet.walletObj.address);

        assert(
          !accountData.wallets[wallet.walletObj.address],
          "Il wallet dovrebbe essere rimosso"
        );
      });
    });
  });

  // -----------------------------------------------------------
  // 4) Test su GunHedgehog
  // -----------------------------------------------------------
  describe("GunHedgehog", function () {
    let hedgehog;
    let testUsername;
    let testPassword;

    beforeEach(async function () {
      hedgehog = new GunHedgehog({
        localStorage: false,
        radisk: false,
        file: false,
        web: false,
        peers: [],
        memory: true,
        axe: false,
        multicast: false,
        timeout: 20000,
        super: false,
        ws: false
      });
      testUsername = generateUniqueUsername();
      testPassword = "TestPassword123!";
      
      // Attendiamo che Gun sia pronto
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterEach(async function () {
      if (hedgehog) {
        try {
          if (hedgehog.isLoggedIn()) {
            await hedgehog.logout();
          }
          await hedgehog.close();
          // Attendiamo che Gun si chiuda completamente
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error("Errore durante la pulizia:", error);
        }
      }
    });

    describe("Autenticazione", function () {
      it("dovrebbe registrare un nuovo utente", async function () {
        // Aumentiamo il timeout per questo test specifico
        this.timeout(30000);

        console.log("Test: Inizializzazione Gun...");
        // Attendiamo che Gun sia completamente inizializzato
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log("Test: Tentativo di signup...");
        try {
          const wallet = await hedgehog.signUp(testUsername, testPassword);
          console.log("Test: Signup completato con successo");
          assert(wallet, "Dovrebbe restituire un wallet");
          assert(hedgehog.isLoggedIn(), "L'utente dovrebbe essere loggato");
          assert(hedgehog.getGunKeyPair(), "Dovrebbe avere una coppia di chiavi GUN");
          
          console.log("Test: Attesa per il salvataggio dei dati...");
          // Attendiamo che i dati siano salvati
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          console.log("Test: Verifica dei dati salvati...");
          // Verifichiamo che i dati siano stati salvati
          const accountData = await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error("Timeout nel recupero dei dati dell'account"));
            }, 5000);

            hedgehog.getGunInstance().get('accounts').get(testUsername).once((data) => {
              clearTimeout(timeoutId);
              resolve(data);
            });
          });
          
          console.log("Test: Verifica finale dei dati...");
          assert(accountData, "I dati dell'account dovrebbero esistere");
          assert(accountData.wallets, "Dovrebbero esserci dei wallet");
          assert(accountData.wallets[wallet.address], "Il wallet dovrebbe essere salvato");
        } catch (error) {
          console.error("Test: Errore durante il signup:", error);
          throw error;
        }
      });

      it("dovrebbe effettuare il login di un utente esistente", async function () {
        // Prima creiamo un utente
        const initialWallet = await hedgehog.signUp(testUsername, testPassword);
        await hedgehog.logout();
        
        // Poi facciamo il login
        const wallet = await hedgehog.login(testUsername, testPassword);
        assert(wallet, "Dovrebbe restituire un wallet");
        assert(hedgehog.isLoggedIn(), "L'utente dovrebbe essere loggato");
        assert.strictEqual(wallet.address, initialWallet.address, "Dovrebbe recuperare lo stesso wallet");
      });

      it("dovrebbe gestire il logout", async function () {
        await hedgehog.signUp(testUsername, testPassword);
        await hedgehog.logout();

        assert(!hedgehog.isLoggedIn(), "L'utente non dovrebbe essere più loggato");
        assert(!hedgehog.getGunKeyPair(), "Non dovrebbe avere chiavi GUN");
        assert(!hedgehog.getWallet(), "Non dovrebbe avere un wallet");
      });
    });

    describe("Gestione Wallet", function () {
      beforeEach(async function () {
        // Registra e aspetta che compaia un wallet
        await hedgehog.signUp(testUsername, testPassword);
        await waitForGunData(
          hedgehog.getGunInstance(),
          `accounts/${testUsername}`,
          (data) =>
            data && data.wallets && Object.keys(data.wallets).length > 0,
          15000
        );
      });

      it("dovrebbe creare un nuovo wallet", async function () {
        const newWallet = await hedgehog.createNewWallet("Secondo Wallet");

        // Verifichiamo che il nuovo wallet sia presente
        await waitForGunData(
          hedgehog.getGunInstance(),
          `accounts/${testUsername}`,
          (data) => data && data.wallets && data.wallets[newWallet.address]
        );

        assert(newWallet, "Dovrebbe creare un nuovo wallet");
        assert(
          newWallet.address,
          "Il nuovo wallet dovrebbe avere un indirizzo"
        );
      });

      it("dovrebbe cambiare wallet", async function () {
        const mainWallet = hedgehog.getWallet();
        const newWallet = await hedgehog.createNewWallet("Secondo Wallet");
        await new Promise((resolve) => setTimeout(resolve, 500));

        await hedgehog.switchWallet(newWallet.address);
        const currentWallet = hedgehog.getWallet();

        assert.notStrictEqual(
          currentWallet?.address,
          mainWallet?.address,
          "Dovrebbe essere selezionato il nuovo wallet"
        );
      });

      it("dovrebbe rimuovere un wallet", async function () {
        const newWallet = await hedgehog.createNewWallet("Wallet da Rimuovere");
        await new Promise((resolve) => setTimeout(resolve, 500));

        await hedgehog.removeWallet(newWallet.address);
        await new Promise((resolve) => setTimeout(resolve, 500));

        try {
          // Provando a fare switch su un wallet rimosso dovrebbe fallire
          await hedgehog.switchWallet(newWallet.address);
          assert.fail("Dovrebbe fallire lo switch a un wallet rimosso");
        } catch (error) {
          assert(error instanceof Error, "Dovrebbe lanciare un errore");
        }
      });
    });
  });
});
