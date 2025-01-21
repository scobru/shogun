// test/stealthChainAlternative.test.js

const { describe, it, beforeEach, afterEach } = require("mocha");
const assert = require("assert");

// Importa la classe che vogliamo testare
const { StealthChain } = require("../src/StealthChain");

// Importa (o istanzia) il WalletManager
// L'importante è che poi possiamo estrarre la stessa istanza di Gun usata da esso
const { WalletManager } = require("../src/WalletManager");

/**
 * Crea un alias random per evitare conflitti di nomi utente
 */
function generateRandomAlias() {
  const suffix = Math.random().toString(36).substring(2);
  return `testuser_${suffix}`;
}

/**
 * Esegue una pausa (ad esempio per dare tempo a Gun di sincronizzare)
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polling generico, chiama `checkFn` ripetutamente finché non ritorna true
 * o finché non scadono i tentativi.
 */
async function waitUntil(checkFn, maxAttempts = 15, interval = 500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (await checkFn()) return true;
    await sleep(interval);
  }
  throw new Error(`Condizione non soddisfatta dopo ${maxAttempts} tentativi`);
}

describe("StealthChain (usando l'istanza Gun del WalletManager)", function () {
  this.timeout(120000);

  let manager;        // L'istanza di WalletManager
  let gun;            // L'istanza di Gun estratta da manager
  let user;           // L'utente Gun per creare/loggare manualmente
  let stealthChain;   // L'istanza di StealthChain basata su gun

  beforeEach(async function () {
    this.timeout(30000);
    
    console.log("\n=== Setup: creazione manager e recupero Gun ===");
    // 1. Creiamo un nuovo manager
    manager = new WalletManager();

    // 2. Ricaviamo l'istanza di Gun dal manager
    gun = manager.getGun();
    if (!gun) {
      throw new Error("Impossibile ottenere l'istanza Gun dal manager");
    }

    // 3. Creiamo l'utente Gun manualmente (senza usare manager.createAccount)
    user = gun.user();

    const alias = generateRandomAlias();
    const passphrase = "passwordProva";

    console.log("Creazione utente con alias:", alias);

    // Prova a creare l'utente con più tentativi
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        await new Promise((resolve, reject) => {
          user.create(alias, passphrase, async (ack) => {
            if (ack.err) {
              if (ack.err.includes("already created")) {
                console.log("Account già esistente, provo il login...");
                user.auth(alias, passphrase, (authAck) => {
                  if (authAck.err) reject(new Error(`Login fallito: ${authAck.err}`));
                  else resolve();
                });
              } else {
                reject(new Error(`Errore creazione utente: ${ack.err}`));
              }
            } else {
              console.log("Account creato, effettuo login...");
              user.auth(alias, passphrase, (authAck) => {
                if (authAck.err) reject(new Error(`Login fallito: ${authAck.err}`));
                else resolve();
              });
            }
          });
        });
        break;
      } catch (error) {
        attempts++;
        if (attempts === maxAttempts) throw error;
        console.log(`Tentativo ${attempts} fallito, riprovo...`);
        await sleep(1000);
      }
    }

    // Attendi che Gun sia pronto
    await sleep(2000);

    // Verifica di essere loggati con più tentativi
    await waitUntil(() => {
      const isLogged = !!gun.user().is;
      if (!isLogged) console.log("Attendo login...");
      return isLogged;
    }, 15, 1000);

    console.log("🔑 Utente creato/loggato con successo:", user.is.pub);

    // 4. Istanzia StealthChain usando la Gun di manager
    stealthChain = new StealthChain(gun);

    // Verifica che StealthChain sia pronto
    if (!stealthChain) {
      throw new Error("StealthChain non inizializzato correttamente");
    }

    console.log("=== Setup completato ===\n");
  });

  afterEach(async function () {
    console.log("\n=== Teardown: logout utente e disconnessione Gun ===");
    try {
      if (gun && gun.user()) {
        gun.user().leave();
        console.log("👤 Utente disconnesso da Gun");
      }
      // Gun non ha un vero "close", ma possiamo togliere i listener
      if (gun && gun.off) {
        gun.off();
      }
      await sleep(1000);
    } catch (err) {
      console.warn("❌ Errore in afterEach:", err.message);
    }
    console.log("=== Fine Teardown ===\n");
  });

  it("dovrebbe generare chiavi stealth e salvarle", async function () {
    console.log("Test: generazione e salvataggio chiavi stealth");
    // 1. Genera chiavi stealth
    const generatedKeyPair = await new Promise((resolve, reject) => {
      stealthChain.generateStealthKeys((err, result) => {
        if (err) {
          console.error("Errore nella generazione delle chiavi:", err);
          return reject(err);
        }
        console.log("Chiavi generate:", result);
        resolve(result);
      });
    });

    // Verifica che le chiavi siano state generate correttamente
    assert(generatedKeyPair, "generateStealthKeys non ha restituito nulla");
    assert(generatedKeyPair.pub, "Manca la chiave pubblica");
    assert(generatedKeyPair.priv, "Manca la chiave privata");
    assert(generatedKeyPair.epub, "Manca la chiave pubblica effimera");
    assert(generatedKeyPair.epriv, "Manca la chiave privata effimera");

    // Attendi che Gun sia pronto prima di salvare
    await sleep(1000);

    // Salva le chiavi stealth con gestione errori
    await new Promise((resolve, reject) => {
      stealthChain.saveStealthKeys(generatedKeyPair, (err) => {
        if (err) {
          console.error("Errore nel salvataggio delle chiavi:", err);
          return reject(err);
        }
        console.log("Chiavi salvate con successo");
        resolve();
      });
    });

    // Attendi che Gun sincronizzi i dati
    await sleep(2000);

    // Recupera le chiavi con gestione errori
    const retrievedKeys = await new Promise((resolve, reject) => {
      stealthChain.retrieveStealthKeysFromUser((err, keys) => {
        if (err) {
          console.error("Errore nel recupero delle chiavi:", err);
          return reject(err);
        }
        console.log("Chiavi recuperate:", keys);
        resolve(keys);
      });
    });

    // Verifica le chiavi recuperate
    assert(retrievedKeys, "Nessuna chiave recuperata");
    assert.strictEqual(
      retrievedKeys.pub,
      generatedKeyPair.pub,
      "Le chiavi stealth recuperate non corrispondono (pub)"
    );
    assert.strictEqual(
      retrievedKeys.priv,
      generatedKeyPair.priv,
      "Le chiavi stealth recuperate non corrispondono (priv)"
    );
    console.log("✅ Chiavi stealth generate e salvate con successo");
  });

  it("dovrebbe generare e 'aprire' un indirizzo stealth", async function () {
    console.log("Test: generazione e apertura di un indirizzo stealth");
    
    // 1. Genera + Salva chiavi stealth
    console.log("Generazione chiavi stealth...");
    const generatedKeyPair = await new Promise((resolve, reject) => {
      stealthChain.generateStealthKeys((err, result) => {
        if (err) {
          console.error("Errore nella generazione delle chiavi:", err);
          return reject(err);
        }
        console.log("Chiavi generate:", result);
        resolve(result);
      });
    });

    // Attendi che Gun sia pronto
    await sleep(1000);

    console.log("Salvataggio chiavi stealth...");
    await new Promise((resolve, reject) => {
      stealthChain.saveStealthKeys(generatedKeyPair, (err) => {
        if (err) {
          console.error("Errore nel salvataggio delle chiavi:", err);
          return reject(err);
        }
        console.log("Chiavi salvate con successo");
        resolve();
      });
    });

    // Attendi che Gun sincronizzi i dati
    await sleep(2000);

    // 2. Genera l'indirizzo stealth per la stessa chiave pubblica (autodestinatario)
    const myPublicKey = user.is.pub;
    console.log("Generazione indirizzo stealth per:", myPublicKey);
    
    const stealthData = await new Promise((resolve, reject) => {
      stealthChain.generateStealthAddress(myPublicKey, (err, data) => {
        if (err) {
          console.error("Errore nella generazione dell'indirizzo stealth:", err);
          return reject(err);
        }
        console.log("Indirizzo stealth generato:", data);
        resolve(data);
      });
    });

    assert(stealthData.stealthAddress, "Manca l'indirizzo stealth generato");
    assert(stealthData.ephemeralPublicKey, "Manca la ephemeralPublicKey generata");
    assert.strictEqual(
      stealthData.recipientPublicKey,
      myPublicKey,
      "Recipient public key non corrisponde"
    );

    // Attendi che Gun sincronizzi i dati
    await sleep(2000);

    // 3. Apri l'indirizzo stealth
    console.log("Apertura indirizzo stealth...");
    const recoveredWallet = await new Promise((resolve, reject) => {
      stealthChain.openStealthAddress(
        stealthData.stealthAddress,
        stealthData.ephemeralPublicKey,
        (err, wallet) => {
          if (err) {
            console.error("Errore nell'apertura dell'indirizzo stealth:", err);
            return reject(err);
          }
          console.log("Wallet recuperato:", wallet.address);
          resolve(wallet);
        }
      );
    });

    assert(recoveredWallet.address, "Il wallet decrittato non ha un indirizzo");
    assert(recoveredWallet.privateKey, "Il wallet decrittato non ha una chiave privata");
    assert.strictEqual(
      recoveredWallet.address.toLowerCase(),
      stealthData.stealthAddress.toLowerCase(),
      "L'indirizzo recuperato non corrisponde a quello generato"
    );
    console.log("✅ Indirizzo stealth generato e aperto con successo");
  });
});
