import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  let wsOrHmrDisabled = false;
  return {
    plugins: [
      {
        name: 'disable-hmr-client-ws',
        apply: 'serve',
        configResolved(resolved) {
          wsOrHmrDisabled =
            resolved.server.hmr === false || resolved.server.ws === false;
        },
        transform(code, id) {
          if (
            wsOrHmrDisabled &&
            id.includes('vite/dist/client/client.mjs')
          ) {
            return code
              .replace(
                'let isConnected = !invokeableTransport.connect;',
                'let isConnected = true;'
              )
              .replaceAll(
                'await wsTransport.connect(handlers);',
                'return; /* HMR WebSocket disabled */'
              )
              .replaceAll('await wsTransport.disconnect();', 'return;')
              .replaceAll('wsTransport.send(data);', 'return;');
          }
          return null;
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.json',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-192x192.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'PDFExpress — Outils PDF Gratuits',
          short_name: 'PDFExpress',
          description:
            'Suite complète d’outils PDF gratuits dans votre navigateur : fusionner, diviser, compresser, convertir, signer et modifier même hors ligne.',
          theme_color: '#E5322D',
          background_color: '#F5F6FA',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
          orientation: 'any',
          start_url: '/?source=pwa',
          scope: '/',
          dir: 'ltr',
          lang: 'fr',
          prefer_related_applications: false,
          categories: ['productivity', 'utilities', 'business'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Fusionner PDF',
              short_name: 'Fusionner',
              description: 'Combiner plusieurs fichiers PDF en un seul document',
              url: '/?tool=merge',
              icons: [
                {
                  src: '/pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Compresser PDF',
              short_name: 'Compresser',
              description: 'Réduire le poids d’un PDF tout en gardant la qualité',
              url: '/?tool=compress',
              icons: [
                {
                  src: '/pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Diviser PDF',
              short_name: 'Diviser',
              description: 'Séparer ou extraire des pages d’un document PDF',
              url: '/?tool=split',
              icons: [
                {
                  src: '/pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Signer PDF',
              short_name: 'Signer',
              description: 'Apposer une signature manuscrite sur un PDF',
              url: '/?tool=sign',
              icons: [
                {
                  src: '/pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigationPreload: false,
          globPatterns: [
            '**/*.{js,css,html,ico,png,svg,woff,woff2,mjs,wasm}',
          ],
          globIgnores: ['**/assets/aistudio/**', '**/ads.txt'],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/ads\.txt(?:\?.*)?$/i,
            /^\/sitemap\.xml(?:\?.*)?$/i,
            /^\/robots\.txt(?:\?.*)?$/i,
          ],
          ignoreURLParametersMatching: [/^tool$/, /^source$/, /^utm_/],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.origin === self.location.origin &&
                (/^\/(?:ads\.txt|sw\.js|registerSW\.js|manifest\.json)$/i.test(
                  url.pathname
                )),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) =>
                url.origin === self.location.origin &&
                url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) =>
                url.origin === self.location.origin &&
                (/^\/assets\/(pdfjs-vendor|pdf-edit-vendor|pdf\.worker|firebase-vendor|ui-motion-vendor)/.test(
                  url.pathname
                ) ||
                  /\.(?:mjs|wasm)$/i.test(url.pathname)),
              handler: 'CacheFirst',
              options: {
                cacheName: 'pdf-ai-heavy-libs-cache',
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24 * 90,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|tessdata\.projectnaptha\.com)\/.*$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'ai-ocr-wasm-cdn-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 90,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: {
                  maxEntries: 12,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ request, url }) =>
                url.origin === self.location.origin &&
                request.destination === 'image',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'local-static-images',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ request, url }) =>
                url.origin === self.location.origin &&
                !url.pathname.startsWith('/@') &&
                !url.pathname.startsWith('/src/') &&
                !url.pathname.startsWith('/node_modules/') &&
                (request.destination === 'script' ||
                  request.destination === 'style' ||
                  request.destination === 'worker'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'app-runtime-assets',
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/pdfjs-dist')) {
              return 'pdfjs-vendor';
            }
            if (
              id.includes('node_modules/pdf-lib') ||
              id.includes('node_modules/jszip')
            ) {
              return 'pdf-edit-vendor';
            }
            if (
              id.includes('node_modules/firebase') ||
              id.includes('node_modules/@firebase')
            ) {
              return 'firebase-vendor';
            }
            if (
              id.includes('node_modules/motion') ||
              id.includes('node_modules/framer-motion') ||
              id.includes('node_modules/lucide-react')
            ) {
              return 'ui-motion-vendor';
            }
            if (id.includes('node_modules/@google/genai')) {
              return 'ai-vendor';
            }
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      ws:
        process.env.DISABLE_HMR === 'true'
          ? false
          : {
              protocol: 'wss',
              clientPort: 443,
            },
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
