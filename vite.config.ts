import path from 'node:path'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  root: 'dash',
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./dash")
    }
  }
})
