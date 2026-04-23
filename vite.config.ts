import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'CareXAI',
          short_name: 'CareXAI',
          description: 'Real-time AI-powered telehealth platform',
          theme_color: '#e11d48',
          background_color: '#ffffff',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          display_override: ['standalone', 'window-controls-overlay'],
          icons: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-256x256.png', sizes: '256x256', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: {
          navigateFallback: '/index.html',
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/socket.io/'),
              handler: 'NetworkOnly' // never cache websocket endpoints
            }
          ]
        },
        devOptions: {
          enabled: true
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    build: {
      // Agora SDK is distributed as a large monolithic bundle; keep warnings for anything bigger.
      chunkSizeWarningLimit: 1400,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            if (id.includes('react-dom') || id.includes('react')) {
              return 'react-vendor';
            }

            if (id.includes('framer-motion')) {
              return 'motion-vendor';
            }

            if (id.includes('@react-three') || id.includes('three')) {
              return 'three-vendor';
            }

            if (id.includes('recharts') || id.includes('d3-')) {
              return 'charts-vendor';
            }

            if (id.includes('agora-rtc-sdk-ng')) {
              return 'agora-vendor';
            }

            if (id.includes('socket.io-client') || id.includes('engine.io-client')) {
              return 'socket-vendor';
            }

            if (id.includes('@google/genai')) {
              return 'ai-vendor';
            }

            return 'vendor';
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
