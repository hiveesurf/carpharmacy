import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project site lives under /carnalysys/; local dev uses / so
// `public/` files resolve at /images/... (not /carnalysys/images/...).
// Use `mode` (not `command`) so production bundles always get the subpath base.
// https://vite.dev/config/shared-options.html#base
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Browser uses `/api/v1/...`; Vite proxies `/api` to Spring Boot (default :8080).
  const devApiProxy = env.VITE_DEV_API_PROXY?.trim() || 'http://127.0.0.1:8080'
  const configuredBase = env.VITE_BASE_PATH?.trim()
  const base = configuredBase || (mode === 'production' ? '/carnalysys/' : '/')

  return {
    base,
    plugins: [
      tailwindcss(),
      react(),
      {
        name: 'html-build-stamp',
        transformIndexHtml(html) {
          const stamp = new Date().toISOString()
          return html.replace('<head>', `<head>\n    <!-- build ${stamp} -->`)
        },
      },
      VitePWA({
        registerType: 'prompt',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        injectRegister: false,
        includeAssets: [
          'logo-carnalysys.png',
          'offline.html',
          'icons/pwa-192x192.png',
          'icons/pwa-512x512.png',
          'icons/pwa-512x512-maskable.png',
          'icons/apple-touch-icon.png',
        ],
        manifest: {
          name: 'CarPharmacy — Car Parts & Fitment',
          short_name: 'CarPharmacy',
          description:
            'Genuine automotive parts, assured delivery, and OEM brands from CarPharmacy.',
          theme_color: '#ff6b35',
          background_color: '#eef1f4',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'icons/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icons/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icons/pwa-512x512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          globIgnores: [
            '**/images/**',
            '**/mock-api/**',
            '**/assets/hero-cars.png',
            '**/sw-push.js',
          ],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    build: {
      // Smaller deploys; enable temporarily if debugging prod builds
      sourcemap: false,
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('@lottiefiles')) return 'lottie'
            if (id.includes('framer-motion')) return 'motion'
            if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) {
              return 'react-vendor'
            }
          },
        },
      },
    },
    server: {
      // Avoid clashing with other Vite apps on 5173 / 5180
      port: 5199,
      strictPort: false,
      // Listen on IPv4; Node on some macOS setups only binds [::1], which breaks
      // "localhost" when the browser uses 127.0.0.1 (ERR_CONNECTION_REFUSED).
      host: true,
      proxy: {
        '/api': {
          target: devApiProxy,
          changeOrigin: true,
          // Avoid 502 when Spring is slow to answer (cold JVM / first DB hits)
          timeout: 120_000,
          proxyTimeout: 120_000,
        },
      },
    },
  }
})
