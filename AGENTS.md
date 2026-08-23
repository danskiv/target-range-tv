# AGENTS.md — Target Range TV (CyberShooter / RangeMaster)

Selamat datang, engineer/agent. Ini proyek **Target Range TV** — game latihan menembak multi-layar interaktif (Android TV sebagai display utama + HP Android sebagai air-mouse motion controller).

## Aturan Dasar

1. **PRD.md & docs/CONVENTIONS.md adalah sumber kebenaran tertinggi.** Baca kedua dokumen tersebut sebelum mengubah arsitektur atau kode.
2. **Strict Zero-Install Controller.** Kontroller di HP berjalan 100% via mobile browser (HTML5 DeviceOrientation + WebSocket). Dilarang membuat dependensi yang mewajibkan instalasi APK di sisi pemain kecuali untuk wrapper Android TV wrapper jika dibutuhkan nanti.
3. **Optimasi TV Rendah Daya.** Android TV memiliki RAM dan GPU terbatas. Hindari DOM bloat, heavy blur CSS, dan memory leak. Wajib gunakan *Object Pooling* pada rendering Canvas 2D.
4. **Kalibrasi & Anti-Drift.** Semua implementasi sensor harus menyertakan mekanisme kalibrasi titik nol (*Re-Center*) yang mudah diakses pemain.

## Panduan Navigasi Dokumen

| # | Dokumen | Isi Utama | Kapan Dibaca |
|---|---|---|---|
| 1 | `PRD.md` | Visi produk, mekanik game, variasi sasaran, roadmap (v1.0.0) | **Wajib — pertama kali** |
| 2 | `docs/CONVENTIONS.md` | Standar kode, SemVer, struktur direktori, prinsip rekayasa | **Wajib — kedua** |
| 3 | `docs/01-architecture-spec.md` | Arsitektur topologi jaringan TV-Hub-Controller | Saat mendesain sistem |
| 4 | `docs/02-sensor-gyro-math.md` | Kalkulasi sudut, LERP smoothing, deadzone, clamping | Saat mengutak-atik gyro |
| 5 | `docs/03-websocket-protocol.md` | Format payload event real-time (Lobby, Gun, Score) | Saat integrasi networking |
| 6 | `docs/04-bugs-and-pitfalls.md` | 8 Analisis kritis potensi bug hardware/sensor/network | Saat debugging & testing |
| 7 | `docs/05-game-loop-and-states.md` | State machine permainan (Lobby, Playing, Game Over) | Saat mengelola alur game |
| 8 | `docs/06-test-plan.md` | 20+ skenario uji fungsional, latensi, dan performa | Saat testing & QA |
| 9 | `docs/adr/` | Rekaman keputusan arsitektur (ADR-001, ADR-002) | Saat butuh alasan arsitektur |

## Teknologi & Arsitektur

- **Backend Hub**: FastAPI (Python 3.12) + Uvicorn + WebSockets
- **TV Display**: HTML5 Canvas 2D + Vanilla JavaScript + Web Audio API (60 FPS low-overhead)
- **Mobile Controller**: HTML5 `DeviceOrientationEvent` + `Vibration API` + Tailwind/Modern CSS
- **Konektivitas**: Local Wi-Fi (LAN) / 5 GHz Network

## Bahasa

- **Kode & Dokumentasi Teknis**: English
- **UI Display TV & Controller HP**: Bahasa Indonesia
