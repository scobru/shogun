const Gun = require('gun');
const WebTorrent = require('webtorrent');
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']); // Peer relay
const client = new WebTorrent();
const activeTorrents = new Set(); // Per tracciare torrent attivi

let mainWindow;
let user;

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadURL(`file://${__dirname}/index.html`);
});

// Registrazione di un nuovo utente
ipcMain.on('register-user', (event, credentials) => {
    const { username, password } = credentials;
    user = gun.user();
    user.create(username, password, (ack) => {
        if (ack.err) {
            mainWindow.webContents.send('log-message', `❌ Errore registrazione: ${ack.err}`);
        } else {
            mainWindow.webContents.send('log-message', `✅ Utente registrato con successo: ${username}`);
        }
    });
});

// Login utente esistente
ipcMain.on('login-user', (event, credentials) => {
    const { username, password } = credentials;
    user = gun.user();
    user.auth(username, password, (ack) => {
        if (ack.err) {
            mainWindow.webContents.send('log-message', `❌ Errore login: ${ack.err}`);
        } else {
            mainWindow.webContents.send('log-message', `✅ Login effettuato come: ${username}`);
        }
    });
});

// Pubblicare un file sulla rete P2P associato all'utente
function publishFile(filename, magnetURI) {
    if (!user || !user.is) {
        mainWindow.webContents.send('log-message', `❌ Effettua il login per pubblicare file.`);
        return;
    }
    user.get('p2p-files').set({ name: filename, magnet: magnetURI });
    mainWindow.webContents.send('file-published', { name: filename, magnet: magnetURI });
    console.log(`📢 Pubblicato: ${filename} -> ${magnetURI}`);
}

// Cercare file nella rete P2P
ipcMain.on('search-files', () => {
    if (!user || !user.is) {
        mainWindow.webContents.send('log-message', `❌ Effettua il login per cercare file.`);
        return;
    }
    console.log('🔍 Cercando file associati all'utente...');
    user.get('p2p-files').map().once((file, key) => {
        if (file) {
            console.log(`🔍 File trovato: ${file.name} (${key})`);
            mainWindow.webContents.send('file-found', file);
        } else {
            console.log('⚠️ Nessun file trovato.');
        }
    });
});

// Scaricare un file da WebTorrent
ipcMain.on('download-file', (event, magnetURI) => {
    if (activeTorrents.has(magnetURI)) {
        mainWindow.webContents.send('log-message', `⚠️ Torrent già in download: ${magnetURI}`);
        return;
    }
    activeTorrents.add(magnetURI);

    client.add(magnetURI, (torrent) => {
        mainWindow.webContents.send('log-message', `⬇️ Download iniziato: ${torrent.name}`);

        torrent.files.forEach((file) => {
            const downloadPath = path.join(app.getPath('downloads'), file.name);
            file.getBuffer((err, buffer) => {
                if (err) {
                    console.error(`❌ Errore durante il download del file: ${file.name}`, err);
                    mainWindow.webContents.send('log-message', `❌ Errore durante il download del file: ${file.name}`);
                    return;
                }
                fs.writeFileSync(downloadPath, buffer);
                mainWindow.webContents.send('file-downloaded', { name: file.name, path: downloadPath });
                mainWindow.webContents.send('log-message', `✅ File scaricato: ${downloadPath}`);
            });
        });

        torrent.on('done', () => {
            console.log(`✅ Download completato: ${torrent.name}`);
            mainWindow.webContents.send('log-message', `✅ Download completato: ${torrent.name}`);
            activeTorrents.delete(magnetURI);
        });

        torrent.on('error', (err) => {
            console.error(`❌ Errore nel torrent: ${err.message}`);
            mainWindow.webContents.send('log-message', `❌ Errore nel torrent: ${err.message}`);
            activeTorrents.delete(magnetURI);
        });
    });
});

// Seeding: pacchettizzazione e upload del file
ipcMain.on('seed-file', (event, filePath) => {
    if (activeTorrents.has(filePath)) {
        mainWindow.webContents.send('log-message', `⚠️ Torrent già in seeding: ${filePath}`);
        return;
    }
    activeTorrents.add(filePath);

    client.seed(filePath, (torrent) => {
        const magnetURI = torrent.magnetURI;
        if (!activeTorrents.has(filePath)) {
            mainWindow.webContents.send('log-message', `❌ Questo file è già in seeding.`);
            return;
        }
        mainWindow.webContents.send('log-message', `🚀 Seeding iniziato: ${filePath}`);
        mainWindow.webContents.send('log-message', `🔗 Magnet Link: ${magnetURI}`);
        publishFile(filePath, magnetURI);
        activeTorrents.delete(filePath);
    });
});

// Funzione per copiare negli appunti
ipcMain.on('copy-to-clipboard', (event, text) => {
    require('electron').clipboard.writeText(text);
    mainWindow.webContents.send('log-message', `📋 Copiato negli appunti: ${text}`);
});

// Gestione dei file scaricati
ipcMain.on('get-downloaded-files', () => {
    const downloadDir = app.getPath('downloads');
    fs.readdir(downloadDir, (err, files) => {
        if (err) {
            mainWindow.webContents.send('log-message', `❌ Errore nella lettura dei file scaricati: ${err.message}`);
            return;
        }
        const downloadedFiles = files.map(file => ({ name: file, path: path.join(downloadDir, file) }));
        mainWindow.webContents.send('downloaded-files', downloadedFiles);
    });
});
