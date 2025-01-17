import { WalletManager } from '@hugo/WalletManager';

// Inizializza il WalletManager
const walletManager = new WalletManager();
const stealthChain = walletManager.getStealthChain();

// Elementi DOM
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const createAccountBtn = document.getElementById('createAccount');
const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');
const generateKeysBtn = document.getElementById('generateKeys');
const keysInfoDiv = document.getElementById('keysInfo');
const spendingKeyDiv = document.getElementById('spendingKey');
const viewingKeyDiv = document.getElementById('viewingKey');
const recipientUsernameInput = document.getElementById('recipientUsername');
const generateStealthAddressBtn = document.getElementById('generateStealthAddress');
const stealthAddressInfoDiv = document.getElementById('stealthAddressInfo');
const stealthAddressDiv = document.getElementById('stealthAddress');
const ephemeralPublicKeyDiv = document.getElementById('ephemeralPublicKey');
const stealthAddressInput = document.getElementById('stealthAddressInput');
const ephemeralKeyInput = document.getElementById('ephemeralKeyInput');
const recoverStealthAddressBtn = document.getElementById('recoverStealthAddress');
const recoveredAddressInfoDiv = document.getElementById('recoveredAddressInfo');
const recoveredAddressDiv = document.getElementById('recoveredAddress');
const recoveredPrivateKeyDiv = document.getElementById('recoveredPrivateKey');
const statusDiv = document.getElementById('status');

// Funzioni di utilità
function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    statusDiv.className = `status ${isError ? 'error' : 'success'}`;
}

function updateButtonStates(isLoggedIn) {
    createAccountBtn.disabled = isLoggedIn;
    loginBtn.disabled = isLoggedIn;
    logoutBtn.disabled = !isLoggedIn;
    generateKeysBtn.disabled = !isLoggedIn;
    generateStealthAddressBtn.disabled = !isLoggedIn;
    recoverStealthAddressBtn.disabled = !isLoggedIn;
}

// Event Listeners
createAccountBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (!username || !password) {
        showStatus('Username e password sono richiesti', true);
        return;
    }
    
    try {
        await walletManager.createAccount(username, password);
        showStatus('Account creato con successo! Sei ora loggato.');
        updateButtonStates(true);
    } catch (error) {
        showStatus(`Errore nella creazione dell'account: ${error.message}`, true);
    }
});

loginBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (!username || !password) {
        showStatus('Username e password sono richiesti', true);
        return;
    }
    
    try {
        const publicKey = await walletManager.login(username, password);
        if (publicKey) {
            showStatus('Login effettuato con successo!');
            updateButtonStates(true);
        } else {
            showStatus('Login fallito: chiave pubblica non trovata', true);
        }
    } catch (error) {
        showStatus(`Errore nel login: ${error.message}`, true);
    }
});

logoutBtn.addEventListener('click', () => {
    walletManager.logout();
    showStatus('Logout effettuato con successo');
    updateButtonStates(false);
    keysInfoDiv.style.display = 'none';
    stealthAddressInfoDiv.style.display = 'none';
    recoveredAddressInfoDiv.style.display = 'none';
});

