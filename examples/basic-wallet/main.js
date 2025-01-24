import { WalletManager } from '@scobru/shogun';

// Inizializza il WalletManager con la configurazione corretta
const walletManager = new WalletManager({
   
});

// Elementi DOM
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const createAccountBtn = document.getElementById('createAccount');
const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');
const createWalletBtn = document.getElementById('createWallet');
const exportWalletBtn = document.getElementById('exportWallet');
const importWalletBtn = document.getElementById('importWallet');
const statusDiv = document.getElementById('status');
const walletInfoDiv = document.getElementById('walletInfo');
const addressSpan = document.getElementById('address');
const entropySpan = document.getElementById('entropy');
const walletListDiv = document.getElementById('walletList');

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
    createWalletBtn.disabled = !isLoggedIn;
    exportWalletBtn.disabled = !isLoggedIn;
    importWalletBtn.disabled = !isLoggedIn;
}

// Funzione per caricare e visualizzare i wallet disponibili
async function loadAvailableWallets() {
    try {
        const publicKey = walletManager.getPublicKey();
        if (!publicKey) return;

        // Recupera tutti i wallet dall'utente corrente
        const wallets = await new Promise((resolve) => {
            let walletsData = [];
            walletManager.getGun().get('wallets').get(publicKey).map().once((data, key) => {
                if (key !== '_' && data && data.address) {
                    walletsData.push({
                        address: data.address,
                        entropy: data.entropy,
                        timestamp: data.timestamp,
                        privateKey: data.privateKey
                    });
                }
            });
            
            setTimeout(() => resolve(walletsData), 1000);
        });
        
        if (!wallets || wallets.length === 0) {
            walletListDiv.innerHTML = '<p>Nessun wallet trovato</p>';
            return;
        }

        // Ordina i wallet per timestamp, più recenti prima
        wallets.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        let walletHtml = '<h3>Wallet Disponibili</h3><div class="wallet-grid">';
        
        // Itera attraverso i wallet
        wallets.forEach(wallet => {
            walletHtml += `
                <div class="wallet-item">
                    <div class="wallet-info">
                        <div class="wallet-label">Indirizzo:</div>
                        <div class="wallet-address">${wallet.address}</div>
                        <div class="wallet-label">Chiave Privata:</div>
                        <div class="wallet-private-key">${wallet.privateKey}</div>
                        <div class="wallet-label">Data:</div>
                        <div class="wallet-timestamp">${new Date(wallet.timestamp).toLocaleString()}</div>
                    </div>
                    <button onclick="window.loadWallet('${wallet.address}')">Carica</button>
                </div>
            `;
        });
        
        walletHtml += '</div>';
        walletListDiv.innerHTML = walletHtml;
        walletListDiv.style.display = 'block';
    } catch (error) {
        console.error('Errore nel caricamento dei wallet:', error);
        walletListDiv.innerHTML = '<p>Errore nel caricamento dei wallet</p>';
    }
}

// Funzione per caricare un wallet specifico
async function loadWallet(address) {
    try {
        const publicKey = walletManager.getPublicKey();
        if (!publicKey) {
            showStatus('Devi effettuare il login prima', true);
            return;
        }

        // Recupera il wallet specifico
        const wallet = await new Promise((resolve) => {
            walletManager.getGun().get('wallets').get(publicKey).get(address).once((data) => {
                resolve(data);
            });
        });

        if (wallet && wallet.address) {
            // Aggiorna il div delle informazioni del wallet
            const walletInfoHtml = `
                <h3>Wallet Attivo</h3>
                <div class="wallet-details">
                    <div class="detail-row">
                        <span class="label">Indirizzo:</span>
                        <span id="address">${wallet.address}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Chiave Privata:</span>
                        <span id="privateKey">${wallet.privateKey}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Entropy:</span>
                        <span id="entropy">${wallet.entropy}</span>
                    </div>
                </div>
            `;
            walletInfoDiv.innerHTML = walletInfoHtml;
            walletInfoDiv.style.display = 'block';
            showStatus('Wallet caricato con successo!');
        } else {
            showStatus('Wallet non trovato', true);
        }
    } catch (error) {
        showStatus(`Errore nel caricamento del wallet: ${error.message}`, true);
    }
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
        await loadAvailableWallets();
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
            await loadAvailableWallets();
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
    walletInfoDiv.style.display = 'none';
    walletListDiv.style.display = 'none';
});

