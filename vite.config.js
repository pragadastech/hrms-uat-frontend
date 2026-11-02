import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_BASE_URL || 'http://localhost:8081/api'
  const proxyTarget = apiBase.replace(/\/api\/?$/, '') || 'http://localhost:8081'

  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      target: ['es2015', 'safari12'],
      minify: 'esbuild',
    },
    // Do not hard-override VITE_API_BASE_URL — let Vite load it from .env
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
      exclude: ['xlsx-js-style'],
    },
  }
})
