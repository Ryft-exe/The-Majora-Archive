import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const appData = process.env.APPDATA || path.join(os.homedir(), '.config')
const coverDirs = ['Majora Archive', 'Taelight', 'Hyrule Archive'].map((name) => path.join(appData, name, 'covers'))
const coverTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

function coverCache(): Plugin {
  return {
    name: 'majora-cover-cache',
    configureServer(server) {
      server.middlewares.use('/covers', (request, response, next) => {
        try {
          const raw = decodeURIComponent((request.url || '').split('?')[0] || '')
          const name = path.basename(raw)
          const file = coverDirs
            .map((dir) => path.join(dir, name))
            .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
          if (!file) {
            next()
            return
          }
          const extension = path.extname(file).toLowerCase()
          response.setHeader('Content-Type', coverTypes[extension] || 'application/octet-stream')
          response.setHeader('Cache-Control', 'no-cache')
          fs.createReadStream(file).pipe(response)
        } catch {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), coverCache()],
  base: './',
  server: { port: 5273, strictPort: true, host: '127.0.0.1' },
  build: { outDir: 'dist', emptyOutDir: true },
})
