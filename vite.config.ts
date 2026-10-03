import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// `--mode https` serves over self-signed HTTPS on the LAN so the
// Geolocation API works when testing from a phone (it requires a secure context).
export default defineConfig(({ mode }) => {
  const https = mode === 'https';
  return {
    plugins: [
      react(), 
      ...(https ? [basicSsl()] : []),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'GPS Speed Tracker',
          short_name: 'Speed Tracker',
          description: 'A modern, private GPS tracking app.',
          theme_color: '#05070b',
          background_color: '#05070b',
          display: 'standalone',
          icons: [
            {
              src: 'favicon.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        }
      })
    ],
    server: { host: https ? true : undefined },
    preview: { host: https ? true : undefined },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
