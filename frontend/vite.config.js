import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { SPA_FALLBACK_PATHS } from './spaPaths.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function spaNestedHtmlPlugin() {
  return {
    name: 'spa-nested-html',
    closeBundle() {
      const root = resolve(__dirname, 'dist')
      const indexHtml = resolve(root, 'index.html')
      for (const pathname of SPA_FALLBACK_PATHS) {
        const segment = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
        if (!segment) continue
        const dir = resolve(root, segment)
        mkdirSync(dir, { recursive: true })
        copyFileSync(indexHtml, resolve(dir, 'index.html'))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), spaNestedHtmlPlugin()],
})
