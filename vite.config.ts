import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  /**
   * GitHub Pages serves a project site from a subdirectory, so every asset URL
   * has to carry the repository name. Keyed on the mode rather than on a CI
   * variable so that any production build is the same deployable output
   * wherever it runs — and on the mode rather than the command so that
   * `vite preview` serves it at the path it was built for. The dev server is
   * `development` and stays at the root.
   */
  base: mode === 'production' ? '/aura-battle/' : '/',
  plugins: [react()],
  server: {
    host: true,
    // ngrok fronts the dev server with a hostname Vite does not know, and it
    // refuses unknown Host headers by default.
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok-free.dev'],
    /**
     * Through a tunnel the page arrives over TLS on 443 while the dev server
     * listens on 5199, so Vite cannot work out where to put its hot-reload
     * socket and falls back to a direct `ws://localhost:5199`.
     *
     * That is a public page reaching for a private address, and Android Chrome
     * stops and asks whether the site may "access other apps and services on
     * this device". Pointing the socket back through the tunnel removes both
     * the fallback and the prompt. Only when tunnelling: on the local network
     * the default is already right.
     */
    ...(process.env.TUNNEL ? { hmr: { protocol: 'wss' as const, clientPort: 443 } } : {}),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
