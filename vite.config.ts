import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `--mode https` serves over self-signed HTTPS on the LAN so the
// Geolocation API works when testing from a phone (it requires a secure context).
export default defineConfig(({ mode }) => {
  const https = mode === 'https';
  return {
    plugins: [react(), ...(https ? [basicSsl()] : [])],
    server: { host: https ? true : undefined },
    preview: { host: https ? true : undefined },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
