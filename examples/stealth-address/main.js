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
        const result = await stealthChain.generateStealthKeys();
        console.log("🔐 Chiavi stealth generate:", result);

        if (!result || !result.stealthKeyPair) {
            showStatus('Errore nella generazione delle chiavi stealth', true);
            return;
        }

        const stealthKeyPair = result.stealthKeyPair;

        // Salva le chiavi
        await stealthChain.saveStealthKeys(result);
        console.log("💾 Chiavi salvate");

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

        // Attendi un momento per la sincronizzazione
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verifica che le chiavi siano state salvate correttamente
        try {
            const savedKeys = await stealthChain.retrieveStealthKeys(publicKey);
            console.log("📖 Chiavi recuperate dopo il salvataggio:", savedKeys);

            if (savedKeys && savedKeys.stealthKeyPair && savedKeys.stealthKeyPair.pub && savedKeys.stealthKeyPair.epub) {
                showStatus('Chiavi stealth generate e salvate con successo!');
            } else {
                showStatus('Chiavi generate ma potrebbero esserci problemi nel salvataggio', true);
            }
        } catch (retrieveError) {
            console.error("❌ Errore nel recupero delle chiavi:", retrieveError);
            showStatus('Chiavi generate ma errore nel recupero', true);
        }
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

        console.log("🔍 Recupero chiavi stealth per:", recipientUsername);
        
        // Recupera le chiavi stealth del destinatario
        const recipientKeys = await stealthChain.retrieveStealthKeys(recipientUsername);
        console.log("🔐 Chiavi stealth recuperate:", recipientKeys);
        
        if (!recipientKeys || !recipientKeys.stealthKeyPair) {
            showStatus('Chiavi stealth del destinatario non trovate o non valide', true);
            return;
        }

        const keys = recipientKeys.stealthKeyPair;
        if (!keys.pub || !keys.epub) {
            showStatus('Chiavi pubbliche del destinatario non valide', true);
            return;
        }
        
        // Genera l'indirizzo stealth
        const { stealthAddress, ephemeralPublicKey } = await stealthChain.generateStealthAddress(
            keys.pub,
            keys.epub
        );

        if (!stealthAddress || !ephemeralPublicKey) {
            showStatus('Errore nella generazione dell\'indirizzo stealth', true);
            return;
        }

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

        // Recupera le chiavi stealth dell'utente
        const userKeys = await stealthChain.retrieveStealthKeys(publicKey);
        console.log("🔐 Chiavi utente recuperate:", userKeys);

        if (!userKeys || !userKeys.stealthKeyPair) {
            showStatus('Chiavi stealth non trovate, generane di nuove', true);
            return;
        }

        // Estrai le chiavi private dal stealthKeyPair
        const { priv: spendingPrivateKey, epriv: viewingPrivateKey } = userKeys.stealthKeyPair;

        if (!viewingPrivateKey || !spendingPrivateKey) {
            showStatus('Chiavi private non valide o mancanti', true);
            return;
        }

        // Prepara i dati per il recupero
        const recoveryData = {
            stealthAddress,
            ephemeralPublicKey,
            viewingPrivateKey,
            spendingPrivateKey
        };

        console.log("🔑 Tentativo di recupero con:", recoveryData);

        // Recupera l'indirizzo stealth
        const recoveredWallet = await stealthChain.openStealthAddress(
            recoveryData.stealthAddress,
            recoveryData.ephemeralPublicKey,
            recoveryData.viewingPrivateKey,
            recoveryData.spendingPrivateKey
        );

        if (!recoveredWallet || !recoveredWallet.address || !recoveredWallet.privateKey) {
            showStatus('Errore nel recupero dell\'indirizzo stealth', true);
            return;
        }

        console.log("✅ Wallet recuperato:", recoveredWallet);

        recoveredAddressDiv.textContent = recoveredWallet.address;
        recoveredPrivateKeyDiv.textContent = recoveredWallet.privateKey;
        recoveredAddressInfoDiv.style.display = 'block';

        showStatus('Indirizzo stealth recuperato con successo!');
    } catch (error) {
        console.error("❌ Errore completo:", error);
        if (error.message.includes('JWK')) {
            showStatus('Errore nel formato delle chiavi. Assicurati di aver generato nuove chiavi stealth.', true);
        } else {
            showStatus(`Errore nel recupero dell'indirizzo stealth: ${error.message}`, true);
        }
    }
}); 