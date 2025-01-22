# HUGO Wallet - Demo Indirizzi Stealth

Questo esempio mostra come utilizzare gli indirizzi stealth per inviare e ricevere pagamenti in modo privato con HUGO Wallet.

## Cos'è un Indirizzo Stealth?

Un indirizzo stealth è un indirizzo unico generato per ogni transazione, che permette di:
- Ricevere pagamenti senza rivelare il proprio indirizzo principale
- Evitare che le transazioni siano tracciabili sulla blockchain
- Mantenere la privacy delle proprie transazioni

## Requisiti

- Browser moderno con supporto JavaScript ES6+
- Node.js e npm installati
- Metamask o altro wallet Ethereum (opzionale per test su rete reale)

## Funzionalità

- Generazione e gestione delle chiavi stealth
- Invio di pagamenti usando indirizzi stealth
- Ricezione e scansione di pagamenti stealth
- Storico delle transazioni
- Interfaccia user-friendly con feedback visivo

## Come eseguire l'esempio

1. Installa le dipendenze:
   ```bash
   npm install
   ```

2. Avvia il server di sviluppo:
   ```bash
   npm run dev
   ```

3. Apri il browser su:
   ```
   http://localhost:5173
   ```

## Come funziona

1. **Setup Iniziale**:
   - Genera nuove chiavi stealth
   - Salva le chiavi localmente
   - Visualizza il tuo indirizzo stealth pubblico

2. **Invio di un Pagamento**:
   - Inserisci l'indirizzo stealth del destinatario
   - Specifica l'importo da inviare
   - Conferma la transazione

3. **Ricezione di Pagamenti**:
   - Condividi il tuo indirizzo stealth con altri
   - Scansiona periodicamente per nuovi pagamenti
   - I pagamenti ricevuti appariranno nello storico

4. **Gestione Transazioni**:
   - Visualizza lo storico completo delle transazioni
   - Distingui tra pagamenti inviati e ricevuti
   - Verifica dettagli come importo, data e controparte

## Note sulla Privacy

- Ogni transazione usa un indirizzo unico
- Le transazioni non sono collegabili tra loro sulla blockchain
- Solo il destinatario può identificare i pagamenti a lui destinati
- Le chiavi private non lasciano mai il dispositivo

## Sviluppo

Il codice è organizzato in moduli:
- `index.html`: Interfaccia utente e logica di presentazione
- `main.js`: Logica di business e integrazione con HUGO Wallet
- `vite.config.js`: Configurazione del bundler

## Sicurezza

- Le chiavi sono salvate solo localmente nel browser
- Usa sempre HTTPS in produzione
- Non condividere mai le chiavi private
- Fai backup regolari delle tue chiavi 