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
        const username = usernameInput.value.trim();
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

        // Salva le chiavi con l'username
        await stealthChain.saveStealthKeys(username, stealthKeyPair);
        console.log("💾 Chiavi salvate per l'utente:", username);

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
            const savedKeys = await stealthChain.retrieveStealthKeys(username);
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
        
        // Genera l'indirizzo stealth usando le chiavi corrette
        const result = await stealthChain.generateStealthAddress(
            keys.epub,  // Usa la chiave pubblica di visualizzazione
            keys.pub    // Usa la chiave pubblica di spesa
        );

        if (!result || !result.stealthAddress || !result.ephemeralPublicKey || !result.encryptedWallet) {
            showStatus('Errore nella generazione dell\'indirizzo stealth', true);
            return;
        }

        // Salva il wallet in GunDB usando la chiave pubblica del destinatario
        console.log("💾 Salvataggio wallet in GunDB per il destinatario:", recipientUsername);
        await walletManager.getGun().get('wallets').get(keys.pub).put({
            publicKey: keys.pub,
            entropy: result.encryptedWallet,
            timestamp: Date.now()
        });

        stealthAddressDiv.textContent = result.stealthAddress;
        ephemeralPublicKeyDiv.textContent = result.ephemeralPublicKey;
        document.getElementById('encryptedWallet').textContent = result.encryptedWallet;
        stealthAddressInfoDiv.style.display = 'block';

        showStatus('Indirizzo stealth generato e wallet salvato con successo!');
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

        // Recupera il wallet cifrato da GunDB
        console.log("📥 Recupero wallet cifrato da GunDB per la chiave:", publicKey);
        const walletData = await new Promise((resolve) => {
            walletManager.getGun().get('wallets').get(publicKey).once((data) => {
                console.log("📦 Dati wallet recuperati:", data);
                resolve(data);
            });
        });

        if (!walletData || !walletData.entropy) {
            showStatus('Nessun wallet trovato per questo utente', true);
            return;
        }

        const encryptedWallet = walletData.entropy;
        console.log("🔐 Wallet cifrato recuperato:", encryptedWallet);

        // Recupera l'indirizzo stealth
        const result = await stealthChain.openStealthAddress(
            stealthAddress,
            ephemeralPublicKey,
            encryptedWallet
        );

        if (!result || !result.recoveredAddress || !result.recoveredPrivateKey) {
            showStatus('Errore nel recupero dell\'indirizzo stealth', true);
            return;
        }

        recoveredAddressDiv.textContent = result.recoveredAddress;
        recoveredPrivateKeyDiv.textContent = result.recoveredPrivateKey;
        recoveredAddressInfoDiv.style.display = 'block';

        showStatus('Indirizzo stealth recuperato con successo!');
    } catch (error) {
        console.error("❌ Errore completo:", error);
        showStatus(`Errore nel recupero dell'indirizzo stealth: ${error.message}`, true);
    }
}); 