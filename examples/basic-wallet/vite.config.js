import { defineConfig } from 'vite';

export default defineConfig({
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