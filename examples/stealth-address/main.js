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
        
        if (!gunKeyPair) {
            showStatus('Errore: KeyPair non trovato', true);
            return;
        }
        
        const stealthKeys = await stealthChain.generateStealthKeys(gunKeyPair);
        await stealthChain.saveStealthKeys(username, stealthKeys);
        
        spendingKeyDiv.textContent = stealthKeys.spendingKey;
        viewingKeyDiv.textContent = stealthKeys.viewingKey;
        keysInfoDiv.style.display = 'block';
        
        showStatus('Chiavi stealth generate con successo!');
    } catch (error) {
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
        
        const recipientKeys = await stealthChain.retrieveStealthKeys(recipientUsername);
        
        const { stealthAddress, ephemeralPublicKey } = await stealthChain.generateStealthAddress(
            recipientKeys.viewingKey,
            recipientKeys.spendingKey
        );
        
        stealthAddressDiv.textContent = stealthAddress;
        ephemeralPublicKeyDiv.textContent = ephemeralPublicKey;
        stealthAddressInfoDiv.style.display = 'block';
        
        showStatus('Indirizzo stealth generato con successo!');
    } catch (error) {
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
            { epub: myKeys.viewingKey, epriv: myKeys.viewingKey },
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