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
                <code style="word-break: break-all;">${publicKey}</code><br>
                <small style="color: #666;">(Usa questa chiave per il salvataggio delle chiavi stealth)</small>
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
    // Rimuovi anche l'elemento della chiave pubblica
    const publicKeyDiv = document.getElementById('publicKeyInfo');
    if (publicKeyDiv) {
        publicKeyDiv.remove();
    }
});

generateKeysBtn.addEventListener('click', async () => {
    try {
        const publicKey = walletManager.getPublicKey();
        console.log("🔑 PublicKey corrente:", publicKey);
        
        if (!publicKey) {
            showStatus('Errore: Devi fare login prima', true);
            return;
        }

        const gunKeyPair = walletManager.getCurrentUserKeyPair();
        console.log("👤 GunKeyPair corrente:", gunKeyPair);
        
        if (!gunKeyPair) {
            showStatus('Errore: KeyPair non trovato', true);
            return;
        }

        // Genera le chiavi stealth usando il metodo corretto
        const stealthKeys = await stealthChain.generateStealthKeys(gunKeyPair);
        console.log("🔐 Chiavi stealth generate:", stealthKeys);
        
        // Salva le chiavi usando il publicKey invece dello username
        await stealthChain.saveStealthKeys(stealthKeys, publicKey);
        console.log("💾 Chiavi salvate per publicKey:", publicKey);

        // Mostra le chiavi in modo più dettagliato
        spendingKeyDiv.innerHTML = `
            <strong>Spending Key:</strong><br>
            ${stealthKeys.spendingKey}<br><br>
            <strong>Viewing Key Pair:</strong><br>
            pub: ${stealthKeys.viewingKeyPair.pub}<br>
            epub: ${stealthKeys.viewingKeyPair.epub}<br>
            priv: ${stealthKeys.viewingKeyPair.priv}<br>
            epriv: ${stealthKeys.viewingKeyPair.epriv}
        `;
        viewingKeyDiv.innerHTML = `
            <strong>Chiavi Pubbliche (da condividere):</strong><br>
            <div style="margin-bottom: 10px;">
                <strong>La tua chiave pubblica (per il salvataggio):</strong><br>
                <code style="word-break: break-all;">${publicKey}</code>
            </div>
            <div>
                <strong>Chiavi da condividere:</strong><br>
                Spending Key: ${stealthKeys.spendingKey}<br>
                Viewing Key (epub): ${stealthKeys.viewingKeyPair.epub}
            </div>
        `;
        keysInfoDiv.style.display = 'block';

        // Verifica che le chiavi siano state salvate correttamente
        const savedKeys = await stealthChain.retrieveStealthKeys(publicKey);
        console.log("📖 Chiavi recuperate dopo il salvataggio:", savedKeys);

        if (savedKeys) {
            showStatus('Chiavi stealth generate e salvate con successo!');
        } else {
            showStatus('Chiavi generate ma potrebbero esserci problemi nel salvataggio', true);
        }
    } catch (error) {
        console.error("❌ Errore completo:", error);
        showStatus(`Errore nella generazione delle chiavi stealth: ${error.message}`, true);
    }
});

generateStealthAddressBtn.addEventListener('click', async () => {
    try {
        const recipientPublicKey = recipientUsernameInput.value.trim();
        
        if (!recipientPublicKey) {
            showStatus('Chiave pubblica del destinatario richiesta', true);
            return;
        }

        console.log("🔍 Recupero chiavi stealth per:", recipientPublicKey);
        
        // Recupera le chiavi usando direttamente la chiave pubblica
        const recipientKeys = await stealthChain.retrieveStealthKeys(recipientPublicKey);
        
        if (!recipientKeys) {
            showStatus('Chiavi stealth del destinatario non trovate', true);
            return;
        }
        
        console.log("🔐 Chiavi stealth recuperate:", recipientKeys);
        
        const { stealthAddress, ephemeralPublicKey } = await stealthChain.generateStealthAddress(
            recipientKeys.viewingKeyPair.epub,
            recipientKeys.spendingKey
        );

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
        const publicKey = walletManager.getPublicKey();

        if (!stealthAddress || !ephemeralPublicKey) {
            showStatus('Indirizzo stealth e chiave pubblica effimera sono richiesti', true);
            return;
        }

        if (!publicKey) {
            showStatus('Devi fare login prima', true);
            return;
        }

        // Recupera le chiavi dell'utente usando il publicKey
        const userKeys = await stealthChain.retrieveStealthKeys(publicKey);
        
        if (!userKeys) {
            showStatus('Chiavi utente non trovate', true);
            return;
        }

        // Recupera l'indirizzo usando il metodo corretto
        const recoveredWallet = await stealthChain.openStealthAddress(
            stealthAddress,
            ephemeralPublicKey,
            userKeys.viewingKeyPair,
            userKeys.spendingKey
        );

        recoveredAddressDiv.textContent = recoveredWallet.address;
        recoveredPrivateKeyDiv.textContent = recoveredWallet.privateKey;
        recoveredAddressInfoDiv.style.display = 'block';

        showStatus('Indirizzo stealth recuperato con successo!');
    } catch (error) {
        console.error("❌ Errore:", error);
        showStatus(`Errore nel recupero dell'indirizzo stealth: ${error.message}`, true);
    }
}); 