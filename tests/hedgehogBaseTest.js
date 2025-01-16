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
const waitForGunData = async (gun, username, expectedData = null, timeout = 30000) => {
  console.log(`🔄 Iniziata attesa dati per ${username}`);
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.log(`⚠️ TIMEOUT per ${username}`);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      ref.off(); // Rimuove tutti i listener
      reject(new Error(`Timeout attendendo i dati per il path: ${username}`));
    }, timeout);

    let resolved = false;
    let unsubscribe = null;
    let processedData = new Set();

    const processData = async (data) => {
      try {
        // Crea una chiave unica per questi dati
        const dataKey = JSON.stringify({
          username: data?.username,
          selectedWallet: data?.selectedWallet,
          walletsRef: data?.wallets?.['#']
        });

        // Se abbiamo già processato questi dati esatti, ignoriamo
        if (processedData.has(dataKey)) {
          return;
        }
        processedData.add(dataKey);
        
        console.log(`📥 Ricevuti dati per ${username}:`, data);
        
        if (!data) return;

        if (expectedData) {
          if (typeof expectedData === 'function') {
            const result = await expectedData(data);
            if (!result) return;
          } else {
            const expected = typeof expectedData === 'string' ? expectedData : JSON.stringify(expectedData);
            const actual = typeof data === 'string' ? data : JSON.stringify(data);
            if (expected !== actual) return;
          }
        }

        if (!resolved) {
          console.log(`✅ Dati validi trovati per ${username}`);
          resolved = true;
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
          ref.off(); // Rimuove tutti i listener
          clearTimeout(timeoutId);
          resolve(data);
        }
      } catch (error) {
        console.error(`❌ Errore durante l'elaborazione dei dati per ${username}:`, error);
        if (!resolved) {
          resolved = true;
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
          ref.off(); // Rimuove tutti i listener
          clearTimeout(timeoutId);
          reject(error);
        }
      }
    };

    const ref = gun.get('accounts').get(username);
    ref.on(processData); // Non salviamo il risultato di .on() perché non è una funzione
    ref.once(processData);
  });
};

// Funzione di utilità per attendere che un wallet sia salvato
async function waitForWallet(gun, address, username) {
  console.log(`🔄 Attendo wallet per ${username}, indirizzo: ${address}`);
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.log(`⚠️ TIMEOUT per wallet ${address}`);
      cleanup();
      reject(new Error(`Timeout attendendo il wallet: ${address}`));
    }, 30000);

    let resolved = false;
    let processedData = new Set();

    const cleanup = () => {
      gun.get('accounts').get(username).off();
      clearTimeout(timeoutId);
    };

    const processData = async (data) => {
      if (resolved) return;

      // Crea una chiave unica per questi dati
      const dataKey = JSON.stringify(data);
      if (processedData.has(dataKey)) return;
      processedData.add(dataKey);

      console.log('📥 Dati ricevuti:', data);
      
      if (!data || !data.wallets) return;

      // Se i wallet sono un riferimento, lo seguiamo
      if (data.wallets['#']) {
        gun.get(data.wallets['#']).once((walletsData) => {
          if (!walletsData || !walletsData[address]) return;
          
          const walletRef = walletsData[address];
          if (!walletRef || !walletRef['#']) return;

          gun.get(walletRef['#']).once((walletData) => {
            if (!walletData || !walletData.address || !walletData.entropy) return;
            
            console.log('✅ Wallet trovato e valido:', walletData);
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve({ 
                ...data,
                wallets: {
                  ...walletsData,
                  [address]: walletData
                }
              });
            }
          });
        });
      } 
      // Se i wallet sono inline
      else if (typeof data.wallets === 'object') {
        const wallet = data.wallets[address];
        if (!wallet || !wallet.address || !wallet.entropy) return;
        
        console.log('✅ Wallet trovato e valido:', wallet);
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(data);
        }
      }
    };

    // Inizia l'ascolto dei dati
    const accountRef = gun.get('accounts').get(username);
    accountRef.on(processData);
    accountRef.once(processData);
  });
}

// Funzione di utilità per attendere che un'operazione sia completata
const waitForOperation = async (operation) => {
  const result = await operation;
  await new Promise(resolve => setTimeout(resolve, 8000));
  return result;
};

