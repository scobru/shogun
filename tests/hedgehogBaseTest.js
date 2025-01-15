/***********************************************************
 *  hedgehogBaseTest.js
 ***********************************************************/

const { describe, it, beforeEach, afterEach } = require("mocha");
const assert = require("assert");
const SEA = require("gun/sea");
const Gun = require("gun");

const { Hedgehog } = require("../src/Hedgehog");
const { WalletManager } = require("../src/WalletManager");
const { waitUntil, convertToEthPk } = require("../src/utils");
const { GunHedgehog } = require("../src/GunHedgehog");

// Genera username unici
const generateUniqueUsername = () =>
  `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

// Funzione di utilità per attendere che i dati siano disponibili in Gun
const waitForGunData = async (gun, username, expectedData = null, timeout = 15000) => {
  console.log(`🔄 Iniziata attesa dati per ${username}`);
  
  // Prima verifica se i dati esistono già
  const existingData = await new Promise(resolve => {
    gun.get('accounts').get(username).once(data => resolve(data));
  });

  if (existingData && (!expectedData || checkData(existingData))) {
    console.log(`✅ Dati trovati immediatamente per ${username}:`, existingData);
    return existingData;
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.log(`⚠️ TIMEOUT per ${username}. Ultimo dato ricevuto:`, lastReceivedData);
      reject(new Error(`Timeout attendendo i dati per il path: ${username}`));
    }, timeout);

    let resolved = false;
    let lastReceivedData = null;
    let unsubscribe = null;

    const checkData = (data) => {
      lastReceivedData = data;
      console.log(`📥 Ricevuti dati per ${username}:`, data);
      
      if (!data) {
        console.log(`❌ Dati nulli per ${username}`);
        return false;
      }
      
      if (expectedData) {
        if (typeof expectedData === 'function') {
          const result = expectedData(data);
          console.log(`🔍 Verifica funzione per ${username}:`, result);
          return result;
        }
        const expected = typeof expectedData === 'string' ? expectedData : JSON.stringify(expectedData);
        const actual = typeof data === 'string' ? data : JSON.stringify(data);
        const result = expected === actual;
        console.log(`🔍 Verifica oggetti per ${username}:`, { expected, actual, result });
        return result;
      }
      return true;
    };

    const onData = (data) => {
      console.log(`👉 onData chiamato per ${username}`);
      if (checkData(data) && !resolved) {
        console.log(`✅ Dati validi trovati per ${username}`);
        resolved = true;
        if (unsubscribe) unsubscribe();
        clearTimeout(timeoutId);
        resolve(data);
      }
    };

    const ref = gun.get('accounts').get(username);
    unsubscribe = ref.on(onData);
    ref.once(onData);
  });
};

// Funzione di utilità per attendere che un wallet sia salvato
const waitForWallet = async (gun, address, username) => {
  console.log(`🏦 Attendo wallet per indirizzo: ${address} e username: ${username}`);
  
  // Prima verifica se i dati esistono già
  const existingData = await new Promise(resolve => {
    gun.get('accounts').get(username).once(data => resolve(data));
  });

  if (existingData && existingData.wallets && existingData.wallets[address]) {
    const wallet = existingData.wallets[address];
    if (wallet && wallet.address && wallet.entropy) {
      console.log(`✅ Wallet trovato immediatamente:`, wallet);
      return {
        ...existingData,
        wallets: Object.fromEntries(
          Object.entries(existingData.wallets).filter(([_, w]) => w && w.address && w.entropy)
        )
      };
    }
  }
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.log(`⚠️ Timeout attendendo wallet per ${address}`);
      reject(new Error(`Timeout attendendo i dati per il wallet: ${address}`));
    }, 15000);

    let resolved = false;
    let unsubscribe = null;
    let walletsUnsubscribe = null;

    const checkWalletData = (accountData, wallets) => {
      console.log(`🔍 Verifica wallet:`, {
        hasAccountData: !!accountData,
        hasWallets: !!wallets,
        walletsType: typeof wallets,
        hasAddress: wallets ? (address in wallets) : false,
        walletKeys: wallets ? Object.keys(wallets) : []
      });

      // Verifica che abbiamo tutti i dati necessari
      if (!accountData || !wallets || typeof wallets !== 'object') {
        return;
      }

      // Verifica che il wallet esista
      if (!(address in wallets)) {
        return;
      }

      // Verifica che il wallet abbia i dati necessari
      const wallet = wallets[address];
      if (!wallet || !wallet.address || !wallet.entropy) {
        return;
      }

      if (!resolved) {
        console.log(`✅ Wallet trovato:`, { accountData, wallets });
        resolved = true;
        if (unsubscribe) unsubscribe();
        if (walletsUnsubscribe) walletsUnsubscribe();
        clearTimeout(timeoutId);
        resolve({ 
          ...accountData, 
          wallets: Object.fromEntries(
            Object.entries(wallets).filter(([_, w]) => w && w.address && w.entropy)
          )
        });
      }
    };

    // Sottoscrizione principale per i dati dell'account
    const accountRef = gun.get('accounts').get(username);
    unsubscribe = accountRef.on((accountData) => {
      if (!accountData) return;
      
      // Se wallets è un riferimento, lo seguiamo
      if (accountData.wallets && typeof accountData.wallets === 'object' && accountData.wallets['#']) {
        const walletsRef = accountRef.get('wallets');
        walletsUnsubscribe = walletsRef.on((wallets) => {
          if (!wallets) return;
          
          // Verifica se abbiamo riferimenti ai wallet individuali
          const walletsData = {};
          let loadedWallets = 0;
          const totalWallets = Object.keys(wallets).length;
          
          Object.entries(wallets).forEach(([addr, wallet]) => {
            if (wallet && typeof wallet === 'object' && wallet['#']) {
              walletsRef.get(addr).on((walletData) => {
                if (walletData) {
                  walletsData[addr] = walletData;
                  loadedWallets++;
                  if (loadedWallets === totalWallets) {
                    checkWalletData(accountData, walletsData);
                  }
                }
              });
            } else {
              walletsData[addr] = wallet;
              loadedWallets++;
              if (loadedWallets === totalWallets) {
                checkWalletData(accountData, walletsData);
              }
            }
          });
        });
      } else if (accountData.wallets) {
        checkWalletData(accountData, accountData.wallets);
      }
    });

    accountRef.once((accountData) => {
      if (accountData && accountData.wallets) {
        checkWalletData(accountData, accountData.wallets);
      }
    });
  });
};

// Funzione di utilità per attendere che un'operazione sia completata
const waitForOperation = async (operation) => {
  const result = await operation;
  await new Promise(resolve => setTimeout(resolve, 1000)); // Attendi 1 secondo per la propagazione
  return result;
};

describe("Hedgehog Test Suite", function () {
  this.timeout(30000);

  let hedgehog;
  let instances = [];
  let gunServer;

  before(async function() {
    // Avvia un server Gun locale per i test
    gunServer = new Gun({
      web: require('http').createServer().listen(8765),
      file: 'test-data',
      radisk: false,
      memory: true
    });
  });

  after(async function() {
    // Chiudi il server Gun
    if (gunServer) {
      gunServer.off();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  beforeEach(async function () {
    // Crea una nuova istanza con le opzioni corrette
    hedgehog = new GunHedgehog({
      peers: ['http://localhost:8765/gun'],
      file: false,
      radisk: false,
      memory: true,
      localStorage: false
    });
    instances.push(hedgehog);
    await hedgehog.waitUntilReady();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Attendi la connessione
  });

  afterEach(async function () {
    // Pulisci le istanze
    for (const instance of instances) {
      if (instance.isLoggedIn()) {
        await instance.logout();
      }
      await instance.close();
    }
    instances = [];
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe("Hedgehog Base Class", function () {
    describe("Costruttore e Stato", function () {
      it("dovrebbe essere pronto dopo la costruzione", async function () {
        assert(hedgehog.isReady(), "Hedgehog dovrebbe essere pronto dopo la costruzione");
      });

      it("dovrebbe iniziare senza wallet", async function () {
        assert(!hedgehog.isLoggedIn(), "Hedgehog non dovrebbe avere un wallet inizialmente");
        assert(hedgehog.getWallet() === null, "getWallet dovrebbe restituire null inizialmente");
      });
    });

    describe("Gestione Account", function () {
      it("dovrebbe registrare un nuovo utente", async function () {
        const username = generateUniqueUsername();
        const wallet = await waitForOperation(hedgehog.signUp(username, "password123"));
        
        assert(wallet, "Dovrebbe creare un wallet");
        assert(hedgehog.isLoggedIn(), "Dovrebbe essere loggato dopo la registrazione");
        
        // Verifica i dati in Gun
        const userData = await waitForGunData(hedgehog.getUser(), username);
        assert(userData, "Dovrebbe salvare i dati utente");
        assert(userData.username === username, "Dovrebbe salvare il nome utente corretto");
        assert(Object.keys(userData.wallets).length === 1, "Dovrebbe creare un wallet");
      });

      it("dovrebbe effettuare il login di un utente esistente", async function () {
        const username = generateUniqueUsername();
        const password = "password123";
        
        // Registrazione
        const firstWallet = await waitForOperation(hedgehog.signUp(username, password));
        const firstAddress = firstWallet.address;
        
        // Attendi che i dati siano salvati completamente
        const initialData = await waitForWallet(hedgehog.getUser(), firstAddress, username);
        assert(initialData.wallets[firstAddress], "Il wallet dovrebbe essere salvato inizialmente");
        
        // Logout
        await waitForOperation(hedgehog.logout());
        await new Promise(resolve => setTimeout(resolve, 1000)); // Attendi che il logout sia completato

        // Login
        const wallet = await waitForOperation(hedgehog.login(username, password));
        assert(wallet, "Dovrebbe recuperare il wallet");
        assert(hedgehog.isLoggedIn(), "Dovrebbe essere loggato dopo il login");
        assert.strictEqual(wallet.address, firstAddress, "Dovrebbe recuperare lo stesso wallet");
        
        // Verifica finale dei dati dopo il login
        const finalData = await waitForWallet(hedgehog.getUser(), firstAddress, username);
        assert(finalData.wallets[firstAddress], "Il wallet dovrebbe essere accessibile dopo il login");
      });

      it("dovrebbe creare wallet con entropy unica", async function () {
        const username = generateUniqueUsername();
        const firstWallet = await waitForOperation(hedgehog.signUp(username, "password123"));
        
        // Attendi che il primo wallet sia salvato e verifica i suoi dati
        const firstWalletData = await waitForWallet(hedgehog.getUser(), firstWallet.address, username);
        assert(firstWalletData.wallets[firstWallet.address], "Il primo wallet dovrebbe essere salvato");
        
        // Crea un secondo wallet
        const secondWallet = await waitForOperation(hedgehog.createNewWallet("Secondo Wallet"));
        
        // Attendi che il secondo wallet sia salvato e verifica i suoi dati
        const secondWalletData = await waitForWallet(hedgehog.getUser(), secondWallet.address, username);
        
        // Verifica che entrambi i wallet esistano
        assert(secondWalletData.wallets[firstWallet.address], "Il primo wallet dovrebbe ancora esistere");
        assert(secondWalletData.wallets[secondWallet.address], "Il secondo wallet dovrebbe essere stato aggiunto");
        assert.strictEqual(Object.keys(secondWalletData.wallets).length, 2, "Dovrebbero esserci due wallet");
        
        // Verifica che abbiano entropy diverse
        assert.notStrictEqual(
          secondWalletData.wallets[firstWallet.address].entropy,
          secondWalletData.wallets[secondWallet.address].entropy,
          "I wallet dovrebbero avere entropy diverse"
        );
      });

      it("dovrebbe rimuovere un wallet solo se ce ne sono altri", async function () {
        const username = generateUniqueUsername();
        const firstWallet = await waitForOperation(hedgehog.signUp(username, "password123"));
        
        // Attendi che il primo wallet sia salvato e verifica i suoi dati
        const firstWalletData = await waitForWallet(hedgehog.getUser(), firstWallet.address, username);
        assert(firstWalletData.wallets[firstWallet.address], "Il primo wallet dovrebbe essere salvato");
        assert(firstWalletData.selectedWallet === firstWallet.address, "Il primo wallet dovrebbe essere selezionato");
        
        // Crea un secondo wallet
        const secondWallet = await waitForOperation(hedgehog.createNewWallet("Secondo Wallet"));
        
        // Attendi che il secondo wallet sia salvato
        const secondWalletData = await waitForWallet(hedgehog.getUser(), secondWallet.address, username);
        assert.strictEqual(Object.keys(secondWalletData.wallets).length, 2, "Dovrebbero esserci due wallet");
        
        // Attendi un momento per assicurarci che i dati siano sincronizzati
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Rimuovi il secondo wallet
        await waitForOperation(hedgehog.removeWallet(secondWallet.address));
        
        // Attendi un momento per la sincronizzazione
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verifica che rimanga solo il primo wallet
        const finalData = await waitForWallet(hedgehog.getUser(), firstWallet.address, username);
        assert.strictEqual(Object.keys(finalData.wallets).length, 1, "Dovrebbe rimanere un wallet");
        assert(finalData.wallets[firstWallet.address], "Il primo wallet dovrebbe rimanere");
        assert(finalData.selectedWallet === firstWallet.address, "Il primo wallet dovrebbe rimanere selezionato");
      });

      it("dovrebbe gestire errori di registrazione", async function () {
        const username = generateUniqueUsername();
        
        // Prima registrazione
        await waitForOperation(hedgehog.signUp(username, "password123"));
        
        // Tentativo di registrazione con username esistente
        try {
          await waitForOperation(hedgehog.signUp(username, "password456"));
          assert.fail("Dovrebbe impedire la registrazione di username duplicati");
        } catch (error) {
          assert(error.message.includes("User already created"), "Dovrebbe indicare che l'utente esiste già");
        }
      });

      it("dovrebbe gestire errori di login", async function () {
        const username = generateUniqueUsername();
        
        // Tentativo di login con utente non esistente
        try {
          await waitForOperation(hedgehog.login(username, "password123"));
          assert.fail("Dovrebbe impedire il login di utenti non esistenti");
        } catch (error) {
          assert(error.message.includes("Wrong user or password"), "Dovrebbe indicare credenziali errate");
        }

        // Registrazione
        await waitForOperation(hedgehog.signUp(username, "password123"));
        await waitForOperation(hedgehog.logout());

        // Tentativo di login con password errata
        try {
          await waitForOperation(hedgehog.login(username, "password456"));
          assert.fail("Dovrebbe impedire il login con password errata");
        } catch (error) {
          assert(error.message.includes("Wrong user or password"), "Dovrebbe indicare credenziali errate");
        }
      });

      it("dovrebbe mantenere i dati tra sessioni", async function () {
        const username = generateUniqueUsername();
        const password = "password123";
        
        // Registrazione e creazione wallet
        const firstWallet = await waitForOperation(hedgehog.signUp(username, password));
        
        // Attendi che i dati siano salvati completamente
        const initialData = await waitForWallet(hedgehog.getUser(), firstWallet.address, username);
        assert(initialData.wallets[firstWallet.address], "Il wallet dovrebbe essere salvato");
        assert(initialData.selectedWallet === firstWallet.address, "Il wallet dovrebbe essere selezionato");
        
        // Logout e attendi che sia completato
        await waitForOperation(hedgehog.logout());
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Login e verifica dati
        const wallet = await waitForOperation(hedgehog.login(username, password));
        assert.strictEqual(wallet.address, firstWallet.address, "Dovrebbe recuperare lo stesso wallet");
        
        // Attendi che i dati siano sincronizzati dopo il login
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verifica che i dati siano ancora presenti
        const finalData = await waitForWallet(hedgehog.getUser(), firstWallet.address, username);
        assert(finalData.wallets[firstWallet.address], "Il wallet dovrebbe essere mantenuto");
        assert(finalData.selectedWallet === firstWallet.address, "Il wallet dovrebbe rimanere selezionato");
      });

      it("dovrebbe gestire correttamente il wallet selezionato", async function () {
        const username = generateUniqueUsername();
        const firstWallet = await waitForOperation(hedgehog.signUp(username, "password123"));
        const secondWallet = await waitForOperation(hedgehog.createNewWallet("Secondo Wallet"));
        
        // Verifica che il primo wallet sia selezionato di default
        let userData = await waitForGunData(hedgehog.getUser(), username);
        assert.strictEqual(userData.selectedWallet, firstWallet.address, "Il primo wallet dovrebbe essere selezionato di default");
        
        // Cambia il wallet selezionato
        await waitForOperation(hedgehog.switchWallet(secondWallet.address));
        
        // Verifica che il secondo wallet sia ora selezionato
        userData = await waitForGunData(hedgehog.getUser(), username);
        assert.strictEqual(userData.selectedWallet, secondWallet.address, "Il secondo wallet dovrebbe essere selezionato");
      });
    });
  });

  describe("Utility Functions", function () {
    describe("waitUntil", function () {
      it("dovrebbe risolvere quando la condizione diventa vera", async function () {
        let flag = false;
        setTimeout(() => { flag = true; }, 200);
        await waitUntil(() => flag);
        assert(flag, "Il flag dovrebbe essere true dopo waitUntil");
      });
    });

    describe("convertToEthPk", function () {
      it("dovrebbe convertire una chiave privata Gun valida in formato Ethereum", async function () {
        const pair = await SEA.pair();
        const gunPrivateKey = pair.epriv;
        const ethPrivateKey = await convertToEthPk(gunPrivateKey);
        assert(ethPrivateKey.startsWith("0x"), "La chiave privata Ethereum dovrebbe iniziare con 0x");
        assert(ethPrivateKey.length === 66, "La chiave privata Ethereum dovrebbe essere lunga 66 caratteri");
      });
    });
  });
});
