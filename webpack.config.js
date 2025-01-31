const path = require('path');

module.exports = {
  // ... altre configurazioni ...

  resolve: {
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
    }
  }
}; 