import { WalletManager } from '../../src/WalletManager';

let walletManager;

async function init() {
    try {
        walletManager = new WalletManager();
        const supportCheck = document.getElementById('supportCheck');
        
        if (walletManager.isPasskeySupported()) {
            supportCheck.className = 'status success';
            supportCheck.textContent = '✅ Passkey supportate in questo browser';
            
            document.getElementById('registrationForm').classList.remove('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
        } else {
            supportCheck.className = 'status error';
            supportCheck.textContent = '❌ Passkey non supportate in questo browser';
        }
    } catch (error) {
        showError('Errore di inizializzazione: ' + error.message);
    }
}

async function registerWithPasskey() {
    const username = document.getElementById('username').value;
    if (!username) {
        showError('Inserisci un username');
        return;
    }

    try {
        await walletManager.createAccountWithPasskey(username);
        showSuccess('Account creato con successo!');
        updateWalletInfo();
    } catch (error) {
        showError('Errore nella registrazione: ' + error.message);
    }
}

async function loginWithPasskey() {
    const username = document.getElementById('loginUsername').value;
    if (!username) {
        showError('Inserisci un username');
        return;
    }

    try {
        const pubKey = await walletManager.loginWithPasskey(username);
        showSuccess('Login effettuato con successo!');
        updateWalletInfo();
    } catch (error) {
        showError('Errore nel login: ' + error.message);
    }
}

async function updateWalletInfo() {
    const walletInfo = document.getElementById('walletInfo');
    const walletData = document.getElementById('walletData');
    
    try {
        const publicKey = walletManager.getPublicKey();
        const localData = await walletManager.checkLocalData(walletManager.user.is.alias);
        
        walletData.textContent = JSON.stringify({
            publicKey,
            localData
        }, null, 2);
        
        walletInfo.classList.remove('hidden');
        document.getElementById('registrationForm').classList.add('hidden');
        document.getElementById('loginForm').classList.add('hidden');
    } catch (error) {
        showError('Errore nel recupero dati wallet: ' + error.message);
    }
}

async function exportData() {
    try {
        const data = await walletManager.exportAllData(walletManager.user.is.alias);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'wallet-backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showSuccess('Dati esportati con successo!');
    } catch (error) {
        showError('Errore nell\'esportazione: ' + error.message);
    }
}

function logout() {
    walletManager.logout();
    document.getElementById('walletInfo').classList.add('hidden');
    document.getElementById('registrationForm').classList.remove('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    showSuccess('Logout effettuato');
}

function showError(message) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status error';
    status.classList.remove('hidden');
}

function showSuccess(message) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status success';
    status.classList.remove('hidden');
}

// Esponi le funzioni globalmente
window.registerWithPasskey = registerWithPasskey;
window.loginWithPasskey = loginWithPasskey;
window.exportData = exportData;
window.logout = logout;

// Inizializza l'app
init(); 