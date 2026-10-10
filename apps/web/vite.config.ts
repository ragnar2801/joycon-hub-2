import { fileURLToPath } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig, type Connect, type Plugin } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const apiTarget = process.env.API_TARGET ?? 'http://127.0.0.1:3000';

/** Serve the controller page for /c/<ROOM> (the URL inside the QR code). */
function controllerRoute(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    if (req.url && /^\/c(\/[^?]*)?(\?|$)/.test(req.url)) {
      const q = req.url.indexOf('?');
      req.url = '/controller.html' + (q >= 0 ? req.url.slice(q) : '');
    }
    next();
  };
  return {
    name: 'joyconhub-controller-route',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

// Phones only expose motion sensors to secure pages, so the dev server runs on HTTPS by default.
// Set VITE_HTTP=1 to disable (e.g. when a tunnel such as cloudflared provides HTTPS instead).
const https = !process.env.VITE_HTTP;

// Allow the tunnel hostname (e.g. *.trycloudflare.com) when PUBLIC_URL points at one.
const publicHost = process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).hostname : undefined;

export default defineConfig({
  root,
  plugins: [...(https ? [basicSsl()] : []), controllerRoute()],
  server: {
    host: true,
    port: Number(process.env.WEB_PORT ?? 5173),
    allowedHosts: publicHost ? [publicHost] : undefined,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/ws': { target: apiTarget.replace(/^http/, 'ws'), ws: true },
    },
  },
  preview: {
    host: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/ws': { target: apiTarget.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: `${root}index.html`,
        controller: `${root}controller.html`,
      },
    },
  },
});
