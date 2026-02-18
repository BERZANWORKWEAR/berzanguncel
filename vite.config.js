import { defineConfig } from 'vite';
import { resolve } from 'path';

const pages = [
  'index.html',
  'magaza/index.html',
  'urun/index.html',
  'urunler/index.html',
  'uzman/index.html',
  'iletisim/index.html',
  'tesekkurler/index.html',
  'kvkk/index.html',
  'cerez-politikasi/index.html',
];

export default defineConfig({
  base: '/',
  build: {
    target: 'esnext',
    cssTarget: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(pages.map(p => [p.replace('.html',''), resolve(__dirname, p)])),
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (!name) return 'assets/[name]-[hash][extname]';
          if (name.endsWith('.css')) return 'assets/css/[name]-[hash][extname]';
          if (/(png|jpe?g|webp|svg|gif)$/i.test(name)) return 'assets/img/[name]-[hash][extname]';
          if (/(woff2?|ttf|otf|eot)$/i.test(name)) return 'assets/fonts/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  server: { open: true }
});
