# CODING STANDARD — Range Shooter

Gaya kode wajib untuk semua kontribusi. Pelanggaran = ditolak di review.

## Bahasa
- **Kode, commit, dokumentasi teknis**: English.
- **UI TV, pesan error user**: Bahasa Indonesia (v1) — v2 announcer **English** (keputusan final PRD).
- Identifiers, variabel, fungsi, kelas: English.

## Python (server/)
- Target: Python 3.11+.
- Type hints WAJIB pada fungsi publik.
- `async def` untuk semua endpoint & handler WebSocket.
- Naming: `snake_case`, konstanta `UPPER_CASE`.
- String concat → f-strings.
- Error handling: try/except spesifik, jangan `except Exception` kosong.

## JavaScript (tv/, tv-v2/)
- Vanilla JS / PixiJS — **DILARANG framework berat** (React/Vue) di TV (batasan CPU TV).
- `const`/`let` (bukan `var`), semicolon WAJIB, 2-space indent.
- Class untuk komponen (GameEngine, ParticlePool, AudioEngine).
- Global scope: batasi — maksimal 1 global per file (`window.gameEngine`, dll).
- Event listener lewat method terikat (arrow/bind) agar mudah dibersihkan.

## Java (android-controller-app/, android-tv-app/)
- Java 8 compatible (build manual aapt/dx, tanpa Gradle).
- Naming: `camelCase` method/variabel, `UpperCamelCase` kelas, `UPPER_SNAKE` konstanta.
- Semua state UI di-thread utama; jaringan di executor terpisah.
- **WAJIB**: action executor terpisah dari aim loop (lihat AUDIT_LOG — pelajaran v1).
- `SharedPreferences` untuk persisten (kalibrasi).

## Aturan Domain (wajib)
1. **Skor integer murni** — dilarang float untuk poin/uang.
2. **Koordinat normalized 0..1** untuk posisi bidik & kalibrasi.
3. **Throttle** pengiriman sensor ≤60 Hz.
4. **Idempotensi** aksi (fire/calib) — guard double-click.
5. **Cache-bust `?v=`** pada setiap asset JS/CSS yang berubah.
6. **Responsive layout** — dilarang hardcode resolusi pixel.

## Commit
- Satu commit = satu perubahan logis (menyentuh semua dokumen terkait).
- Format: `type(scope): subject` — `fix`, `feat`, `docs`, `chore`, `test`, `refactor`.
- Wajib push ke GitHub `main` setelah sukses (repo public).
