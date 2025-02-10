const Gun = require('gun')
require('gun/sea')

const port = 8765

const server = require('http').createServer().listen(port)
const gun = Gun({
  web: server,
  file: './tests/radata',  // Disabilitiamo il file storage per i test
  radisk: true, // Disabilitiamo radisk per i test
  axe: true // Disabilitiamo axe per ridurre la complessità

})

console.log(`Gun server running on port ${port}`)

// Pulizia delle risorse alla chiusura
process.on('SIGINT', async () => {
  console.log('Shutting down Gun server...')
  await new Promise(resolve => setTimeout(resolve, 1000)) // Attendiamo che le operazioni in corso terminino
  server.close(() => {
    console.log('Server closed successfully')
    process.exit(0)
  })
}) 