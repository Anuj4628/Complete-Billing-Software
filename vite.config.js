import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

function apiBridgePlugin() {
  let dispatch
  return {
    name: 'api-bridge-plugin',
    configureServer(server) {
      server.middlewares.use('/__api/invoke', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }))
          return
        }
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', async () => {
          try {
            if (!dispatch) {
              const bridge = await import('./electron/serverBridge.js')
              dispatch = bridge.dispatch || bridge.default?.dispatch
            }
            const { channel, data } = JSON.parse(body || '{}')
            const result = await dispatch(channel, data)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), apiBridgePlugin()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-renderer': ['@react-pdf/renderer'],
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: { port: 5173 },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.ico'],
})
