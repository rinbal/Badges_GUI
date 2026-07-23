import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'

// Version + commit for the app footer. Read from git tags (the GitHub releases)
// at build time. Falls back gracefully when git is unavailable (e.g. a shallow
// CI checkout), in which case the footer resolves the version from the GitHub
// Releases API at runtime instead.
function gitInfo() {
  let version = ''
  let commit = ''
  try {
    version = execSync('git describe --tags --abbrev=0').toString().trim()
  } catch { /* no tags in this checkout */ }
  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim()
  } catch { /* not a git checkout */ }
  if (!commit && process.env.COMMIT_REF) commit = process.env.COMMIT_REF.slice(0, 7)
  return { version, commit }
}

const { version: APP_VERSION, commit: APP_COMMIT } = gitInfo()

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_COMMIT__: JSON.stringify(APP_COMMIT)
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'BadgeBox_ohne_bg.png',
        'BadgeBox_.png',
        'vite.svg'
      ],
      manifest: {
        name: 'BadgeBox',
        short_name: 'BadgeBox',
        description: 'Create, issue, request and collect badges on the Nostr decentralized network.',
        theme_color: '#0d0d12',
        background_color: '#0d0d12',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icons/icon-180x180.png',
            sizes: '180x180',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'glyph-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})

