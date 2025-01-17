# Esempi di Utilizzo di Hugo

Questa cartella contiene esempi pratici di come utilizzare le funzionalità di Hugo.

## Esempi Disponibili

### 1. Basic Wallet (`basic-wallet/`)
Un esempio base che mostra come:
- Creare un account
- Effettuare login/logout
- Creare e gestire un wallet
- Salvare e recuperare i wallet da GunDB

### 2. Indirizzi Stealth (`stealth-address/`)
Un esempio più avanzato che dimostra:
- Generazione di chiavi stealth
- Creazione di indirizzi stealth
- Recupero di indirizzi stealth
- Gestione delle chiavi di visualizzazione e spesa

## Come Eseguire gli Esempi

1. Assicurati di avere Node.js installato (versione 14 o superiore)

2. Installa le dipendenze per l'esempio che vuoi provare:
   ```bash
   cd examples/basic-wallet  # o stealth-address
   npm install
   ```

3. Avvia il server di sviluppo:
   ```bash
   npm run dev
   ```

4. Apri il browser all'indirizzo indicato (solitamente http://localhost:5173)

## Note Importanti

- Gli esempi utilizzano GunDB per la persistenza dei dati. Assicurati di avere una connessione internet attiva.
- Le chiavi private e i dati sensibili sono salvati localmente nel browser.
- Questi esempi sono pensati per scopi dimostrativi e non dovrebbero essere usati in produzione senza adeguate misure di sicurezza.

## Troubleshooting

### Problemi Comuni

1. **Errori di Importazione**
   - Assicurati che il progetto principale sia compilato correttamente
   - Verifica che i path negli import siano corretti

2. **GunDB non Risponde**
   - Controlla la tua connessione internet
   - Verifica che il peer GunDB sia raggiungibile

3. **Errori di Compilazione**
   - Esegui `npm install` nella root del progetto
   - Verifica di avere tutte le dipendenze necessarie

### Supporto

Se incontri problemi o hai domande:
1. Controlla le issues su GitHub
2. Apri una nuova issue se il problema non è già stato segnalato
3. Fornisci dettagli completi sul problema e i passi per riprodurlo 