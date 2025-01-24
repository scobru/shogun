import { WalletManager, StorageType } from "@scobru/shogun";

// Inizializza il WalletManager
const walletManager = new WalletManager();

// Ottieni l'istanza di StealthChain
const stealthChain = walletManager.getStealthChain();

// Elementi DOM
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const createAccountBtn = document.getElementById("createAccount");
const loginBtn = document.getElementById("login");
const logoutBtn = document.getElementById("logout");
const generateKeysBtn = document.getElementById("generateKeys");
const exportKeysBtn = document.getElementById("exportKeys");
const importKeysBtn = document.getElementById("importKeys");
const keysInfoDiv = document.getElementById("keysInfo");
const spendingKeyDiv = document.getElementById("spendingKey");
const viewingKeyDiv = document.getElementById("viewingKey");
const recipientPublicKeyInput = document.getElementById("recipientPublicKey");
const generateStealthAddressBtn = document.getElementById(
  "generateStealthAddress"
);
const stealthAddressInfoDiv = document.getElementById("stealthAddressInfo");
const stealthAddressDiv = document.getElementById("stealthAddress");
const ephemeralPublicKeyDiv = document.getElementById("ephemeralPublicKey");
const stealthAddressInput = document.getElementById("stealthAddressInput");
const ephemeralKeyInput = document.getElementById("ephemeralKeyInput");
const recoverStealthAddressBtn = document.getElementById(
  "recoverStealthAddress"
);
const recoveredAddressInfoDiv = document.getElementById("recoveredAddressInfo");
const recoveredAddressDiv = document.getElementById("recoveredAddress");
const recoveredPrivateKeyDiv = document.getElementById("recoveredPrivateKey");
const statusDiv = document.getElementById("status");
const accountInfoDiv = document.getElementById('accountInfo');
const accountPublicKeyDiv = document.getElementById('accountPublicKey');

// Funzioni di utilità
function showStatus(message, isError = false) {
  statusDiv.textContent = message;
  statusDiv.style.display = "block";
  statusDiv.className = `status ${isError ? "error" : "success"}`;
}

function updateButtonStates(isLoggedIn) {
  createAccountBtn.disabled = isLoggedIn;
  loginBtn.disabled = isLoggedIn;
  logoutBtn.disabled = !isLoggedIn;
  generateKeysBtn.disabled = !isLoggedIn;
  exportKeysBtn.disabled = !isLoggedIn;
  importKeysBtn.disabled = !isLoggedIn;
  generateStealthAddressBtn.disabled = !isLoggedIn;
  recoverStealthAddressBtn.disabled = !isLoggedIn;
}

// Funzione per copiare il testo negli appunti
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Errore nella copia negli appunti:', err);
        return false;
    }
}

// Funzione per gestire il feedback visivo del pulsante di copia
function showCopyFeedback(button) {
    button.textContent = 'Copiato!';
    button.classList.add('success');
    setTimeout(() => {
        button.textContent = 'Copia';
        button.classList.remove('success');
    }, 2000);
}

// Aggiungi event listener per tutti i pulsanti di copia
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('copy-btn')) {
        const sourceId = e.target.dataset.copy;
        const sourceElement = document.getElementById(sourceId);
        if (sourceElement && sourceElement.textContent) {
            const success = await copyToClipboard(sourceElement.textContent);
            if (success) {
                showCopyFeedback(e.target);
            }
        }
    }
});

// Event Listeners
createAccountBtn.addEventListener("click", async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showStatus("Username e password sono richiesti", true);
    return;
  }

  try {
    await walletManager.createAccount(username, password);
    showStatus("Account creato con successo! Sei ora loggato.");
    updateButtonStates(true);
  } catch (error) {
    showStatus(`Errore nella creazione dell'account: ${error.message}`, true);
  }
});

loginBtn.addEventListener("click", async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showStatus("Username e password sono richiesti", true);
    return;
  }

  try {
    const publicKey = await walletManager.login(username, password);
    if (publicKey) {
      showStatus("Login effettuato con successo!");
      updateButtonStates(true);

      // Mostra la chiave pubblica dell'account
      accountPublicKeyDiv.textContent = publicKey;
      accountInfoDiv.style.display = 'block';

      stealthChain.retrieveStealthKeysFromUser((error, stealthKeys) => {
        if (error) {
          console.error("Errore nel recupero delle chiavi:", error);
          return;
        }

        if (stealthKeys) {
          document.getElementById('privKeyValue').textContent = stealthKeys.priv || 'Non disponibile';
          document.getElementById('eprivKeyValue').textContent = stealthKeys.epriv || 'Non disponibile';
          document.getElementById('pubKeyValue').textContent = stealthKeys.pub || 'Non disponibile';
          document.getElementById('epubKeyValue').textContent = stealthKeys.epub || 'Non disponibile';
          keysInfoDiv.style.display = 'block';
        }
      });
    } else {
      showStatus("Login fallito: chiave pubblica non trovata", true);
    }
  } catch (error) {
    showStatus(`Errore nel login: ${error.message}`, true);
  }
});

logoutBtn.addEventListener("click", () => {
  walletManager.logout();
  showStatus("Logout effettuato con successo");
  updateButtonStates(false);
  keysInfoDiv.style.display = "none";
  stealthAddressInfoDiv.style.display = "none";
  recoveredAddressInfoDiv.style.display = "none";
  accountInfoDiv.style.display = "none"; // Nascondi la chiave pubblica dell'account
});

