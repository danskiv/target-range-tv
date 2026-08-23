# ADR-004 — Renderer PixiJS (WebGL2 + Fallback Canvas 2D)

## Status
**ACCEPTED** (v2.0.0-draft — 2026-08-23)

## Konteks
v1 memakai Canvas 2D vanilla (`engine.js`). v2 menuntut visual modern (glow, bloom, partikel, additive blending) yang mahal di Canvas 2D pada TV berdaya rendah (MiTV 720p, 1–2 GB RAM). Di sisi lain, TV bisa saja tidak punya WebGL2 (WebView tua).

## Keputusan
1. **PixiJS v8** sebagai renderer utama — WebGL2 otomatis dengan **fallback WebGL1 → Canvas 2D** (`autoDetectRenderer`), satu API untuk semua jalur.
2. Struktur scene: `Container` root → layer (background grid, target layer, partikel layer, HUD). Partikel memakai **additive blending** + object pool (bukan create/destroy tiap frame).
3. **Glow/Bloom** via filter PixiJS pada node tertentu, bukan CSS filter (CSS filter mahal & lambat di TV).
4. UI overlay tetap DOM (HUD, lobby) — teks DOM lebih tajam & mudah distyle; canvas khusus untuk arena/efek.

## Konsekuensi
- **Positif**: visual konsisten 60 FPS di 720p; kode modular; komunitas besar.
- **Negatif**: dependensi eksternal (~450 KB min) — wajib di-cache dengan cache-bust; fallback Canvas 2D tetap disediakan jika WebGL gagal init.
- **Risiko TV**: MiTV WebView (Android 9+) mendukung WebGL2 — terverifikasi saat implementasi; jika tidak, fallback otomatis.
