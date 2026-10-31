import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // The server's .env in the repository root: proxy to its port.
  const env = loadEnv(mode, '..', '')
  const target = `http://127.0.0.1:${env.PORT || 8787}`
  return {
    plugins: [vue()],
    server: { proxy: { '/api': target } },
  }
})
