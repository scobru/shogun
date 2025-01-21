import { WalletManager } from '../../src/WalletManager';
import { StealthChain } from '../../src/StealthChain';

// Inizializza il WalletManager e StealthChain
const walletManager = new WalletManager();
const stealthChain = new StealthChain(walletManager.gun);

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
        // Disabilita i pulsanti durante il login
        updateButtonStates(false);
        loginBtn.disabled = true;
        createAccountBtn.disabled = true;

        const publicKey = await walletManager.login(username, password);
        if (publicKey) {
            showStatus(`Login effettuato con successo!\nLa tua chiave pubblica è:\n${publicKey}`);
            // Mostra la chiave pubblica in un elemento dedicato
            const publicKeyDiv = document.createElement('div');
            publicKeyDiv.id = 'publicKeyInfo';
            publicKeyDiv.style.marginTop = '10px';
            publicKeyDiv.style.padding = '10px';
            publicKeyDiv.style.backgroundColor = '#f0f0f0';
            publicKeyDiv.style.borderRadius = '5px';
            publicKeyDiv.innerHTML = `
                <strong>La tua chiave pubblica:</strong><br>
                <code style="word-break: break-all;">${publicKey}</code>
            `;
            keysInfoDiv.parentNode.insertBefore(publicKeyDiv, keysInfoDiv);
            updateButtonStates(true);
        } else {
            showStatus('Login fallito: chiave pubblica non trovata', true);
            // Riabilita i pulsanti in caso di errore
            loginBtn.disabled = false;
            createAccountBtn.disabled = false;
        }
    } catch (error) {
        console.error("Errore durante il login:", error);
        showStatus(`Errore nel login: ${error.message}`, true);
        // Riabilita i pulsanti in caso di errore
        loginBtn.disabled = false;
        createAccountBtn.disabled = false;
    }
});

logoutBtn.addEventListener('click', () => {
    walletManager.logout();
    showStatus('Logout effettuato con successo');
    updateButtonStates(false);
    keysInfoDiv.style.display = 'none';
    stealthAddressInfoDiv.style.display = 'none';
    recoveredAddressInfoDiv.style.display = 'none';
    const publicKeyDiv = document.getElementById('publicKeyInfo');
    if (publicKeyDiv) {
        publicKeyDiv.remove();
    }
});

generateKeysBtn.addEventListener('click', async () => {
    try {
        // Verifica che l'utente sia autenticato
        const publicKey = walletManager.getPublicKey();
        if (!publicKey) {
            showStatus('Devi effettuare il login prima di generare le chiavi', true);
            return;
        }

        // Genera le chiavi stealth
        const stealthKeyPair = await new Promise((resolve, reject) => {
            stealthChain.generateStealthKeys((err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
        console.log("🔐 Chiavi stealth generate:", stealthKeyPair);

        if (!stealthKeyPair) {
            showStatus('Errore nella generazione delle chiavi stealth', true);
            return;
        }

        // Mostra le chiavi
        spendingKeyDiv.innerHTML = `
            <strong>Chiavi Private:</strong><br>
            <div style="word-break: break-all;">
                <strong>priv:</strong> ${stealthKeyPair.priv || 'Non disponibile'}<br>
                <strong>epriv:</strong> ${stealthKeyPair.epriv || 'Non disponibile'}
            </div>
        `;
        viewingKeyDiv.innerHTML = `
            <strong>Chiavi Pubbliche (da condividere):</strong><br>
            <div style="word-break: break-all;">
                <strong>pub:</strong> ${stealthKeyPair.pub || 'Non disponibile'}<br>
                <strong>epub:</strong> ${stealthKeyPair.epub || 'Non disponibile'}
            </div>
        `;
        keysInfoDiv.style.display = 'block';

        showStatus('Chiavi stealth generate con successo!');
    } catch (error) {
        console.error("❌ Errore completo:", error);
        showStatus(`Errore nella generazione delle chiavi stealth: ${error.message}`, true);
    }
});

generateStealthAddressBtn.addEventListener('click', async () => {
    try {
        const recipientUsername = recipientUsernameInput.value.trim();
        
        if (!recipientUsername) {
            showStatus('Username del destinatario richiesto', true);
            return;
        }

        // Recupera le chiavi stealth del destinatario dal registro pubblico
        const recipientPublicKey = await new Promise((resolve, reject) => {
            walletManager.getGun().get(`~${recipientUsername}`).once((user) => {
                if (!user?.pub) reject(new Error('Utente non trovato'));
                else resolve(user.pub);
            });
        });

        console.log("🔍 Generazione indirizzo stealth per:", recipientPublicKey);
        
        // Genera l'indirizzo stealth
        const stealthData = await new Promise((resolve, reject) => {
            stealthChain.generateStealthAddress(recipientPublicKey, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        if (!stealthData || !stealthData.stealthAddress || !stealthData.ephemeralPublicKey) {
            showStatus('Errore nella generazione dell\'indirizzo stealth', true);
            return;
        }

        stealthAddressDiv.textContent = stealthData.stealthAddress;
        ephemeralPublicKeyDiv.textContent = stealthData.ephemeralPublicKey;
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
        const ephemeralPublicKey = ephemeralKeyInput.value.trim();

        if (!stealthAddress || !ephemeralPublicKey) {
            showStatus('Indirizzo stealth e chiave pubblica effimera sono richiesti', true);
            return;
        }

        // Verifica che l'utente sia autenticato
        const publicKey = walletManager.getPublicKey();
        if (!publicKey) {
            showStatus('Devi effettuare il login prima di recuperare l\'indirizzo', true);
            return;
        }

        // Recupera l'indirizzo stealth
        const recoveredWallet = await new Promise((resolve, reject) => {
            stealthChain.openStealthAddress(
                stealthAddress,
                ephemeralPublicKey,
                (err, wallet) => {
                    if (err) reject(err);
                    else resolve(wallet);
                }
            );
        });

        if (!recoveredWallet || !recoveredWallet.address) {
            showStatus('Errore nel recupero dell\'indirizzo stealth', true);
            return;
        }

        recoveredAddressDiv.textContent = recoveredWallet.address;
        recoveredPrivateKeyDiv.textContent = recoveredWallet.privateKey;
        recoveredAddressInfoDiv.style.display = 'block';

        showStatus('Indirizzo stealth recuperato con successo!');
    } catch (error) {
        console.error("❌ Errore completo:", error);
        showStatus(`Errore nel recupero dell'indirizzo stealth: ${error.message}`, true);
    }
}); 