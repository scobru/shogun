const Gun = require('gun');
require('gun/sea');

const port = 8765;

const server = require('http').createServer().listen(port);
const gun = Gun({
  web: server,
  file: 'radata_test',
  radisk: false,
  localStorage: false,
  multicast: false
});

console.log(`Gun server running on port ${port}`);

// Pulizia del database al riavvio
gun.get('users').put(null);
gun.get('profiles').put(null);
gun.get('wallets').put(null);

process.on('SIGINT', () => {
  console.log('Shutting down Gun server...');
  server.close(() => {
    process.exit(0);
  });
}); 