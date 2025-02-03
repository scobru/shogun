import { WalletManager } from '@scobru/shogun'

// Inizializza il WalletManager con la configurazione corretta
const walletManager = new WalletManager({})

// Elementi DOM
const usernameInput = document.getElementById('username')
const passwordInput = document.getElementById('password')
const createAccountBtn = document.getElementById('createAccount')
const loginBtn = document.getElementById('login')
const logoutBtn = document.getElementById('logout')
const createWalletBtn = document.getElementById('createWallet')
const exportWalletBtn = document.getElementById('exportWallet')
const importWalletBtn = document.getElementById('importWallet')
const statusDiv = document.getElementById('status')
const walletInfoDiv = document.getElementById('walletInfo')
const addressSpan = document.getElementById('address')
const entropySpan = document.getElementById('entropy')
const walletListDiv = document.getElementById('walletList')
const authBadge = document.querySelector('.auth-badge')
const authTitle = document.querySelector('.auth-info h2')
const authDescription = document.querySelector('.auth-info p')
const accountInfoBox = document.getElementById('accountInfo')

// Funzioni di utilità
function showStatus (message, isError = false) {
  statusDiv.textContent = message
  statusDiv.style.display = 'block'
  statusDiv.className = `status ${isError ? 'error' : 'success'}`
}

function updateButtonStates (isLoggedIn) {
  createAccountBtn.disabled = isLoggedIn
  loginBtn.disabled = isLoggedIn
  logoutBtn.disabled = !isLoggedIn
  createWalletBtn.disabled = !isLoggedIn
  exportWalletBtn.disabled = !isLoggedIn
  importWalletBtn.disabled = !isLoggedIn
}

// Funzione per copiare il testo negli appunti
async function copyToClipboard (text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('Errore nella copia negli appunti:', err)
    return false
  }
}

// Funzione per gestire il feedback visivo del pulsante di copia
function showCopyFeedback (button) {
  button.textContent = 'Copiato!'
  button.classList.add('success')
  setTimeout(() => {
    button.textContent = 'Copia'
    button.classList.remove('success')
  }, 2000)
}

// Aggiungi event listener per tutti i pulsanti di copia
document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('copy-btn')) {
    const sourceId = e.target.dataset.copy
    const sourceElement = document.getElementById(sourceId)
    if (sourceElement && sourceElement.textContent) {
      const success = await copyToClipboard(sourceElement.textContent)
      if (success) {
        showCopyFeedback(e.target)
      }
    }
  }
})

// Funzione per caricare e visualizzare i wallet disponibili
async function loadAvailableWallets () {
  try {
    const publicKey = walletManager.getPublicKey()
    if (!publicKey) return

    const wallets = await new Promise((resolve) => {
      const walletsData = []
      walletManager
        .getGun()
        .get('wallets')
        .get(publicKey)
        .map()
        .once((data, key) => {
          if (key !== '_' && data && data.address) {
            walletsData.push({
              address: data.address,
              entropy: data.entropy,
              timestamp: data.timestamp,
              privateKey: data.privateKey
            })
          }
        })

      setTimeout(() => resolve(walletsData), 2000)
    })

    if (!wallets || wallets.length === 0) {
      walletListDiv.innerHTML = '<p>Nessun wallet trovato</p>'
      return
    }

    wallets.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

    let walletHtml = ''
    wallets.forEach((wallet) => {
      if (!wallet.address) return

      walletHtml += `
                <div class="wallet-item">
                    <div class="wallet-label">Indirizzo:</div>
                    <div class="key-container">
                        <div class="key-value">${wallet.address}</div>
                        <button class="copy-btn" data-copy="wallet-${wallet.address}-address">Copia</button>
                    </div>
                    <div class="wallet-label">Chiave Privata:</div>
                    <div class="key-container">
                        <div class="key-value">${wallet.privateKey}</div>
                        <button class="copy-btn" data-copy="wallet-${wallet.address}-private">Copia</button>
                    </div>
                    <div class="wallet-label">Data:</div>
                    <div class="wallet-timestamp">${new Date(wallet.timestamp).toLocaleString()}</div>
                    <button onclick="window.loadWallet('${wallet.address}')" class="load-btn">Carica</button>
                </div>
            `
    })

    walletListDiv.innerHTML = walletHtml
    walletListDiv.style.display = 'block'
  } catch (error) {
    console.error('Errore nel caricamento dei wallet:', error)
    walletListDiv.innerHTML = '<p>Errore nel caricamento dei wallet</p>'
  }
}

