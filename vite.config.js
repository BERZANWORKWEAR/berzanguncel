import { defineConfig } from 'vite';
import { resolve } from 'path';

// Multi-page build: existing HTML pages are entries.
const pages = [
  'index.html',
  'magaza.html',
  'urun.html',
  'uzman.html',
  'iletisim.html',
  'tesekkurler.html',
  'kvkk.html',
  'cerez-politikasi.html',
  'urunler.html',
];

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((p) => [p.replace('.html', ''), resolve(__dirname, p)])
      ),
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (!name) return 'assets/[name]-[hash][extname]';
          if (name.endsWith('.css')) return 'assets/css/[name]-[hash][extname]';
          if (/(png|jpe?g|webp|svg|gif)$/i.test(name)) return 'assets/img/[name]-[hash][extname]';
          if (/(woff2?|ttf|otf|eot)$/i.test(name)) return 'assets/fonts/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  server: { open: true },
});
