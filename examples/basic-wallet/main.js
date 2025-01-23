import { WalletManager } from '@scobru/shogun';
import { Wallet } from 'ethers';

// Configurazione Gun


// Funzione per generare hash usando Web Crypto API
async function createHash(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return '0x' + hashHex; // Assicuriamoci che sia un formato valido per ethers
}

// Modifica la funzione createWalletFromSalt per usare Web Crypto
async function createWalletFromSalt(salt) {
  try {
    const privateKey = await createHash(salt);
    return new Wallet(privateKey);
  } catch (error) {
    console.error('Error creating wallet:', error);
    throw error;
  }
}



// Inizializzazione sicura del wallet
async function initWallet(username, password) {
  try {
    const wallet = await createWalletFromSalt(`${username}:${password}`);
    return wallet;
  } catch (error) {
    console.error('Error initializing wallet:', error);
    throw error;
  }
}

// Inizializza il WalletManager
const walletManager = new WalletManager({
  peers: ['http://localhost:8765/gun'],
  localStorage: false,
  radisk: false
});

// Elementi DOM
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const createAccountBtn = document.getElementById('createAccount');
const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');
const createWalletBtn = document.getElementById('createWallet');
const statusDiv = document.getElementById('status');
const walletInfoDiv = document.getElementById('walletInfo');
const publicKeySpan = document.getElementById('publicKey');
const entropySpan = document.getElementById('entropy');

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
    walletInfoDiv.style.display = 'none';
});

createWalletBtn.addEventListener('click', async () => {
    try {
        const username = usernameInput.value.trim();
        const gunKeyPair = walletManager.getCurrentUserKeyPair();
        
        if (!gunKeyPair) {
            showStatus('Errore: KeyPair non trovato', true);
            return;
        }
        
        const { walletObj, entropy } = await WalletManager.createWalletObj(gunKeyPair);
        await walletManager.saveWalletToGun(walletObj, username);
        
        publicKeySpan.textContent = walletObj.address;
        entropySpan.textContent = entropy;
        walletInfoDiv.style.display = 'block';
        
        showStatus('Wallet creato con successo!');
    } catch (error) {
        showStatus(`Errore nella creazione del wallet: ${error.message}`, true);
    }
}); 