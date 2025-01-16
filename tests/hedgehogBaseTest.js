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
const waitForGunData = async (gun, username, expectedData = null, timeout = 5000) => {
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
async function waitForWallet(gun, address, username) {
  console.log(`🔄 Attendo wallet per ${username}, indirizzo: ${address}`);
  
  const getWalletData = (data) => {
    if (!data || !data.wallets) return null;
    return new Promise((resolve) => {
      if (typeof data.wallets === 'object' && !data.wallets['#']) {
        resolve(data.wallets[address]);
        return;
      }
      
      gun.get('accounts').get(username).get('wallets').get(address).once((walletData) => {
        resolve(walletData);
      });
    });
  };

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.log(`⚠️ TIMEOUT attendendo wallet per ${address}`);
      reject(new Error('Timeout nel caricamento del wallet'));
    }, 10000);

    let resolved = false;
    let lastData = null;
    let unsubscribe = null;

    const checkData = async (data) => {
      lastData = data;
      console.log(`📥 Dati ricevuti per ${username}:`, data);
      
      if (!data) {
        console.log(`❌ Dati nulli per ${username}`);
        return false;
      }

      const walletData = await getWalletData(data);
      console.log(`📥 Dati wallet:`, walletData);
      
      if (!walletData) return false;
      if (!walletData.address || !walletData.entropy) return false;
      if (walletData.address !== address) return false;

      return true;
    };

    const onData = async (data) => {
      console.log(`👉 onData chiamato per ${username}`);
      if (await checkData(data) && !resolved) {
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
}

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
      radisk: true,
      file: 'radata'
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
      file: false,
      localStorage: true,
      web: false,
      radisk: false,
      memory: true,
      axe: false
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
        try {
          const username = generateUniqueUsername();
          console.log("🔵 Test registrazione per:", username);
          
          // Registrazione e attesa che sia completata
          const wallet = await hedgehog.signUp(username, "password123");
          console.log("✅ Wallet creato:", wallet.address);
          
          // Attendi che il login sia completato
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          assert(wallet, "Dovrebbe creare un wallet");
          assert(hedgehog.isLoggedIn(), "Dovrebbe essere loggato dopo la registrazione");
          
          console.log("🔄 Attendo dati account per:", username);
          const accountData = await waitForWallet(hedgehog.getGunInstance(), wallet.address, username);
          console.log("✅ Dati account ricevuti:", JSON.stringify(accountData, null, 2));
          
          // Verifica base
          assert(accountData, "Dovrebbe salvare i dati utente");
          
          // Verifica username
          console.log("🔍 Verifica username:", { atteso: username, ricevuto: accountData.username });
          assert(accountData.username === username, "Dovrebbe salvare il nome utente corretto");
          
          // Verifica wallet selezionato
          console.log("🔍 Verifica wallet selezionato:", { atteso: wallet.address, ricevuto: accountData.selectedWallet });
          assert(accountData.selectedWallet === wallet.address, "Dovrebbe salvare il wallet selezionato");
          
          // Verifica dati wallet
          console.log("🔍 Verifica dati wallet:", accountData.wallets[wallet.address]);
          assert(accountData.wallets[wallet.address], "Dovrebbe salvare i dati del wallet");
          assert(accountData.wallets[wallet.address].address === wallet.address, "Dovrebbe salvare l'indirizzo del wallet");
          assert(accountData.wallets[wallet.address].entropy, "Dovrebbe salvare l'entropy del wallet");
          assert(accountData.wallets[wallet.address].name, "Dovrebbe salvare il nome del wallet");
          
          console.log("✅ Test completato con successo");
        } catch (error) {
          console.error("❌ Test fallito:", error);
          throw error;
        }
      });

      it("dovrebbe effettuare il login di un utente esistente", async function () {
        const username = generateUniqueUsername();
        const password = "password123";
        
        console.log("🔵 Test login per:", username);
        
        // Registrazione
        console.log("📝 Registrazione utente...");
        const firstWallet = await waitForOperation(hedgehog.signUp(username, password));
        const firstAddress = firstWallet.address;
        console.log("✅ Registrazione completata, wallet:", firstAddress);
        
        // Attendi che i dati siano salvati completamente
        console.log("🔄 Attendo salvataggio dati iniziali...");
        const initialData = await waitForWallet(hedgehog.getGunInstance(), firstAddress, username);
        console.log("✅ Dati iniziali salvati:", initialData);
        assert(initialData.wallets[firstAddress], "Il wallet dovrebbe essere salvato inizialmente");
        
        // Logout
        console.log("👋 Logout...");
        await waitForOperation(hedgehog.logout());
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aumentato il tempo di attesa
        console.log("✅ Logout completato");

        // Login
        console.log("🔑 Login...");
        const wallet = await waitForOperation(hedgehog.login(username, password));
        console.log("✅ Login completato, wallet:", wallet.address);
        
        assert(wallet, "Dovrebbe recuperare il wallet");
        assert(hedgehog.isLoggedIn(), "Dovrebbe essere loggato dopo il login");
        assert.strictEqual(wallet.address, firstAddress, "Dovrebbe recuperare lo stesso wallet");
        
        // Verifica finale dei dati dopo il login
        console.log("🔄 Verifica finale dati...");
        const finalData = await waitForWallet(hedgehog.getGunInstance(), firstAddress, username);
        console.log("✅ Verifica finale completata:", finalData);
        assert(finalData.wallets[firstAddress], "Il wallet dovrebbe essere accessibile dopo il login");
      });

      it("dovrebbe creare wallet con entropy unica", async function () {
        const username = generateUniqueUsername();
        console.log("🔵 Test wallet multipli per:", username);
        
        // Registrazione e primo wallet
        console.log("📝 Creazione primo wallet...");
        const firstWallet = await waitForOperation(hedgehog.signUp(username, "password123"));
        console.log("✅ Primo wallet creato:", firstWallet.address);
        
        // Attendi che il primo wallet sia salvato
        console.log("🔄 Attendo salvataggio primo wallet...");
        const firstWalletData = await waitForWallet(hedgehog.getGunInstance(), firstWallet.address, username);
        console.log("✅ Primo wallet salvato:", firstWalletData);
        assert(firstWalletData.wallets[firstWallet.address], "Il primo wallet dovrebbe essere salvato");
        
        // Attendi un momento per la sincronizzazione
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Crea un secondo wallet
        console.log("📝 Creazione secondo wallet...");
        const secondWallet = await waitForOperation(hedgehog.createNewWallet("Secondo Wallet"));
        console.log("✅ Secondo wallet creato:", secondWallet.address);
        
        // Attendi un momento per la sincronizzazione
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Attendi che il secondo wallet sia salvato
        console.log("🔄 Attendo salvataggio secondo wallet...");
        const secondWalletData = await waitForWallet(hedgehog.getGunInstance(), secondWallet.address, username);
        console.log("✅ Secondo wallet salvato:", secondWalletData);
        
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
        console.log("🔵 Test rimozione wallet per:", username);
        
        // Registrazione e primo wallet
        console.log("📝 Creazione primo wallet...");
        const firstWallet = await waitForOperation(hedgehog.signUp(username, "password123"));
        console.log("✅ Primo wallet creato:", firstWallet.address);
        
        // Attendi che il primo wallet sia salvato
        console.log("🔄 Attendo salvataggio primo wallet...");
        const firstWalletData = await waitForWallet(hedgehog.getGunInstance(), firstWallet.address, username);
        console.log("✅ Primo wallet salvato:", firstWalletData);
        assert(firstWalletData.wallets[firstWallet.address], "Il primo wallet dovrebbe essere salvato");
        assert(firstWalletData.selectedWallet === firstWallet.address, "Il primo wallet dovrebbe essere selezionato");
        
        // Attendi un momento per la sincronizzazione
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Crea un secondo wallet
        console.log("📝 Creazione secondo wallet...");
        const secondWallet = await waitForOperation(hedgehog.createNewWallet("Secondo Wallet"));
        console.log("✅ Secondo wallet creato:", secondWallet.address);
        
        // Attendi un momento per la sincronizzazione
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Attendi che il secondo wallet sia salvato
        console.log("🔄 Attendo salvataggio secondo wallet...");
        const secondWalletData = await waitForWallet(hedgehog.getGunInstance(), secondWallet.address, username);
        console.log("✅ Secondo wallet salvato:", secondWalletData);
        assert.strictEqual(Object.keys(secondWalletData.wallets).length, 2, "Dovrebbero esserci due wallet");
        
        // Attendi un momento per la sincronizzazione
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Rimuovi il secondo wallet
        console.log("🗑️ Rimozione secondo wallet...");
        await waitForOperation(hedgehog.removeWallet(secondWallet.address));
        console.log("✅ Secondo wallet rimosso");
        
        // Attendi un momento per la sincronizzazione
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Verifica che rimanga solo il primo wallet
        console.log("🔄 Verifica finale dati...");
        const finalData = await waitForWallet(hedgehog.getGunInstance(), firstWallet.address, username);
        console.log("✅ Verifica finale completata:", finalData);
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
        const initialData = await waitForWallet(hedgehog.getGunInstance(), firstWallet.address, username);
        assert(initialData.wallets[firstWallet.address], "Il wallet dovrebbe essere salvato");
        assert(initialData.selectedWallet === firstWallet.address, "Il wallet dovrebbe essere selezionato");
        
        // Logout e attendi che sia completato
        await waitForOperation(hedgehog.logout());
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Login e verifica dati
        const wallet = await waitForOperation(hedgehog.login(username, password));
        assert.strictEqual(wallet.address, firstWallet.address, "Dovrebbe recuperare lo stesso wallet");
        
        // Attendi che i dati siano sincronizzati dopo il login
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Verifica che i dati siano ancora presenti
        const finalData = await waitForWallet(hedgehog.getGunInstance(), firstWallet.address, username);
        assert(finalData.wallets[firstWallet.address], "Il wallet dovrebbe essere mantenuto");
        assert(finalData.selectedWallet === firstWallet.address, "Il wallet dovrebbe rimanere selezionato");
      });

      it("dovrebbe gestire correttamente il wallet selezionato", async function () {
        const username = generateUniqueUsername();
        const firstWallet = await waitForOperation(hedgehog.signUp(username, "password123"));
        const secondWallet = await waitForOperation(hedgehog.createNewWallet("Secondo Wallet"));
        
        // Verifica che il primo wallet sia selezionato di default
        let userData = await waitForGunData(hedgehog.getGunInstance(), username);
        assert.strictEqual(userData.selectedWallet, firstWallet.address, "Il primo wallet dovrebbe essere selezionato di default");
        
        // Cambia il wallet selezionato
        await waitForOperation(hedgehog.switchWallet(secondWallet.address));
        
        // Verifica che il secondo wallet sia ora selezionato
        userData = await waitForGunData(hedgehog.getGunInstance(), username);
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
