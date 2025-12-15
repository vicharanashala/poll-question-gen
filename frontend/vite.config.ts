/// <reference types="vite/client" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import comlink from "vite-plugin-comlink";
import { VitePWA } from "vite-plugin-pwa";
import type { VitePWAOptions } from "vite-plugin-pwa";

const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: [
    'favicon.ico',
    'apple-touch-icon.png',
    'pwa-64-64.png',
    'pwa-192-192.png',
    'pwa-512-512.png',
    'maskable-icon-512-512.png',
    'robots.txt'
  ],
  devOptions: {
    enabled: false, // Disable in development to prevent caching issues
    type: 'module',
    navigateFallback: 'index.html',
  },
  manifest: {
    name: 'Spandan',
    short_name: 'Spandan',
    description: 'An interactive poll question generator for teachers',
    theme_color: '#000000',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    scope: '/',
    icons: [
      {
        src: '/pwa-64-64.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: '/pwa-192-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/maskable-icon-512-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },

  strategies: 'generateSW',
  workbox: {
    globDirectory: 'dist',
    globPatterns: [
      '**/*.{js,css,html,ico,png,jpg,jpeg,svg,gif,webp,avif,woff,woff2,ttf,eot,json,wasm,bin}',
    ],
    maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
    cleanupOutdatedCaches: true,
    skipWaiting: true,
    clientsClaim: true,
    
    // Navigation fallback - serve index.html for all routes
    navigateFallback: '/index.html',
   navigateFallbackAllowlist: [/^(?!.*\/api).*/],
    navigateFallbackDenylist: [/^\/api\//, /\.[^\/]+$/, /\/sitemap\.xml$/, /\/robots\.txt$/],
    
    // Cache the Google Fonts stylesheets with a stale-while-revalidate strategy
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          },
          cacheableResponse: {
            statuses: [0, 200], // For opaque responses
          },
        },
      },
      // Cache other external resources
      {
        urlPattern: /^https?:\/\/.*\.(png|jpg|jpeg|svg|gif|webp|avif|woff|woff2|ttf|eot)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'external-assets',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // Cache API responses with NetworkFirst strategy
      {
        urlPattern: /^https?:\/\/api\.example\.com\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
          },
          networkTimeoutSeconds: 5,
          cacheableResponse: {
            statuses: [200],
          },
        },
      },
      // Cache HTML documents with NetworkFirst strategy
      {
        urlPattern: /\.html$/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'html-cache',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
          networkTimeoutSeconds: 3,
        },
      },
      // Cache navigation requests with NetworkFirst strategy
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
          networkTimeoutSeconds: 3,
        },
      },
      // Cache static assets with CacheFirst strategy
      {
        urlPattern: /\.(?:js|css|woff|woff2|ttf|eot)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-resources',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          },
        },
      },
      {
        // Cache images
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 90 * 24 * 60 * 60,
          },
        },
      },
      {
        // Cache API calls
        urlPattern: /\/api\/.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60,
          },
          networkTimeoutSeconds: 5,
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache external resources
        urlPattern: /^https:\/\/(fonts|cdn|unpkg)\.(googleapis|cloudflare|com)\/.*/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'external-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],

  },
};

export default defineConfig(({ }) => {
  
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: false,
    },

    plugins: [
      react(),
      VitePWA(pwaOptions),
      comlink()
    ],

    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },

    assetsInclude: ["**/*.wasm", "**/*.ggml", "**/*.bin"],

    optimizeDeps: {
      exclude: [
        "@transcribe/transcriber",
        "@transcribe/shout",
      ],
    },

    worker: {
      format: "es",
      rollupOptions: {
        output: {
          inlineDynamicImports: false,
          entryFileNames: "worker/[name]-[hash].js",
          chunkFileNames: "worker/[name]-[hash].js",
          assetFileNames: "worker/[name]-[hash].[ext]"
        }
      },
    },
    
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('@radix-ui') || id.includes('@headlessui')) {
                return 'ui';
              }
              if (id.includes('firebase')) {
                return 'firebase';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'vendor';
              }
              return 'vendor';
            }
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash][extname]'
        },
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return;
          }
          warn(warning);
        }
      },
      commonjsOptions: {
        transformMixedEsModules: true
      }
    },
    
    define: {
      'process.env': {}
    }
  };
});