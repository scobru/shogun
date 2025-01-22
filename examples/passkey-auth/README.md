# HUGO Wallet - Demo Passkey

Questo esempio mostra come integrare l'autenticazione con Passkey nel tuo wallet HUGO.

## Nota sui Test

Le Passkey/WebAuthn sono una tecnologia specifica del browser che richiede:
- Un browser moderno con supporto WebAuthn
- Hardware reale (TPM, secure enclave, ecc.)
- Interazione utente per la biometria/PIN

Per questo motivo, non è possibile (o utile) scrivere test automatici in Node.js. Questo esempio serve come test manuale e dimostrazione delle funzionalità Passkey.

## Requisiti

- Browser moderno che supporta WebAuthn/Passkey (Chrome, Safari, Firefox, Edge)
- Dispositivo con supporto biometrico o PIN (per Windows Hello, Touch ID, Face ID, ecc.)

## Funzionalità

- Verifica del supporto Passkey nel browser
- Registrazione di un nuovo account con Passkey
- Login con Passkey
- Visualizzazione delle informazioni del wallet
- Esportazione dei dati del wallet
- Logout

## Come eseguire l'esempio

1. Installa le dipendenze:
   ```bash
   npm install
   ```

2. Avvia il server di sviluppo:
   ```bash
   npm run dev
   ```

3. Il browser si aprirà automaticamente su `http://localhost:5173`

## Come funziona

1. **Verifica del supporto**: All'avvio, l'app verifica se il browser supporta le Passkey.

2. **Registrazione**:
   - Inserisci un username
   - Clicca su "Registrati con Passkey"
   - Segui le istruzioni del browser per creare la Passkey
   - La Passkey verrà salvata nel tuo dispositivo

3. **Login**:
   - Inserisci l'username registrato
   - Clicca su "Login con Passkey"
   - Usa la biometria o il PIN per autenticarti
   - Accedi al tuo wallet

4. **Gestione wallet**:
   - Visualizza le informazioni del wallet
   - Esporta i dati in un file JSON
   - Effettua il logout quando hai finito

## Note sulla sicurezza

- Le Passkey sono salvate in modo sicuro nel secure enclave del dispositivo
- I dati biometrici non lasciano mai il dispositivo
- Ogni Passkey è unica per il sito web e non può essere riutilizzata altrove
- Non è necessario ricordare password complesse 