import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Il sito è pubblicato alla radice del dominio: https://sbeggio.app/
const BASE = '/';

/**
 * vite-plugin-pwa inserisce il link al manifest in ogni pagina: web.sbeggio.app non è un'app
 * installabile, quindi da web.html lo togliamo (gira dopo il plugin, che è anch'esso "post").
 */
function sitoSenzaManifest(): Plugin {
  return {
    name: 'sito-senza-manifest',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler: (html, ctx) => (ctx.path === '/web.html' ? html.replace(/<link rel="manifest"[^>]*>\s*/, '') : html),
    },
  };
}

export default defineConfig(({ mode }) => {
  // `vite build --mode android`: build per l'app Android (Capacitor), senza service worker.
  const android = mode === 'android';
  return {
    base: android ? './' : BASE,
    define: {
      __VERSIONE_APP__: JSON.stringify(pkg.version),
    },
    build: {
      rollupOptions: {
        // web.html è il sito web.sbeggio.app; l'app Android non lo include. Il nome "sito" dà ai suoi file
        // assets/sito-*: "web" si confonderebbe con i web.js delle librerie (es. @capacitor/local-notifications).
        input: (android ? { index: 'index.html' } : { index: 'index.html', sito: 'web.html' }) as Record<string, string>,
      },
    },
    plugins: [
      VitePWA({
        disable: android,
        // Service worker nostro (src/sw.ts): precache come prima, più le notifiche degli avvisi.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          id: BASE,
          name: 'Sbeggio',
          short_name: 'Sbeggio',
          description: 'Registra le timbrature di lavoro e calcola l\'ora di uscita.',
          lang: 'it',
          dir: 'ltr',
          start_url: BASE,
          scope: BASE,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f2f2f7',
          theme_color: '#249a4c',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          // Il sito web.sbeggio.app non serve alla PWA.
          globIgnores: ['web.html', 'assets/sito-*.js', 'assets/sito-*.css'],
        },
      }),
      sitoSenzaManifest(),
    ],
    test: { include: ['tests/**/*.test.ts'] },
  };
});
