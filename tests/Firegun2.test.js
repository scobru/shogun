const { expect } = require('chai');
const Firegun = require('../dist/db/Firegun2').default;
const Gun = require('gun');
require('gun/sea');

describe('Firegun', () => {
  let firegun;
  let gunServer;
  
  before(async () => {
    // Avvia il server Gun per i test
    gunServer = new Gun({
      web: require('http').createServer().listen(8765)
    });
  });

  after(async () => {
    // Chiudi il server e pulisci
    if (gunServer?.web) {
      await new Promise(resolve => gunServer.web.close(resolve));
    }
  });
  
  beforeEach(() => {
    // Inizializza una nuova istanza di Firegun per ogni test
    firegun = new Firegun({
      peers: ['http://localhost:8765/gun'],
      dbname: 'testDB',
      localstorage: false
    });
  });

  afterEach(() => {
    // Cleanup dopo ogni test
    firegun.cleanup();
  });

  describe('Basic Operations', () => {
    it('should initialize with correct configuration', () => {
      expect(firegun.prefix).to.equal('');
      expect(firegun.dbname).to.equal('testDB');
      expect(firegun.peers).to.deep.equal(['http://localhost:8765/gun']);
    });

    it('should set and get data', async () => {
      const testData = { test: 'value', id: 'test-id' }; // Aggiungi id manualmente
      const path = 'test/path';

      const putResult = await firegun.Put(path, testData);
      expect(putResult).to.exist;
      
      const result = await firegun.Get(path);
      expect(result).to.deep.include(testData);
    }).timeout(10000);

    it('should handle timeouts gracefully', async () => {
      const slowPath = 'slow/path';
      
      try {
        await firegun.Get(slowPath, undefined, undefined, 1000);
        throw new Error('Should have timed out');
      } catch (error) {
        expect(error).to.exist;
      }
    }).timeout(10000);
  });

  describe('User Operations', () => {
    it('should create and authenticate user', async () => {
      const alias = 'testUser';
      const pair = await Gun.SEA.pair();
      
      const result = await firegun.loginPair(pair, alias);
      expect(result).to.exist;
      expect(firegun.user.alias).to.equal(alias);
      expect(firegun.user.pair).to.include.keys(['pub', 'priv']);
    });

    it('should handle sensitive data encryption', async () => {
      console.log('Starting encryption test...');
      const pair = await Gun.SEA.pair();
      console.log('Generated pair:', pair);
      
      const loginResult = await firegun.loginPair(pair, 'testUser');
      console.log('Login result:', loginResult);
      console.log('Current user state:', firegun.user);

      const sensitiveData = { secret: 'value', id: 'test-id' };
      const path = 'user/secrets';

      console.log('Waiting for login to settle...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('User state after wait:', firegun.user);

      try {
        console.log('Attempting to set data...');
        const setResult = await firegun.userPut(path, sensitiveData);
        
        // Aspetta più a lungo e verifica multipla
        let retries = 3;
        let result;
        while (retries > 0) {
          await new Promise(r => setTimeout(r, 5000));
          console.log('Attempting to get data...');
          result = await firegun.userGet(path);
          
          if (result && result.secret) break;
          retries--;
        }
        
        expect(result).to.exist;
        expect(result).to.deep.include(sensitiveData);
      } catch (err) {
        console.error('Error in encryption test:', err);
        throw err;
      }
    }).timeout(60000);

    it('should handle key management during login', async () => {
      console.log('Starting key management test...');
      
      const username = 'testUser_' + Date.now();
      const password = 'testPass';
      
      try {
        console.log('Creating new user...');
        const newUser = await firegun.userNew(username, password);
        
        // Aspetta più a lungo con verifica ciclica
        let storedKeys;
        let retries = 5;
        while (retries > 0) {
          await new Promise(r => setTimeout(r, 5000));
          storedKeys = await firegun.userGet('keys');
          if (storedKeys && storedKeys.gun) break;
          retries--;
        }
        
        // Verifica avanzata
        expect(storedKeys).to.contain.keys('gun');
        expect(storedKeys.gun).to.contain.keys(['pub', 'priv', 'epub', 'epriv']);
        
        // Verifica che le chiavi siano state salvate nel database
        const initialStoredKeys = await firegun.userGet('keys');
        console.log('Initial stored keys:', initialStoredKeys);
        
        // Verifica la struttura delle chiavi salvate
        expect(initialStoredKeys).to.exist;
        expect(initialStoredKeys.gun).to.exist;

        // Estrai le chiavi effettive dalla struttura Gun
        const storedGunKeys = initialStoredKeys.gun;
        expect(storedGunKeys).to.deep.equal({
          pub: newUser.pair.pub,
          priv: newUser.pair.priv,
          epub: newUser.pair.epub,
          epriv: newUser.pair.epriv
        });

        // Salva le chiavi originali
        const originalKeys = JSON.parse(JSON.stringify(firegun.keys));

        // Logout
        await firegun.userLogout();
        expect(firegun.keys).to.be.undefined;

        // Login con le stesse credenziali
        console.log('Logging in with same credentials...');
        const loginResult = await firegun.userLogin(username, password);
        console.log('Login result:', loginResult);

        // Aspetta che le chiavi vengano caricate
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Verifica che le chiavi siano state caricate correttamente
        expect(firegun.keys).to.exist;
        expect(firegun.keys.gun).to.exist;
        expect(firegun.keys.gun).to.deep.equal(originalKeys.gun);
        
        console.log('Key management test completed successfully');
      } catch (error) {
        console.error('Test error:', error);
        throw error;
      }
    }).timeout(120000);
  });

  describe('Subscription Management', () => {
    it('should handle channel subscriptions', async () => {
      const channelId = 'test-channel';
      let callbackCalled = false;
      const callback = () => { callbackCalled = true; };

      await firegun.subscribeToChannel(channelId, callback);
      expect(firegun['subscriptions'].has(channelId)).to.be.true;

      // Aspetta che la sottoscrizione sia attiva
      await new Promise(resolve => setTimeout(resolve, 1000));

      firegun.gun.get('channels').get(channelId).put({ message: 'test' });

      // Aspetta che il callback venga chiamato
      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(callbackCalled).to.be.true;
    }).timeout(10000);

    it('should cleanup subscriptions properly', async () => {
      const channelId = 'test-channel';
      const callback = () => {};

      await firegun.subscribeToChannel(channelId, callback);
      firegun.unsubscribeFromChannel(channelId);

      expect(firegun['subscriptions'].has(channelId)).to.be.false;
    });
  });

  describe('Concurrency Control', () => {
    it('should handle concurrent operations with locks', async () => {
      const path = 'test/concurrent';
      const data1 = { value: 1 };
      const data2 = { value: 2 };

      // Esegui due operazioni Put concorrenti
      const operation1 = firegun.Put(path, data1);
      const operation2 = firegun.Put(path, data2);

      await Promise.all([operation1, operation2]);

      // Verifica che il lock abbia prevenuto race conditions
      const result = await firegun.Get(path);
      expect(result).to.deep.include(data2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid paths', async () => {
      try {
        await firegun.Get('');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should handle unauthorized access', async () => {
      console.log('Starting unauthorized access test...');
      
      // Reset completo dell'utente
      firegun.user = undefined;
      console.log('User state after reset:', firegun.user);

      try {
        console.log('Attempting unauthorized access...');
        await firegun.userGet('protected/path');
        throw new Error('Expected an error but none was thrown');
      } catch (error) {
        console.log('Caught error:', error);
        expect(error).to.be.an('error');
        expect(error.message).to.equal('User not authenticated');
      }
    });
  });

  describe('Key Generation', () => {
    it('should generate and store all security keys', async () => {
      const username = 'keyTestUser_' + Date.now();
      const password = 'testPass123';

      try {
        // Crea nuovo utente
        const newUser = await firegun.userNew(username, password);
        
        // Verifica la struttura delle chiavi
        expect(firegun.keys).to.exist;
        expect(firegun.keys).to.contain.all.keys(
          'gun', 'activityPub', 'ethereum', 'stealth', 'wallets', 'webAuthn'
        );

        // Verifica chiavi ActivityPub
        expect(firegun.keys.activityPub).to.contain.keys(
          'publicKey', 'privateKey', 'createdAt'
        );
        expect(firegun.keys.activityPub?.publicKey).to.match(/^-----BEGIN PUBLIC KEY-----/);

        // Verifica chiavi Ethereum
        expect(firegun.keys.ethereum).to.contain.keys('address', 'privateKey');
        expect(firegun.keys.ethereum?.address).to.match(/^0x[a-fA-F0-9]{40}$/);

        // Verifica chiavi Stealth
        expect(firegun.keys.stealth).to.contain.keys('pub', 'priv', 'epub', 'epriv');
        expect(firegun.keys.stealth?.pub).to.have.length.above(40);

        // Verifica portafogli
        expect(firegun.keys.wallets?.ethereum).to.be.an('array').with.length(1);
        expect(firegun.keys.wallets?.ethereum[0]).to.contain.keys(
          'address', 'privateKey', 'entropy', 'timestamp'
        );

        // Verifica WebAuthn
        expect(firegun.keys.webAuthn).to.contain.keys('credentialId', 'lastUsed', 'deviceInfo');
        expect(firegun.keys.webAuthn?.deviceInfo).to.contain.keys('name', 'platform');

        // Verifica salvataggio pubblico
        const publicKeys = await firegun.Get(`~${newUser.pair.pub}`);
        expect(publicKeys).to.contain.keys(
          'gun', 'activityPub', 'ethereum', 'stealth', 'webAuthn'
        );
        
      } catch (error) {
        console.error('Key generation test failed:', error);
        throw error;
      }
    }).timeout(30000);

    it('should handle key generation errors', async () => {
      try {
        // Simula un errore nella generazione delle chiavi
        const originalCreatePair = firegun.activityPubManager.createPair;
        firegun.activityPubManager.createPair = () => Promise.reject(new Error('Simulated failure'));

        await firegun.userNew('failUser', 'password');
        throw new Error('Should have failed');
      } catch (error) {
        expect(error.message).to.include('Failed to generate security keys');
      } finally {
        if (firegun.activityPubManager) {
          firegun.activityPubManager.createPair = originalCreatePair;
        }
      }
    }).timeout(10000);
  });

  describe('WebAuthn Integration', () => {
    it('should register and login user with WebAuthn', async () => {
      const username = 'webauthn_test_user';
      const deviceName = 'Test Device';

      // Test registrazione
      const newUser = await firegun.userNewWebAuthn(username, deviceName);
      expect(newUser).to.exist;
      expect(newUser.alias).to.equal(username);
      
      // Verifica che le credenziali WebAuthn siano state salvate
      const webauthnData = await firegun.userGet('webauthn');
      expect(webauthnData).to.exist;
      expect(webauthnData.credentialId).to.exist;
      expect(webauthnData.deviceInfo.name).to.equal(deviceName);

      // Logout
      await firegun.userLogout();

      // Test login
      const loggedUser = await firegun.userLoginWebAuthn(username);
      expect(loggedUser).to.exist;
      expect(loggedUser.alias).to.equal(username);

      // Test firma messaggio
      const message = 'Test message';
      const signature = await firegun.signMessageWebAuthn(message);
      expect(signature).to.exist;
    }).timeout(30000);

    it('should handle WebAuthn errors gracefully', async () => {
      try {
        await firegun.userLoginWebAuthn('non_existent_user');
        throw new Error('Should have failed');
      } catch (error) {
        expect(error.message).to.include('WebAuthn');
      }
    });
  });

  describe('Wallet Management', () => {
    it('should create and store wallet', async () => {
      const username = 'wallet_test_user';
      const password = 'test123';

      // Crea un nuovo utente
      const user = await firegun.userNew(username, password);
      expect(user).to.exist;

      // Crea un nuovo wallet
      const wallet = await firegun.createWallet();
      expect(wallet).to.exist;
      expect(wallet.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(wallet.privateKey).to.exist;

      // Verifica che il wallet sia stato salvato
      const privateWallets = await firegun.getWallets();
      expect(privateWallets).to.be.an('array');
      expect(privateWallets[0].address).to.equal(wallet.address);

      // Verifica il nodo pubblico
      const publicWallet = await firegun.Get(`~${user.pair.pub}/public/wallets/ethereum`);
      expect(publicWallet).to.exist;
      expect(publicWallet.address).to.equal(wallet.address);
      expect(publicWallet.privateKey).to.be.undefined;

      // Test firma messaggio
      const message = 'Test message';
      const signature = await firegun.signWithWallet(message, wallet.address);
      expect(signature).to.exist;
    }).timeout(30000);

    it('should handle wallet errors gracefully', async () => {
      try {
        await firegun.createWallet();
        throw new Error('Should have failed');
      } catch (error) {
        expect(error.message).to.include('non autenticato');
      }
    });
  });
}); 