generateKeysBtn.addEventListener("click", async () => {
  try {
    const publicKey = walletManager.getPublicKey();
    if (!publicKey) {
      showStatus("Devi effettuare il login prima di generare le chiavi", true);
      return;
    }

    stealthChain.generateStealthKeys((error, stealthKeyPair) => {
      if (error) {
        showStatus(`Errore nella generazione delle chiavi: ${error.message}`, true);
        return;
      }

      stealthChain.saveStealthKeys(stealthKeyPair, (saveError) => {
        if (saveError) {
          showStatus(`Errore nel salvataggio delle chiavi: ${saveError.message}`, true);
          return;
        }

        document.getElementById('privKeyValue').textContent = stealthKeyPair.priv || 'Non disponibile';
        document.getElementById('eprivKeyValue').textContent = stealthKeyPair.epriv || 'Non disponibile';
        document.getElementById('pubKeyValue').textContent = stealthKeyPair.pub || 'Non disponibile';
        document.getElementById('epubKeyValue').textContent = stealthKeyPair.epub || 'Non disponibile';
        keysInfoDiv.style.display = 'block';
        
        showStatus('Chiavi stealth generate e salvate con successo!');
      });
    });
  } catch (error) {
    showStatus(`Errore nella generazione delle chiavi stealth: ${error.message}`, true);
  }
});

exportKeysBtn.addEventListener("click", async () => {
  try {
    const publicKey = walletManager.getPublicKey();
    if (!publicKey) {
      showStatus("Devi effettuare il login prima di esportare", true);
      return;
    }

    const backup = await walletManager.exportAllData(publicKey);
    const blob = new Blob([backup], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${publicKey}-stealth-keys-backup.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus("Backup chiavi stealth esportato con successo!");
  } catch (error) {
    showStatus(`Errore nell'export delle chiavi: ${error.message}`, true);
  }
});

importKeysBtn.addEventListener("click", async () => {
  try {
    const publicKey = walletManager.getPublicKey();
    if (!publicKey) {
      showStatus("Devi effettuare il login prima di importare", true);
      return;
    }

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";

    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const jsonData = event.target.result;
          await walletManager.importAllData(jsonData, publicKey);

          // Aggiorna l'interfaccia con le chiavi importate
          const stealthKeys = await stealthChain.retrieveStealthKeys(publicKey);
          if (stealthKeys) {
            document.getElementById('privKeyValue').textContent = stealthKeys.priv || 'Non disponibile';
            document.getElementById('eprivKeyValue').textContent = stealthKeys.epriv || 'Non disponibile';
            document.getElementById('pubKeyValue').textContent = stealthKeys.pub || 'Non disponibile';
            document.getElementById('epubKeyValue').textContent = stealthKeys.epub || 'Non disponibile';
            keysInfoDiv.style.display = 'block';
          }

          showStatus("Chiavi stealth importate con successo!");
        } catch (error) {
          showStatus(`Errore nell'import delle chiavi: ${error.message}`, true);
        }
      };

      reader.readAsText(file);
    };

    fileInput.click();
  } catch (error) {
    showStatus(`Errore nell'import delle chiavi: ${error.message}`, true);
  }
});

generateStealthAddressBtn.addEventListener("click", async () => {
  try {
    const recipientPublicKey = recipientPublicKeyInput.value.trim();

    if (!recipientPublicKey) {
      showStatus("Chiave pubblica del destinatario richiesta", true);
      return;
    }

    stealthChain.retrieveStealthKeysFromRegistry(recipientPublicKey, (error, recipientKeys) => {
      if (error) {
        showStatus(`Errore: ${error.message}`, true);
        return;
      }

      stealthChain.generateStealthAddress(recipientPublicKey, (genError, stealthData) => {
        if (genError) {
          console.error("Error generating stealth address:", genError);
          showStatus(`Errore nella generazione dell'indirizzo stealth: ${genError.message}`, true);
          return;
        }

        document.getElementById('stealthAddress').textContent = stealthData.stealthAddress;
        document.getElementById('ephemeralPublicKey').textContent = stealthData.ephemeralPublicKey;
        stealthAddressInfoDiv.style.display = 'block';

        showStatus('Indirizzo stealth generato con successo!');
      });
    });
  } catch (error) {
    showStatus(`Errore nella generazione dell'indirizzo stealth: ${error.message}`, true);
  }
});

recoverStealthAddressBtn.addEventListener("click", async () => {
  try {
    const stealthAddress = stealthAddressInput.value.trim();
    const ephemeralKey = ephemeralKeyInput.value.trim();

    if (!stealthAddress || !ephemeralKey) {
      showStatus("Indirizzo stealth e chiave effimera sono richiesti", true);
      return;
    }

    const recoveredWallet = await new Promise((resolve, reject) => {
      stealthChain.openStealthAddress(
        stealthAddress,
        ephemeralKey,
        (err, wallet) => {
          if (err) {
            console.error("Error opening stealth address:", err);
            reject(err);
            return;
          }
          resolve(wallet);
        }
      );
    });

    recoveredAddressDiv.textContent = recoveredWallet.address;
    recoveredPrivateKeyDiv.textContent = recoveredWallet.privateKey;
    recoveredAddressInfoDiv.style.display = "block";

    showStatus("Indirizzo stealth recuperato con successo!");
  } catch (error) {
    showStatus(
      `Errore nel recupero dell'indirizzo stealth: ${error.message}`,
      true
    );
  }
});
