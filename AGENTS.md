# AGENTS.md — Range Shooter (sebelumnya Target Range TV)

Selamat datang, engineer/agent. Ini proyek **Range Shooter** — game menembak multi-layar bergenre **Neon Cyber Arena** (Android TV sebagai display + HP Android APK sebagai motion controller gyroscope). Proyek sedang dalam **v2.0.0-alpha**: membangun ulang dari v1 dengan renderer PixiJS/WebGL2.

## Aturan Dasar

1. **PRD-v2.md adalah sumber kebenaran tertinggi.** Baca `PRD-v2.md` (v2.0.0 APPROVED) dan `docs/CONVENTIONS.md` sebelum mengubah arsitektur/kode. Jangan pernah berasumsi — PRD bilang A, kode harus A.
2. **Baca `AUDIT_LOG.md` SEBELUM menyentuh kode** — 12 pelajaran v1 yang TIDAK BOLEH diulang (slot TV tunggal, hardcode resolusi, executor APK, cache WebView, AP isolation, dst).
3. **Input = APK native (ADR-003)**. Web controller telah DIGUGURKAN (sensor browser mati di HTTP LAN). Jangan menghidupkan kembali jalur web sensor.
4. **Renderer v2 = PixiJS (ADR-004)**, tema Neon Cyber Arena, layout WAJIB responsif (`100vw/100vh`), dilarang hardcode resolusi.
5. **Kalibrasi 5-titik affine + drift-damping (ADR-005)** — koordinat titik WAJIB sinkron TV ↔ APK (0.05/0.95).
6. **Satu slot TV per room** (`room.tv_socket`) — jangan pernah connect klien TV kedua (observer hanya untuk uji, matikan sebelum main).
7. **Cache-bust `?v=` + no-cache headers + badge versi** setiap asset statis berubah.
8. **Konsistensi adalah hukum**: satu commit = satu perubahan logis + dokumen terkait sinkron (CHANGELOG/AUDIT_LOG/API/PRD).

## Panduan Navigasi Dokumen

| # | Dokumen | Isi Utama | Kapan Dibaca |
|---|---|---|---|
| 1 | `PRD-v2.md` | **Sumber kebenaran v2** — mekanik, tema, arsitektur, keputusan final (APPROVED) | **Wajib — pertama kali** |
| 2 | `docs/CONVENTIONS.md` | SemVer, struktur direktori, disiplin rekayasa | **Wajib — kedua** |
| 3 | `AUDIT_LOG.md` | 12 temuan v1 + pelajaran abadi | **Wajib — sebelum ngoding** |
| 4 | `ARCHITECTURE.md` | Ringkasan arsitektur + diagram alur data | Saat mendesain sistem |
| 5 | `docs/03-websocket-protocol.md` | REST + WebSocket contracts | Saat integrasi networking |
| 6 | `CODING_STANDARD.md` | Gaya kode Python/JS/Java | Sebelum menulis kode |
| 7 | `TESTING.md` | Strategi unit/integrasi/manual | Saat testing & QA |
| 8 | `CHANGELOG.md` | Riwayat versi | Sebelum bump versi |
| 9 | `CONTRIBUTING.md` | Alur kontribusi & checklist | Sebelum commit/PR |
| 10 | `docs/adr/` | ADR-001..005 (003/004/005 = v2) | Saat butuh alasan arsitektur |
| 11 | `docs/01..06` | Spesifikasi detail v1 | Referensi teknis |

## Teknologi & Arsitektur

- **Backend Hub**: FastAPI (Python 3.11+) + Uvicorn + WebSockets, port `8095`, systemd (`target-range.service`)
- **TV Display v2**: PixiJS (WebGL2, fallback Canvas 2D) + Vanilla JS + Web Audio API + Speech Synthesis (announcer English)
- **Mobile Controller**: APK Android native (Java, SensorManager `TYPE_ROTATION_VECTOR`, WebSocket)
- **Konektivitas**: Wi-Fi rumah (WLAN, ~3ms) — WireGuard hanya cadangan
- **Struktur**: `server/`, `tv/` (v1), `tv-v2/` (v2), `android-controller-app/`, `android-tv-app/`

## Bahasa

- **Kode, commit, dokumentasi teknis**: English
- **UI TV & error user**: Bahasa Indonesia (v1) — v2 announcer **English** (keputusan final)
- **Interaksi dengan user**: Bahasa Indonesia

## Perintah Umum

```bash
# Server (dev)
cd /home/ubuntu/Github/target-range-tv
./venv/bin/python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8095

# Test server
cd server && ../venv/bin/python -m pytest -q

# Build APK
cd android-controller-app && ./build.sh
cd android-tv-app && ./build.sh

# Deploy TV (ADB)
adb -s 10.10.10.5:5555 install -r android-tv-app/bin/TargetRangeTV-v1.0.apk
adb -s 10.10.10.5:5555 shell am start -n com.danskiv.targetrangetv/.MainActivity
```
