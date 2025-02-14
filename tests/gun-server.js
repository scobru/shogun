const Gun = require('gun');
require('gun/sea');

const port = 8765;

// Crea il server HTTP
const server = require('http').createServer();

console.log("Initializing Gun server...");

// Inizializza Gun con configurazione minima
const gun = Gun({
  web: server,
  file: './radata',
  radisk: true,
  multicast: false,
  axe: false
});

let serverReady = false;

server.listen(port, () => {
  console.log(`Gun server running on port ${port}`);
  serverReady = true;
});

gun.on('hi', peer => {
  console.log('Peer connected:', peer);
});

gun.on('bye', peer => {
  console.log('Peer disconnected:', peer);
});

// Gestione errori del server
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Gestione errori di Gun
gun.on('error', (error) => {
  console.error('Gun error:', error);
});

// Esporta sia gun che lo stato del server
module.exports = {
  gun,
  isReady: () => serverReady
};

// Pulizia delle risorse alla chiusura
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed successfully');
    process.exit(0);
  });
}); 