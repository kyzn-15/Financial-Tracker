import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const apiUrl = loadEnv(mode, process.cwd(), '').VITE_API_URL?.trim()
  if (!apiUrl) throw new Error('VITE_API_URL must be configured')

  let api
  try {
    api = new URL(apiUrl)
  } catch {
    if (mode === 'development' || !apiUrl.startsWith('/')) {
      throw new Error(`${mode} VITE_API_URL is invalid`)
    }
  }

  const isLoopback = api && ['localhost', '127.0.0.1', '::1'].includes(api.hostname)
  if (mode === 'development' && !isLoopback) {
      throw new Error('Development VITE_API_URL must point to a loopback API')
  }
  if (mode === 'production' && api && (api.protocol !== 'https:' || isLoopback)) {
    throw new Error('Production VITE_API_URL must use HTTPS and cannot be loopback')
  }

  return { plugins: [react()] }
})
