import { WalletManager } from '@scobru/shogun'

// Elementi DOM
const metamaskStatus = document.getElementById('metamaskStatus')
const connectBtn = document.getElementById('connectBtn')
const loginBtn = document.getElementById('loginBtn')
const createAccountBtn = document.getElementById('createAccountBtn')
const logoutBtn = document.getElementById('logoutBtn')
const walletInfo = document.getElementById('walletInfo')

// Istanza di WalletManager
const walletManager = new WalletManager()
const ethereumManager = walletManager.getEthereumManager()

// Stato dell'applicazione
let isConnected = false
let currentAccount = null

/**
 * Aggiorna lo stato dell'interfaccia utente
 */
function updateUI () {
  connectBtn.disabled = isConnected
  loginBtn.disabled = !isConnected || currentAccount !== null
  createAccountBtn.disabled = !isConnected || currentAccount !== null
  logoutBtn.disabled = !currentAccount

  if (currentAccount) {
    walletInfo.innerHTML = `
            <h3>Account Connesso</h3>
            <pre>Indirizzo: ${currentAccount}</pre>
            <pre>Chiave Pubblica: ${walletManager.getPublicKey()}</pre>
        `
  } else {
    walletInfo.innerHTML = ''
  }
}

/**
 * Verifica la disponibilità di MetaMask
 */
async function checkMetaMask () {
  try {
    if (typeof window.ethereum !== 'undefined') {
      metamaskStatus.textContent = 'MetaMask è disponibile! ✅'
      metamaskStatus.classList.add('success')
      connectBtn.disabled = false
    } else {
      throw new Error('MetaMask non trovato')
    }
  } catch (error) {
    metamaskStatus.textContent = `Errore: ${error.message} ❌`
    metamaskStatus.classList.add('error')
  }
}

/**
 * Connette a MetaMask
 */
async function connectMetaMask () {
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    isConnected = true
    metamaskStatus.textContent = `Connesso a MetaMask: ${accounts[0]} ✅`
    metamaskStatus.classList.remove('error')
    metamaskStatus.classList.add('success')
    updateUI()
  } catch (error) {
    metamaskStatus.textContent = `Errore di connessione: ${error.message} ❌`
    metamaskStatus.classList.remove('success')
    metamaskStatus.classList.add('error')
  }
}

/**
 * Crea un nuovo account usando MetaMask
 */
async function createAccount () {
  try {
    const username = await ethereumManager.createAccountWithEthereum()
    currentAccount = username
    metamaskStatus.textContent = `Account creato con successo: ${username} ✅`
    metamaskStatus.classList.remove('error')
    metamaskStatus.classList.add('success')
  } catch (error) {
    metamaskStatus.textContent = `Errore nella creazione dell'account: ${error.message} ❌`
    metamaskStatus.classList.remove('success')
    metamaskStatus.classList.add('error')
  }
  updateUI()
}

/**
 * Effettua il login con MetaMask
 */
async function login () {
  try {
    const pubKey = await ethereumManager.loginWithEthereum()
    if (pubKey) {
      currentAccount = await window.ethereum.request({ method: 'eth_accounts' }).then(accounts => accounts[0])
      metamaskStatus.textContent = 'Login effettuato con successo ✅'
      metamaskStatus.classList.remove('error')
      metamaskStatus.classList.add('success')
    }
  } catch (error) {
    metamaskStatus.textContent = `Errore nel login: ${error.message} ❌`
    metamaskStatus.classList.remove('success')
    metamaskStatus.classList.add('error')
  }
  updateUI()
}

/**
 * Effettua il logout
 */
function logout () {
  walletManager.logout()
  currentAccount = null
  metamaskStatus.textContent = 'Logout effettuato ✅'
  metamaskStatus.classList.remove('error')
  metamaskStatus.classList.add('success')
  updateUI()
}

// Event listeners
connectBtn.addEventListener('click', connectMetaMask)
loginBtn.addEventListener('click', login)
createAccountBtn.addEventListener('click', createAccount)
logoutBtn.addEventListener('click', logout)

// Inizializzazione
checkMetaMask()
updateUI()
