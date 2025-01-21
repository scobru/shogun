const { describe, it, beforeEach, afterEach } = require("mocha");
const assert = require("assert");
const { WalletManager } = require("../src/WalletManager");
const { StealthChain } = require("../src/StealthChain");

// Genera username unici
const generateUniqueUsername = () =>
  `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

describe("StealthChain Test Suite", function () {
  this.timeout(90000);
  
  let walletManager;
  let stealthChain;
  
  beforeEach(function(done) {
    console.log("🚀 Inizializzazione test...");
    
    // Aumenta il timeout per questo hook
    this.timeout(30000);
    
    try {
      console.log("📦 Creazione WalletManager...");
      walletManager = new WalletManager();
      
      console.log("🔗 Ottenimento StealthChain...");
      stealthChain = walletManager.getStealthChain();
      
      const alias = "test_" + Math.random().toString(36).substring(7);
      console.log("🔑 Creazione account di test:", alias);
      
      // Funzione per verificare il login
      const checkLogin = () => {
        const user = walletManager.getGun().user();
        return user && user.is && user.is.pub;
      };
      
      walletManager.createAccount(alias, "password123!", (err) => {
        if (err) {
          console.error("❌ Errore nella creazione account:", err);
          done(err);
          return;
        }
        
        console.log("🔄 Verifica login...");
        
        // Polling per verificare il login
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkLoginStatus = () => {
          if (checkLogin()) {
            console.log("✅ Account di test creato e login completato");
            done();
          } else if (attempts < maxAttempts) {
            attempts++;
            console.log(`⏳ Attesa login... Tentativo ${attempts}/${maxAttempts}`);
            setTimeout(checkLoginStatus, 1000);
          } else {
            const error = new Error("Login non completato dopo i tentativi massimi");
            console.error("❌", error.message);
            done(error);
          }
        };
        
        checkLoginStatus();
      });
    } catch (error) {
      console.error("❌ Errore critico nel beforeEach:", error);
      done(error);
    }
  });

  afterEach(function(done) {
    try {
      if (walletManager && walletManager.getGun()) {
        walletManager.getGun().off();
      }
      done();
    } catch (error) {
      console.error("❌ Errore nel afterEach:", error);
      done(error);
    }
  });

  it("dovrebbe generare chiavi stealth valide", function(done) {
    stealthChain.generateStealthKeys((err, stealthKeyPair) => {
      if (err) {
        console.error("❌ Errore nella generazione chiavi:", err);
        done(err);
        return;
      }
      
      try {
        assert(stealthKeyPair && stealthKeyPair.stealthKeyPair, "Il keyPair dovrebbe esistere");
        const keys = stealthKeyPair.stealthKeyPair;
        assert(keys.pub, "Dovrebbe contenere la chiave pubblica");
        assert(keys.priv, "Dovrebbe contenere la chiave privata");
        assert(keys.epub, "Dovrebbe contenere la chiave pubblica effimera");
        assert(keys.epriv, "Dovrebbe contenere la chiave privata effimera");
        console.log("✅ Test generazione chiavi completato con successo");
        done();
      } catch (error) {
        console.error("❌ Errore nelle asserzioni:", error);
        done(error);
      }
    });
  });

  it("dovrebbe salvare e recuperare chiavi stealth", function(done) {
    stealthChain.generateStealthKeys((err, stealthKeyPair) => {
      if (err) {
        console.error("❌ Errore nella generazione chiavi:", err);
        done(err);
        return;
      }

      try {
        assert(stealthKeyPair && stealthKeyPair.stealthKeyPair, "Le chiavi dovrebbero essere generate");
        
        stealthChain.saveStealthKeys(stealthKeyPair.stealthKeyPair, (saveErr) => {
          if (saveErr) {
            console.error("❌ Errore nel salvataggio chiavi:", saveErr);
            done(saveErr);
            return;
          }

          console.log("✅ Chiavi salvate, tentativo di recupero...");
          stealthChain.retrieveStealthKeysFromUser((retrieveErr, retrievedKeys) => {
            if (retrieveErr) {
              console.error("❌ Errore nel recupero chiavi:", retrieveErr);
              done(retrieveErr);
              return;
            }

            try {
              assert(retrievedKeys, "Le chiavi dovrebbero essere recuperate");
              
              const expected = stealthKeyPair.stealthKeyPair;
              assert.strictEqual(retrievedKeys.pub, expected.pub, "La chiave pubblica dovrebbe corrispondere");
              assert.strictEqual(retrievedKeys.priv, expected.priv, "La chiave privata dovrebbe corrispondere");
              assert.strictEqual(retrievedKeys.epub, expected.epub, "La chiave pubblica effimera dovrebbe corrispondere");
              assert.strictEqual(retrievedKeys.epriv, expected.epriv, "La chiave privata effimera dovrebbe corrispondere");

              const publicKey = walletManager.getGun().user()._.sea.pub;
              console.log("🔍 Verifica chiavi nel registro per:", publicKey);
              
              stealthChain.retrieveStealthKeysFromRegistry(publicKey, (regErr, pubStealthKey) => {
                if (regErr) {
                  console.error("❌ Errore nel recupero dal registro:", regErr);
                  done(regErr);
                  return;
                }

                try {
                  assert(pubStealthKey, "La chiave pubblica effimera dovrebbe essere nel registro");
                  assert.strictEqual(pubStealthKey, expected.epub, "La chiave pubblica effimera dovrebbe corrispondere");
                  console.log("✅ Test salvataggio e recupero completato con successo");
                  done();
                } catch (error) {
                  console.error("❌ Errore nelle asserzioni finali:", error);
                  done(error);
                }
              });
            } catch (error) {
              console.error("❌ Errore nelle asserzioni di recupero:", error);
              done(error);
            }
          });
        });
      } catch (error) {
        console.error("❌ Errore generale nel test:", error);
        done(error);
      }
    });
  });

  it("dovrebbe gestire errori con chiavi non valide", function(done) {
    stealthChain.generateStealthAddress("invalid_pub_key", (err) => {
      try {
        assert(err && err.message && err.message.includes("Chiavi non valide"), 
               "L'errore dovrebbe indicare un problema con le chiavi");
        console.log("✅ Test gestione errori completato con successo");
        done();
      } catch (error) {
        console.error("❌ Errore nel test di gestione errori:", error);
        done(error);
      }
    });
  });

  it("dovrebbe permettere al destinatario di recuperare l'indirizzo stealth", function(done) {
    stealthChain.generateStealthKeys((err, recipientKeys) => {
      if (err) {
        console.error("❌ Errore nella generazione chiavi:", err);
        done(err);
        return;
      }

      stealthChain.saveStealthKeys(recipientKeys.stealthKeyPair, (saveErr) => {
        if (saveErr) {
          console.error("❌ Errore nel salvataggio chiavi:", saveErr);
          done(saveErr);
          return;
        }

        const publicKey = walletManager.getGun().user()._.sea.pub;
        console.log("🔍 Recupero chiavi dal registro per:", publicKey);
        
        stealthChain.retrieveStealthKeysFromRegistry(publicKey, (regErr, pubStealthKey) => {
          if (regErr) {
            console.error("❌ Errore nel recupero dal registro:", regErr);
            done(regErr);
            return;
          }

          try {
            assert(pubStealthKey, "La chiave pubblica effimera dovrebbe essere nel registro");

            stealthChain.generateStealthAddress(publicKey, (genErr, result) => {
              if (genErr) {
                console.error("❌ Errore nella generazione indirizzo stealth:", genErr);
                done(genErr);
                return;
              }

              try {
                assert(result.stealthAddress, "Dovrebbe generare un indirizzo stealth");
                assert(result.ephemeralPublicKey, "Dovrebbe generare una chiave pubblica effimera");
                assert.strictEqual(result.recipientPublicKey, publicKey, "Dovrebbe includere la chiave pubblica del destinatario");

                stealthChain.openStealthAddress(
                  result.stealthAddress,
                  result.ephemeralPublicKey,
                  (openErr, recoveredWallet) => {
                    if (openErr) {
                      console.error("❌ Errore nell'apertura indirizzo stealth:", openErr);
                      done(openErr);
                      return;
                    }

                    try {
                      assert(recoveredWallet.address, "Dovrebbe recuperare un indirizzo");
                      assert(recoveredWallet.privateKey, "Dovrebbe recuperare una chiave privata");
                      assert.strictEqual(
                        recoveredWallet.address.toLowerCase(),
                        result.stealthAddress.toLowerCase(),
                        "L'indirizzo recuperato dovrebbe corrispondere"
                      );
                      console.log("✅ Test recupero indirizzo stealth completato con successo");
                      done();
                    } catch (error) {
                      console.error("❌ Errore nelle asserzioni finali:", error);
                      done(error);
                    }
                  }
                );
              } catch (error) {
                console.error("❌ Errore nelle asserzioni dell'indirizzo:", error);
                done(error);
              }
            });
          } catch (error) {
            console.error("❌ Errore nelle asserzioni del registro:", error);
            done(error);
          }
        });
      });
    });
  });
}); 