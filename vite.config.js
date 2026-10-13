import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://pragva-hrms-backend.up.railway.app',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    target: ['es2015', 'safari12'],
    minify: 'esbuild'
  },
  define: {
    // Ensure environment variables are properly defined
    // eslint-disable-next-line no-undef
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || 'https://pragva-hrms-backend.up.railway.app/api')
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    exclude: ['xlsx-js-style']
  }
})
 