// Funzione per caricare un wallet specifico
async function loadWallet (address) {
  try {
    const publicKey = walletManager.getPublicKey()
    if (!publicKey) {
      showStatus('Devi effettuare il login prima', true)
      return
    }

    const wallet = await new Promise((resolve) => {
      walletManager
        .getGun()
        .get('wallets')
        .get(publicKey)
        .get(address)
        .once((data) => {
          resolve(data)
        })
    })

    await walletManager.saveWalletLocally({
      wallet,
      publicKey
    })

    if (wallet && wallet.address) {
      document.getElementById('address').textContent = wallet.address
      document.getElementById('privateKey').textContent = wallet.privateKey
      document.getElementById('entropy').textContent = wallet.entropy || ''
      walletInfoDiv.style.display = 'block'
      showStatus('Wallet caricato con successo!')
    } else {
      showStatus('Wallet non trovato', true)
    }
  } catch (error) {
    showStatus(`Errore nel caricamento del wallet: ${error.message}`, true)
  }
}

function updateAuthUI (isLoggedIn, publicKey = '') {
  if (isLoggedIn) {
    authBadge.textContent = 'AUTHENTICATED'
    authBadge.style.background = '#059669'
    authTitle.textContent = 'Signed In'
    authDescription.textContent = 'You are authenticated and can manage your wallets.'
    if (publicKey) {
      document.getElementById('accountPublicKey').textContent = publicKey
      accountInfoBox.style.display = 'block'
    }
  } else {
    authBadge.textContent = 'UNAUTHENTICATED'
    authBadge.style.background = '#dc2626'
    authTitle.textContent = 'Not Signed In'
    authDescription.textContent = 'You are currently not authenticated. Create an account or login to get started.'
    accountInfoBox.style.display = 'none'
  }
}

// Funzione per contare i wallet esistenti
async function countExistingWallets (publicKey) {
  return new Promise((resolve) => {
    let count = 0
    walletManager
      .getGun()
      .get('wallets')
      .get(publicKey)
      .map()
      .once((data, key) => {
        if (key !== '_' && data && data.address) {
          count++
        }
      })

    // Diamo tempo a Gun di recuperare tutti i wallet
    setTimeout(() => resolve(count), 1000)
  })
}

// Event Listeners
createAccountBtn.addEventListener('click', async () => {
  const username = usernameInput.value.trim()
  const password = passwordInput.value

  if (!username || !password) {
    showStatus('Username and password are required', true)
    return
  }

  try {
    await walletManager.createAccount(username, password)
    const publicKey = walletManager.getPublicKey()
    showStatus('Account created successfully! You are now logged in.')
    updateButtonStates(true)
    updateAuthUI(true, publicKey)
    await loadAvailableWallets()
  } catch (error) {
    showStatus(`Error creating account: ${error.message}`, true)
    updateAuthUI(false)
  }
})

loginBtn.addEventListener('click', async () => {
  const username = usernameInput.value.trim()
  const password = passwordInput.value

  if (!username || !password) {
    showStatus('Username and password are required', true)
    return
  }

  try {
    const publicKey = await walletManager.login(username, password)
    if (publicKey) {
      showStatus('Login successful!')
      updateButtonStates(true)
      updateAuthUI(true, publicKey)
      await loadAvailableWallets()
    } else {
      showStatus('Login failed: public key not found', true)
      updateAuthUI(false)
    }
  } catch (error) {
    showStatus(`Login error: ${error.message}`, true)
    updateAuthUI(false)
  }
})

logoutBtn.addEventListener('click', () => {
  walletManager.logout()
  updateButtonStates(false)
  updateAuthUI(false)
  walletInfoDiv.style.display = 'none'
  walletListDiv.innerHTML = ''
  showStatus('Logout successful!')
})