generateKeysBtn.addEventListener('click', async () => {
    try {
        const username = usernameInput.value.trim();
        const gunKeyPair = walletManager.getCurrentUserKeyPair();
        
        console.log("🔑 GunKeyPair corrente:", gunKeyPair);
        
        if (!gunKeyPair) {
            showStatus('Errore: KeyPair non trovato', true);
            return;
        }

        // Verifica che il keypair sia completo
        if (!gunKeyPair.pub || !gunKeyPair.priv || !gunKeyPair.epub || !gunKeyPair.epriv) {
            showStatus('Errore: KeyPair incompleto', true);
            console.error("KeyPair incompleto:", gunKeyPair);
            return;
        }

        const stealthKeys = {
            spendingKey: gunKeyPair.pub,
            viewingKeyPair: {
                pub: gunKeyPair.pub,
                priv: gunKeyPair.priv,
                epub: gunKeyPair.epub,
                epriv: gunKeyPair.epriv
            }
        };

        // Salva prima in localStorage
        await stealthChain.saveStealthKeysLocally(username, stealthKeys);
        console.log("💾 Chiavi salvate in localStorage");

        // Salva su Gun con percorso corretto
        await new Promise((resolve, reject) => {
            // Usa il nodo user per il salvataggio
            const userNode = walletManager.gun.user();
            
            // Prima salva il viewingKeyPair
            userNode.get('stealth')
                   .get(username)
                   .get('viewingKeyPair')
                   .put({
                       pub: stealthKeys.viewingKeyPair.pub,
                       priv: stealthKeys.viewingKeyPair.priv,
                       epub: stealthKeys.viewingKeyPair.epub,
                       epriv: stealthKeys.viewingKeyPair.epriv
                   }, (ack) => {
                       if (ack.err) {
                           console.error("Errore nel salvataggio del viewingKeyPair:", ack.err);
                           reject(new Error(ack.err));
                           return;
                       }
                       
                       // Poi salva la spendingKey
                       userNode.get('stealth')
                              .get(username)
                              .get('spendingKey')
                              .put(stealthKeys.spendingKey, (ack) => {
                                  if (ack.err) {
                                      console.error("Errore nel salvataggio della spendingKey:", ack.err);
                                      reject(new Error(ack.err));
                                  } else {
                                      console.log("✅ Salvataggio su Gun completato");
                                      resolve();
                                  }
                              });
                   });
        });

        // Verifica il salvataggio
        const savedKeys = await new Promise((resolve, reject) => {
            const userNode = walletManager.gun.user();
            userNode.get('stealth').get(username).once((data) => {
                console.log("📖 Dati recuperati da Gun:", data);
                if (!data || !data.spendingKey || !data.viewingKeyPair) {
                    reject(new Error("Chiavi non trovate su Gun"));
                    return;
                }

                // Recupera il viewingKeyPair completo
                userNode.get('stealth')
                       .get(username)
                       .get('viewingKeyPair')
                       .once((viewingKeyPair) => {
                           if (!viewingKeyPair || 
                               !viewingKeyPair.pub || 
                               !viewingKeyPair.priv || 
                               !viewingKeyPair.epub || 
                               !viewingKeyPair.epriv) {
                               reject(new Error("ViewingKeyPair incompleto"));
                               return;
                           }

                           const completeKeys = {
                               spendingKey: data.spendingKey,
                               viewingKeyPair: viewingKeyPair
                           };
                           console.log("🔐 Chiavi complete recuperate:", completeKeys);
                           resolve(completeKeys);
                       });
            });
        });

        console.log("🔐 Chiavi stealth verificate:", savedKeys);

        // Mostra le chiavi
        spendingKeyDiv.textContent = savedKeys.spendingKey;
        viewingKeyDiv.textContent = savedKeys.viewingKeyPair.epub;
        keysInfoDiv.style.display = 'block';

        showStatus('Chiavi stealth generate e salvate con successo!');
    } catch (error) {
        console.error("❌ Errore completo:", error);
        // Prova a recuperare da localStorage
        try {
            const localKeys = await stealthChain.retrieveStealthKeysLocally(username);
            spendingKeyDiv.textContent = localKeys.spendingKey;
            viewingKeyDiv.textContent = localKeys.viewingKeyPair.epub;
            keysInfoDiv.style.display = 'block';
            showStatus('Chiavi recuperate da localStorage (salvataggio su Gun fallito)');
        } catch (localError) {
            showStatus(`Errore nella generazione delle chiavi stealth: ${error.message}`, true);
        }
    }
});

generateStealthAddressBtn.addEventListener('click', async () => {
    try {
        const recipientUsername = recipientUsernameInput.value.trim();
        
        if (!recipientUsername) {
            showStatus('Username del destinatario richiesto', true);
            return;
        }
        
        console.log("🔍 Recupero chiavi per:", recipientUsername);
        const recipientKeys = await stealthChain.retrieveStealthKeys(recipientUsername);
        console.log("🔑 Chiavi del destinatario:", recipientKeys);
        
        // Verifica che le chiavi del destinatario siano complete
        if (!recipientKeys.spendingKey || !recipientKeys.viewingKeyPair ||
            !recipientKeys.viewingKeyPair.pub || !recipientKeys.viewingKeyPair.priv ||
            !recipientKeys.viewingKeyPair.epub || !recipientKeys.viewingKeyPair.epriv) {
            showStatus('Errore: Chiavi del destinatario incomplete', true);
            console.error("Chiavi destinatario incomplete:", recipientKeys);
            return;
        }
        
        const { stealthAddress, ephemeralPublicKey } = await stealthChain.generateStealthAddress(
            recipientKeys.viewingKeyPair.epub,
            recipientKeys.spendingKey
        );
        
        console.log("🏠 Indirizzo stealth generato:", stealthAddress);
        console.log("🔐 Chiave pubblica effimera:", ephemeralPublicKey);
        
        stealthAddressDiv.textContent = stealthAddress;
        ephemeralPublicKeyDiv.textContent = ephemeralPublicKey;
        stealthAddressInfoDiv.style.display = 'block';
        
        showStatus('Indirizzo stealth generato con successo!');
    } catch (error) {
        console.error("❌ Errore completo:", error);
        showStatus(`Errore nella generazione dell'indirizzo stealth: ${error.message}`, true);
    }
});

recoverStealthAddressBtn.addEventListener('click', async () => {
    try {
        const stealthAddress = stealthAddressInput.value.trim();
        const ephemeralKey = ephemeralKeyInput.value.trim();
        const username = usernameInput.value.trim();
        
        if (!stealthAddress || !ephemeralKey) {
            showStatus('Indirizzo stealth e chiave effimera sono richiesti', true);
            return;
        }
        
        const myKeys = await stealthChain.retrieveStealthKeys(username);
        
        const recoveredWallet = await stealthChain.openStealthAddress(
            stealthAddress,
            ephemeralKey,
            myKeys.viewingKeyPair,  // Usa il keypair completo
            myKeys.spendingKey
        );
        
        recoveredAddressDiv.textContent = recoveredWallet.address;
        recoveredPrivateKeyDiv.textContent = recoveredWallet.privateKey;
        recoveredAddressInfoDiv.style.display = 'block';
        
        showStatus('Indirizzo stealth recuperato con successo!');
    } catch (error) {
        showStatus(`Errore nel recupero dell'indirizzo stealth: ${error.message}`, true);
    }
}); 