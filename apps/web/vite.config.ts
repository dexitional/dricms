import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    warmup: { clientFiles: ['./src/routes/admin/**/*.tsx', './src/components/**/*.tsx'] },
  },
  plugins: [nitro(), tailwindcss(), tanstackStart(), viteReact()],
})
