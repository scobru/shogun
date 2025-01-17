# Esempio di Login con MetaMask

Questo esempio mostra come integrare Hugo con MetaMask per gestire l'autenticazione degli utenti.

## Prerequisiti

- Node.js installato
- MetaMask installato nel browser
- Un ambiente di sviluppo locale

## Installazione

1. Clona il repository:
```bash
git clone https://github.com/tuouser/hugo.git
cd hugo
```

2. Installa le dipendenze del progetto principale:
```bash
npm install
```

3. Entra nella cartella dell'esempio e installa le sue dipendenze:
```bash
cd examples/metamask-login
npm install
```

4. Avvia il server di sviluppo:
```bash
npm run dev
```

5. Apri il browser all'indirizzo indicato (solitamente http://localhost:5173)

## Funzionalità

L'esempio implementa le seguenti funzionalità:

- Verifica della disponibilità di MetaMask
- Connessione a MetaMask
- Creazione di un nuovo account usando MetaMask
- Login con un account esistente
- Logout
- Visualizzazione delle informazioni dell'account

## Struttura del Codice

- `index.html`: Interfaccia utente base
- `main.js`: Logica dell'applicazione e integrazione con Hugo
- `vite.config.js`: Configurazione del bundler
- `package.json`: Dipendenze e script
- `README.md`: Documentazione

## Come Usare

1. Assicurati che MetaMask sia installato e sbloccato
2. Clicca su "Connetti MetaMask" per autorizzare l'applicazione
3. Puoi:
   - Creare un nuovo account cliccando su "Crea Account con MetaMask"
   - Effettuare il login con un account esistente cliccando su "Login con MetaMask"
4. Una volta autenticato, vedrai le informazioni del tuo account
5. Puoi effettuare il logout cliccando su "Logout"

## Note sulla Sicurezza

- L'esempio usa il protocollo standard di firma di MetaMask per l'autenticazione
- Le chiavi private non lasciano mai MetaMask
- I dati sono salvati in modo sicuro usando Gun.js

## Troubleshooting

Se incontri problemi:

1. Assicurati che MetaMask sia sbloccato
2. Verifica di essere sulla rete corretta in MetaMask
3. Controlla la console del browser per eventuali errori
4. Prova a ricaricare la pagina se i pulsanti non rispondono
5. Se hai problemi con le dipendenze:
   ```bash
   rm -rf node_modules
   npm install
   ``` 