createWalletBtn.addEventListener('click', async () => {
    try {
        const gunKeyPair = walletManager.getCurrentUserKeyPair();
        const publicKey = walletManager.getPublicKey();
        
        if (!gunKeyPair || !publicKey) {
            showStatus('Errore: Devi effettuare il login prima', true);
            return;
        }
        
        // Creiamo un nuovo wallet con entropy
        const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);
        
        // Mostra il wallet e chiedi conferma per il salvataggio
        const walletInfoHtml = `
            <h3>Wallet Attivo</h3>
            <div class="wallet-details">
                <div class="detail-row">
                    <span class="label">Indirizzo:</span>
                    <span id="address">${walletObj.address}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Chiave Privata:</span>
                    <span id="privateKey">${walletObj.privateKey}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Entropy:</span>
                    <span id="entropy">${entropy}</span>
                </div>
            </div>
            <div class="save-buttons">
                <button id="saveWallet" class="btn btn-primary">Salva su Gun</button>
                <button id="skipSave" class="btn btn-secondary">Non Salvare</button>
            </div>
        `;
        walletInfoDiv.innerHTML = walletInfoHtml;
        walletInfoDiv.style.display = 'block';
        
        // Aggiungi event listener per il salvataggio
        document.getElementById('saveWallet').addEventListener('click', async () => {
            try {
                await new Promise((resolve) => {
                    walletManager.getGun().get('wallets').get(publicKey).get(walletObj.address).put({
                        address: walletObj.address,
                        privateKey: walletObj.privateKey,
                        entropy: entropy,
                        timestamp: Date.now()
                    }, (ack) => {
                        if (ack.err) {
                            throw new Error(ack.err);
                        }
                        resolve();
                    });
                });
                
                // Rimuovi i bottoni di salvataggio
                const saveButtons = walletInfoDiv.querySelector('.save-buttons');
                if (saveButtons) {
                    saveButtons.remove();
                }
                
                showStatus('Wallet salvato con successo su Gun!');
                
                // Aggiorna immediatamente la lista dei wallet
                await loadAvailableWallets();
            } catch (error) {
                showStatus(`Errore nel salvataggio del wallet: ${error.message}`, true);
            }
        });
        
        // Aggiungi event listener per saltare il salvataggio
        document.getElementById('skipSave').addEventListener('click', () => {
            // Rimuovi i bottoni di salvataggio
            const saveButtons = walletInfoDiv.querySelector('.save-buttons');
            if (saveButtons) {
                saveButtons.remove();
            }
            showStatus('Wallet creato ma non salvato su Gun');
        });
        
        showStatus('Wallet creato! Scegli se salvarlo su Gun');
    } catch (error) {
        showStatus(`Errore nella creazione del wallet: ${error.message}`, true);
    }
});

exportWalletBtn.addEventListener('click', async () => {
    try {
        const publicKey = walletManager.getPublicKey();
        if (!publicKey) {
            showStatus('Devi effettuare il login prima di esportare', true);
            return;
        }
        
        const backup = await walletManager.exportAllData(publicKey);
        const blob = new Blob([backup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${publicKey}-wallet-backup.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showStatus('Backup wallet esportato con successo!');
    } catch (error) {
        showStatus(`Errore nell'export del wallet: ${error.message}`, true);
    }
});

importWalletBtn.addEventListener('click', async () => {
    try {
        const publicKey = walletManager.getPublicKey();
        if (!publicKey) {
            showStatus('Devi effettuare il login prima di importare', true);
            return;
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const jsonData = event.target.result;
                    await walletManager.importAllData(jsonData, publicKey);
                    
                    showStatus('Wallet importato con successo!');
                    await loadAvailableWallets();
                } catch (error) {
                    showStatus(`Errore nell'import del wallet: ${error.message}`, true);
                }
            };
            
            reader.readAsText(file);
        };
        
        fileInput.click();
    } catch (error) {
        showStatus(`Errore nell'import del wallet: ${error.message}`, true);
    }
});

// Esponi la funzione loadWallet globalmente per i bottoni dinamici
window.loadWallet = loadWallet; 