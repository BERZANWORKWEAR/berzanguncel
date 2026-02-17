# BERZAN — Vanilla + Modern Build Layer (Vite)

Amaç: mevcut HTML/CSS/JS sayfalarını aynen tutup sadece build/pipeline eklemek.
- Hash'li dosya isimleri (cache-safe)
- Multi-page build
- `public/` dosyaları olduğu gibi kopyalanır (CNAME, robots, sitemap, manifest, config.js, ikonlar)

## Kurulum
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

Çıktı: `dist/`

## Runtime config
`public/config.js` canlıda değiştirilebilir (webhook / supabase anahtarları). Build'e gömülmez.