describe("Hedgehog Test Suite", function () {
  this.timeout(60000);

  let hedgehog;
  let instances = [];

  beforeEach(async function () {
    hedgehog = new GunHedgehog({
    });
    instances.push(hedgehog);
    await hedgehog.waitUntilReady();
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterEach(async function() {
    for (const instance of instances) {
      if (instance.user) {
        instance.user.leave();
      }
    }
    instances = [];
    await new Promise(resolve => setTimeout(resolve, 2000));
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
        
        // Prima registrazione
        const firstWallet = await waitForOperation(hedgehog.signUp(username, "password123"));
        await waitForWallet(hedgehog.getGunInstance(), firstWallet.address, username);
        
        // Logout
        hedgehog.logout();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Login e verifica
        const loginWallet = await waitForOperation(hedgehog.login(username, "password123"));
        assert(loginWallet, "Dovrebbe ottenere un wallet dopo il login");
        assert.strictEqual(loginWallet.address, firstWallet.address, "Dovrebbe recuperare lo stesso wallet");
        
        // Verifica dati account
        const finalData = await waitForWallet(hedgehog.getGunInstance(), firstWallet.address, username);
        assert(finalData.wallets[firstWallet.address], "Il wallet dovrebbe essere accessibile dopo il login");
      });

      it("dovrebbe creare wallet con entropy unica", async function () {
        const username = generateUniqueUsername();
        const firstWallet = await waitForOperation(hedgehog.signUp(username, "password123"));
        
        // Attendi che il primo wallet sia salvato e verifica
        const initialData = await waitForWallet(hedgehog.getGunInstance(), firstWallet.address, username);
        assert(initialData.wallets && initialData.wallets[firstWallet.address], 
          "Il primo wallet dovrebbe essere salvato inizialmente");
        
        // Crea un secondo wallet
        const secondWallet = await waitForOperation(hedgehog.createNewWallet("Secondo Wallet"));
        
        // Attendi che il secondo wallet sia salvato
        const secondWalletData = await waitForWallet(hedgehog.getGunInstance(), secondWallet.address, username);
        
        // Verifica che entrambi i wallet esistano
        assert(secondWalletData.wallets && secondWalletData.wallets[firstWallet.address], 
          "Il primo wallet dovrebbe ancora esistere");
        assert(secondWalletData.wallets && secondWalletData.wallets[secondWallet.address], 
          "Il secondo wallet dovrebbe esistere");
        
        // Verifica che le entropy siano diverse
        assert.notStrictEqual(
          secondWalletData.wallets[firstWallet.address].entropy,
          secondWalletData.wallets[secondWallet.address].entropy,
          "I wallet dovrebbero avere entropy diverse"
        );
      });

      it("dovrebbe rimuovere un wallet solo se ce ne sono altri", async function () {
        const username = generateUniqueUsername();
        const firstWallet = await waitForOperation(hedgehog.signUp(username, "password123"));
        
        // Attendi che il primo wallet sia salvato
        await waitForWallet(hedgehog.getGunInstance(), firstWallet.address, username);
        
        // Prova a rimuovere l'unico wallet (dovrebbe fallire)
        try {
          await hedgehog.removeWallet(firstWallet.address);
          assert.fail("Non dovrebbe essere possibile rimuovere l'unico wallet");
        } catch (error) {
          assert(error.message.includes("ultimo"), "Dovrebbe indicare che non si può rimuovere l'ultimo wallet");
        }
        
        // Crea un secondo wallet
        const secondWallet = await waitForOperation(hedgehog.createNewWallet("Secondo Wallet"));
        await waitForWallet(hedgehog.getGunInstance(), secondWallet.address, username);
        
        // Attendi un momento per la sincronizzazione
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Ora dovrebbe essere possibile rimuovere il primo wallet
        await waitForOperation(hedgehog.removeWallet(firstWallet.address));
        
        // Attendi un momento per la sincronizzazione
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verifica che il primo wallet sia stato rimosso
        const finalData = await waitForGunData(hedgehog.getGunInstance(), username);
        assert(!finalData.wallets[firstWallet.address], "Il primo wallet dovrebbe essere stato rimosso");
        assert(finalData.wallets[secondWallet.address], "Il secondo wallet dovrebbe ancora esistere");
        assert.strictEqual(finalData.selectedWallet, secondWallet.address, "Il secondo wallet dovrebbe essere selezionato");
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
        
        // Prima sessione
        const firstWallet = await waitForOperation(hedgehog.signUp(username, "password123"));
        await waitForWallet(hedgehog.getGunInstance(), firstWallet.address, username);
        
        // Logout
        hedgehog.logout();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Seconda sessione
        const secondInstance = new GunHedgehog({});
        instances.push(secondInstance);
        await secondInstance.waitUntilReady();
        
        // Login nella seconda sessione
        const recoveredWallet = await waitForOperation(secondInstance.login(username, "password123"));
        assert(recoveredWallet, "Dovrebbe recuperare il wallet nella nuova sessione");
        assert.strictEqual(recoveredWallet.address, firstWallet.address, "Dovrebbe recuperare lo stesso wallet");
        
        // Verifica dati account
        const finalData = await waitForWallet(secondInstance.getGunInstance(), firstWallet.address, username);
        assert(finalData.wallets[firstWallet.address], "Il wallet dovrebbe essere accessibile nella nuova sessione");
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
        
        // Attendi che i dati siano sincronizzati
        await new Promise(resolve => setTimeout(resolve, 2000));
        
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
