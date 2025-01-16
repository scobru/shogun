import { WalletManager } from "./WalletManager";

(async function main() {
  const manager = new WalletManager();

  const alias = "pippo";
  const passphrase = "mySecretPassword123";

  // 1) Crea account
  await manager.createAccount(alias, passphrase);
  console.log("Account creato!");

  // 2) Login
  const pubKey = await manager.login(alias, passphrase);
  if (!pubKey) {
    console.error("Login fallito!");
    return;
  }
  console.log("Login effettuato! Chiave pubblica GUN:", pubKey);

  // 3) Crea due wallet (address) a partire dal keyPair GUN
  const gunKeyPair = manager.getCurrentUserKeyPair();
  
  // Primo wallet
  const { walletObj: wallet1, entropy: entropy1 } = await WalletManager.createWalletObj(gunKeyPair);
  console.log("Primo wallet creato, address:", wallet1.publicKey, "entropy:", entropy1);

  // Secondo wallet
  const { walletObj: wallet2, entropy: entropy2 } = await WalletManager.createWalletObj(gunKeyPair);
  console.log("Secondo wallet creato, address:", wallet2.publicKey, "entropy:", entropy2);

  // 4) Salva entrambi i wallet
  await manager.saveWalletLocally(wallet1, alias);
  await manager.saveWalletToGun(wallet1, alias);
  await manager.saveWalletLocally(wallet2, alias);
  await manager.saveWalletToGun(wallet2, alias);
  console.log("Wallet salvati localmente e su GunDB.");

  // 5) Recupera tutti i wallet
  const wallets = await manager.retrieveWallets(alias);
  if (wallets.length > 0) {
    console.log("Wallet recuperati con successo:", wallets);
    
    // Esempio di recupero di un wallet specifico
    const specificWallet = await manager.retrieveWalletByAddress(alias, wallet1.publicKey);
    if (specificWallet) {
      console.log("Wallet specifico recuperato:", specificWallet);
    }
  } else {
    console.log("Nessun wallet trovato.");
  }

  // 6) Logout
  manager.logout();
  console.log("Logout eseguito.");
})();
