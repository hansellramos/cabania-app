import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
  },
  build: {
    // Only generated when they can be uploaded to PostHog; scripts/sourcemaps.mjs
    // deletes them from dist afterwards.
    sourcemap: process.env.POSTHOG_CLI_TOKEN ? 'hidden' : false,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
