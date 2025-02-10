const Gun = require('gun');
const WebTorrent = require('webtorrent');
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']); // Peer relay
const client = new WebTorrent();
const activeTorrents = new Set(); // Per tracciare torrent attivi

let mainWindow;

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

// Pubblicare un file sulla rete P2P
function publishFile(filename, magnetURI) {
    gun.get('p2p-files').set({ name: filename, magnet: magnetURI });
    mainWindow.webContents.send('file-published', { name: filename, magnet: magnetURI });
    console.log(`📢 Pubblicato: ${filename} -> ${magnetURI}`);
}

// Cercare file nella rete P2P
ipcMain.on('search-files', () => {
    gun.get('p2p-files').map().once((file) => {
        if (file) mainWindow.webContents.send('file-found', file);
    });
});

// Scaricare un file da WebTorrent
ipcMain.on('download-file', (event, magnetURI) => {
    if (activeTorrents.has(magnetURI)) {
        console.log(`⚠️ Torrent già in download: ${magnetURI}`);
        return;
    }
    activeTorrents.add(magnetURI);

    client.add(magnetURI, (torrent) => {
        console.log(`⬇️ Download iniziato: ${torrent.name}`);

        torrent.files.forEach((file) => {
            const downloadPath = path.join(app.getPath('downloads'), file.name);
            file.getBuffer((err, buffer) => {
                if (err) throw err;
                fs.writeFileSync(downloadPath, buffer);
                mainWindow.webContents.send('file-downloaded', downloadPath);
                console.log(`✅ File scaricato: ${downloadPath}`);
            });
        });

        torrent.on('done', () => {
            console.log(`✅ Download completato: ${torrent.name}`);
            activeTorrents.delete(magnetURI);
        });
    });
});

// Seeding: pacchettizzazione e upload del file
ipcMain.on('seed-file', (event, filePath) => {
    if (activeTorrents.has(filePath)) {
        console.log(`⚠️ Torrent già in seeding: ${filePath}`);
        return;
    }
    activeTorrents.add(filePath);

    client.seed(filePath, (torrent) => {
        const magnetURI = torrent.magnetURI;
        console.log(`🚀 Seeding iniziato: ${filePath}`);
        console.log(`🔗 Magnet Link: ${magnetURI}`);
        publishFile(filePath, magnetURI);
        activeTorrents.delete(filePath);
    });
});

// Funzione per copiare negli appunti
ipcMain.on('copy-to-clipboard', (event, text) => {
    require('electron').clipboard.writeText(text);
    console.log(`📋 Copiato negli appunti: ${text}`);
});
