# FABARO Radio Online

Aplikasi radio streaming dunia (Next.js + Tailwind + HLS). Fitur:
- Cari stasiun berdasarkan nama, negara, genre (preset)
- Pemutar dengan dukungan HLS (.m3u8) & auto-retry
- Favorit (localStorage)
- Sleep timer
- PWA manifest (installable)
- API proxy opsional untuk atasi CORS (`/api/proxy`)

## Jalankan
```bash
npm i
npm run dev
```

Buka http://localhost:3000

## Catatan
- Sumber data: Radio Browser API (komunitas).
- Pastikan mematuhi lisensi & kebijakan tiap stasiun.

## Build APK (opsional) dengan Capacitor
1. Build Next.js jadi static output:
   ```bash
   npm run build
   npx next export
   ```
   Ini akan membuat folder `out/`.
2. Tambah Capacitor & Android platform:
   ```bash
   npm i @capacitor/core
   npm i -D @capacitor/cli
   npx cap init
   npx cap add android
   npx cap copy
   npx cap open android
   ```
3. Buka Android Studio, **Run** atau **Build > Generate Signed APK**.
4. Jika memakai stream CORS ketat, gunakan pemutar dengan proxy `/api/proxy` atau set `server.url` di Capacitor bila perlu.

## Now Playing
Endpoint `/api/nowplaying?url=...` mencoba membaca metadata ICY (StreamTitle). Tidak semua stasiun menyalurkan metadata; jika kosong berarti tidak tersedia.