createWalletBtn.addEventListener('click', async () => {
  try {
    const gunKeyPair = walletManager.getCurrentUserKeyPair()
    const publicKey = walletManager.getPublicKey()

    if (!gunKeyPair || !publicKey) {
      showStatus('Error: You must be logged in first', true)
      return
    }

    // Conta i wallet esistenti
    const walletCount = await countExistingWallets(publicKey)

    // Crea il salt deterministico usando il conteggio dei wallet
    const deterministicSalt = `${gunKeyPair.pub}_${walletCount}_${Date.now()}`

    // Crea il wallet usando il salt deterministico
    const wallet = await WalletManager.createWalletFromSalt(gunKeyPair, deterministicSalt)

    if (!wallet || !wallet.address) {
      throw new Error('Failed to create valid wallet')
    }

    const walletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      entropy: deterministicSalt
    }

    // Show wallet and ask for confirmation
    const walletInfoHtml = `
            <h3>Active Wallet</h3>
            <div class="wallet-details">
                <div class="detail-row">
                    <span class="label">Address:</span>
                    <span id="address">${walletData.address}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Private Key:</span>
                    <span id="privateKey">${walletData.privateKey}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Entropy:</span>
                    <span id="entropy">${deterministicSalt}</span>
                </div>
            </div>
            <div class="save-buttons" id="saveButtonsContainer">
                <button id="saveWallet" class="btn btn-primary">Save Wallet</button>
                <button id="skipSave" class="btn btn-secondary">Skip Save</button>
            </div>
        `
    walletInfoDiv.innerHTML = walletInfoHtml
    walletInfoDiv.style.display = 'block'

    document.getElementById('saveWallet').addEventListener('click', async () => {
      try {
        const saveButton = document.getElementById('saveWallet')
        const skipButton = document.getElementById('skipSave')

        saveButton.disabled = true
        skipButton.disabled = true
        saveButton.textContent = 'Saving...'

        const walletData = {
          address: wallet.address,
          privateKey: wallet.privateKey,
          entropy: deterministicSalt,
          timestamp: Date.now()
        }

        await new Promise((resolve, reject) => {
          walletManager
            .getGun()
            .get('wallets')
            .get(publicKey)
            .get(wallet.address)
            .put(walletData, (ack) => {
              if (ack.err) reject(new Error(ack.err))
              else resolve()
            })
        })

        await walletManager.saveWalletLocally({
          address: wallet.address,
          privateKey: wallet.privateKey,
          entropy: deterministicSalt
        }, publicKey)

        showStatus('Wallet saved successfully!')
        await loadAvailableWallets()

        document.getElementById('saveButtonsContainer').remove()
      } catch (error) {
        showStatus(`Error saving wallet: ${error.message}`, true)
        const saveButton = document.getElementById('saveWallet')
        const skipButton = document.getElementById('skipSave')
        if (saveButton) {
          saveButton.disabled = false
          saveButton.textContent = 'Save Wallet'
        }
        if (skipButton) skipButton.disabled = false
      }
    })

    document.getElementById('skipSave').addEventListener('click', () => {
      document.getElementById('saveButtonsContainer').remove()
      showStatus('Wallet not saved')
    })
  } catch (error) {
    showStatus(`Error creating wallet: ${error.message}`, true)
  }
})

exportWalletBtn.addEventListener('click', async () => {
  try {
    const publicKey = walletManager.getPublicKey()
    if (!publicKey) {
      showStatus('Devi effettuare il login prima di esportare un wallet', true)
      return
    }

    // Esporta tutti i dati
    const exportData = await walletManager.exportAllData(publicKey)

    // Crea un blob con i dati
    const blob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    // Crea un link per il download
    const a = document.createElement('a')
    a.href = url
    a.download = `wallet-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()

    // Pulisci
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 0)

    showStatus('Wallet esportato con successo!')
  } catch (error) {
    showStatus(`Errore nell'export del wallet: ${error.message}`, true)
  }
})

importWalletBtn.addEventListener('click', async () => {
  try {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.json'

    fileInput.onchange = async (e) => {
      try {
        const file = e.target.files[0]
        if (!file) {
          showStatus('Nessun file selezionato', true)
          return
        }

        const reader = new FileReader()
        reader.onload = async (event) => {
          try {
            const jsonData = event.target.result

            // Parsing del JSON
            const backupData = JSON.parse(jsonData)

            // Verifica se il file contiene le chiavi Gun
            if (!backupData.gunPair || !backupData.gunPair.pub || !backupData.gunPair.priv) {
              showStatus('File di backup non valido: chiavi Gun mancanti', true)
              return
            }

            try {
              // Prima importa le chiavi Gun e autentica
              const publicKey = await walletManager.importGunKeyPair(JSON.stringify(backupData.gunPair))

              // Aggiorna l'UI per riflettere il login
              updateButtonStates(true)
              updateAuthUI(true, publicKey)

              // Se ci sono anche dati del wallet, importali e mostrali
              if (backupData.wallet && backupData.wallet.address && backupData.wallet.privateKey) {
                await walletManager.importAllData(jsonData, publicKey)

                // Aggiorna il wallet attivo
                document.getElementById('address').textContent = backupData.wallet.address
                document.getElementById('privateKey').textContent = backupData.wallet.privateKey
                document.getElementById('entropy').textContent = backupData.wallet.entropy || ''
                walletInfoDiv.style.display = 'block'
              }

              showStatus('Wallet importato con successo!')
              await loadAvailableWallets()
            } catch (authError) {
              showStatus(`Errore nell'autenticazione con le chiavi importate: ${authError.message}`, true)
            }
          } catch (parseError) {
            showStatus(`Errore nel parsing del file: ${parseError.message}`, true)
          }
        }

        reader.onerror = () => {
          showStatus('Errore nella lettura del file', true)
        }

        reader.readAsText(file)
      } catch (fileError) {
        showStatus(`Errore nella gestione del file: ${fileError.message}`, true)
      }
    }

    fileInput.click()
  } catch (error) {
    showStatus(`Errore nell'import del wallet: ${error.message}`, true)
  }
})

// Esponi la funzione loadWallet globalmente per i bottoni dinamici
window.loadWallet = loadWallet
