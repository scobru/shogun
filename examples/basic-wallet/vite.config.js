import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@hugo': resolve(__dirname, '../../src')
    }
  },
  optimizeDeps: {
    include: ['gun', 'ethers']
  },
  build: {
    commonjsOptions: {
      include: [/gun/, /node_modules/],
      transformMixedEsModules: true
    }
  },
  esbuild: {
    target: 'esnext'
  }
}); 