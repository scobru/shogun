const Gun = require('gun');
const WebTorrent = require('webtorrent');
const fs = require('fs');
const { app, BrowserWindow, ipcMain } = require('electron');

const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']); // Peer relay
const client = new WebTorrent();

let mainWindow;

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disk-cache-size', '0');

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
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
    client.add(magnetURI, (torrent) => {
        console.log(`⬇️ Download iniziato: ${torrent.name}`);
        
        torrent.files.forEach((file) => {
            file.getBuffer((err, buffer) => {
                if (err) throw err;
                fs.writeFileSync(file.name, buffer);
                mainWindow.webContents.send('file-downloaded', file.name);
                console.log(`✅ File scaricato: ${file.name}`);
            });
        });
    });
});

// Seeding: pacchettizzazione e upload del file
ipcMain.on('seed-file', (event, filePath) => {
    client.seed(filePath, (torrent) => {
        const magnetURI = torrent.magnetURI;
        console.log(`🚀 Seeding iniziato: ${filePath}`);
        console.log(`🔗 Magnet Link: ${magnetURI}`);
        publishFile(filePath, magnetURI);
    });
});
