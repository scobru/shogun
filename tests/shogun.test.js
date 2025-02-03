const { describe, it, beforeEach, afterEach } = require('mocha')
const assert = require('assert')
const { Shogun } = require('../dist/Shogun')
const { Wallet } = require('ethers')

// Configurazione di test per Gun e APP_KEY_PAIR
const gunOptions = {
  peers: ['http://localhost:8765/gun'],
  file: 'radata_test',
  radisk: false,
  localStorage: false,
  multicast: false
}

const APP_KEY_PAIR = {
  pub: 'test_pub_key',
  priv: 'test_priv_key'
}

describe('Shogun Test Suite', function () {
  this.timeout(30000)
  let shogun
  let testAlias
  let testPassword

  beforeEach(async function () {
    shogun = new Shogun(gunOptions, APP_KEY_PAIR)
    testAlias = `testuser_${Math.random().toString(36).substring(2)}`
    testPassword = 'password123'
  })

  afterEach(async function () {
    if (shogun) {
      shogun.getGunAuthManager().logout()
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  })

  describe('User Creation', function () {
    it('should create a complete user with all components', async function () {
      const user = await shogun.createUser(testAlias, testPassword)

      // Verifica che tutti i componenti siano presenti
      assert(user.pair, 'Should have Gun keypair')
      assert(user.pair.pub, 'Should have public key')
      assert(user.pair.priv, 'Should have private key')

      assert(user.wallet, 'Should have wallet')
      assert(user.wallet.walletObj, 'Should have wallet object')
      assert(user.wallet.walletObj.address, 'Should have wallet address')
      assert(user.wallet.walletObj.privateKey, 'Should have wallet private key')
      assert(user.wallet.entropy, 'Should have wallet entropy')

      assert(user.stealthKey, 'Should have stealth key')
      assert(user.stealthKey.pub, 'Should have stealth public key')
      assert(user.stealthKey.priv, 'Should have stealth private key')

      assert(user.activityPubKey, 'Should have ActivityPub key')
      assert(user.activityPubKey.publicKey, 'Should have ActivityPub public key')
      assert(user.activityPubKey.privateKey, 'Should have ActivityPub private key')
    })

    it('should fail user creation with invalid credentials', async function () {
      try {
        await shogun.createUser('', '')
        assert.fail('Should throw validation error')
      } catch (error) {
        assert(error.message.includes('invalid'), 'Should mention invalid credentials')
      }
    })
  })

  describe('User Retrieval', function () {
    it('should retrieve existing user data', async function () {
      // Prima creiamo un utente
      const createdUser = await shogun.createUser(testAlias, testPassword)
      
      // Poi proviamo a recuperarlo
      const retrievedUser = await shogun.getUser(testAlias)

      // Verifichiamo che i dati corrispondano
      assert.strictEqual(
        retrievedUser.pair.pub,
        createdUser.pair.pub,
        'Gun public keys should match'
      )

      assert.strictEqual(
        retrievedUser.wallet.walletObj.address.toLowerCase(),
        createdUser.wallet.walletObj.address.toLowerCase(),
        'Wallet addresses should match'
      )

      assert.strictEqual(
        retrievedUser.stealthKey.pub,
        createdUser.stealthKey.pub,
        'Stealth public keys should match'
      )

      assert.strictEqual(
        retrievedUser.activityPubKey.publicKey,
        createdUser.activityPubKey.publicKey,
        'ActivityPub public keys should match'
      )
    })

    it('should handle non-existent user retrieval', async function () {
      try {
        await shogun.getUser('nonexistent_user')
        assert.fail('Should throw error for non-existent user')
      } catch (error) {
        assert(error.message.includes('not found') || error.message.includes('non esistente'),
          'Should mention user not found')
      }
    })
  })

  describe('Wallet Management', function () {
    it('should manage multiple wallets for a user', async function () {
      // Creiamo un utente
      await shogun.createUser(testAlias, testPassword)
      const walletManager = shogun.getWalletManager()

      // Creiamo alcuni wallet aggiuntivi
      const wallet1 = Wallet.createRandom()
      const wallet2 = Wallet.createRandom()
      const publicKey = shogun.getGunAuthManager().getPublicKey()

      // Salviamo i wallet
      await walletManager.saveWallet(wallet1, publicKey)
      await walletManager.saveWallet(wallet2, publicKey)

      // Recuperiamo tutti i wallet
      const wallets = await walletManager.getWallets()

      // Verifichiamo che ci siano almeno 2 wallet
      assert(wallets.length >= 2, 'Should have at least 2 wallets')

      // Verifichiamo che ogni wallet abbia le proprietà corrette
      wallets.forEach(wallet => {
        assert(wallet.address, 'Each wallet should have an address')
        assert(wallet.privateKey, 'Each wallet should have a private key')
        assert((wallet as any).entropy, 'Each wallet should have entropy')
        assert((wallet as any).timestamp, 'Each wallet should have timestamp')
      })

      // Verifichiamo che i wallet siano ordinati per timestamp
      const timestamps = wallets.map(w => (w as any).timestamp)
      assert(
        timestamps.every((t, i) => i === 0 || t >= timestamps[i - 1]),
        'Wallets should be ordered by timestamp'
      )
    })

    it('should retrieve the primary wallet', async function () {
      // Creiamo un utente
      const user = await shogun.createUser(testAlias, testPassword)
      const walletManager = shogun.getWalletManager()

      // Recuperiamo il wallet principale
      const primaryWallet = await walletManager.getWallet()

      assert(primaryWallet, 'Should retrieve primary wallet')
      assert(primaryWallet.address, 'Primary wallet should have address')
      assert(primaryWallet.privateKey, 'Primary wallet should have private key')
    })
  })

  describe('Data Persistence', function () {
    it('should persist all user data between sessions', async function () {
      // Prima sessione: creazione utente
      const user1 = await shogun.createUser(testAlias, testPassword)
      const firstSessionData = await shogun.getUser(testAlias)
      
      // Logout
      shogun.getGunAuthManager().logout()
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Seconda sessione: nuovo Shogun e login
      const shogun2 = new Shogun(gunOptions, APP_KEY_PAIR)
      await shogun2.getGunAuthManager().login(testAlias, testPassword)
      
      const secondSessionData = await shogun2.getUser(testAlias)

      // Verifica che i dati persistano
      assert.strictEqual(
        firstSessionData.wallet.walletObj.address.toLowerCase(),
        secondSessionData.wallet.walletObj.address.toLowerCase(),
        'Wallet data should persist between sessions'
      )

      assert.strictEqual(
        firstSessionData.stealthKey.pub,
        secondSessionData.stealthKey.pub,
        'Stealth keys should persist between sessions'
      )

      assert.strictEqual(
        firstSessionData.activityPubKey.publicKey,
        secondSessionData.activityPubKey.publicKey,
        'ActivityPub keys should persist between sessions'
      )
    })
  })
}) 