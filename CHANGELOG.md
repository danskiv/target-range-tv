# CHANGELOG — Range Shooter

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/). Versi mengikuti SemVer (lihat CONVENTIONS).

## [Unreleased / v2.0.0-alpha — in progress]
### Added
- Scaffold `/v2`: PixiJS (WebGL2 + fallback Canvas 2D), tema Neon Cyber Arena
- Target dasar: Node Statis + Drone Patrol
- Input APK WebSocket (`/ws/ctrl/{room}`)
- HUD v2, announcer English, partikel
- Dokumentasi v2: PRD-v2 (APPROVED), ADR-003/004/005, OVERVIEW, ARCHITECTURE, CONTRIBUTING, TESTING, AUDIT_LOG, dll.

## [v1.3.3] — 2026-08-23
### Fixed
- **Responsive canvas**: layout hardcode 1920x1080 menyalahi TV 720p — semua koordinat bergeser. Kini `100vw/100vh` mengikuti viewport aktual.
- HUD disembunyikan selama kalibrasi (layar bersih).
- Label "TITIK N/5" pintar: geser otomatis agar tidak terpotong di pojok mana pun.
- Radius dot kalibrasi dibatasi agar utuh di pojok (≤32 px).
- Cache-bust bump `v1.3.3`.

## [v1.3.2] — 2026-08-23
### Changed
- Titik kalibrasi dipindah ke **pojok sejati** (0.05/0.95, dari 0.12/0.88) — sinkron TV & APK.

## [v1.3.1] — 2026-08-23
### Fixed
- Hide lobby overlay saat kalibrasi (titik kuning tertutup lobby).
- Badge versi + cache-bust `v1.3.1`; charset UTF-8.

## [v1.3.0] — 2026-08-23
### Added
- 5-point affine calibration (kalibrasi tengah + 4 pojok; transformasi 6 parameter).
- Cache-bust script tags + version badge.
- Guard kalibrasi: tolak transform degenerate (bad fit / all-zero).

## [v1.2.0] — 2026-08-23
### Added
- Auto-reconnect WebSocket TV (`connectSocket`).
- **Action executor terpisah** di APK (perbaikan: executor tunggal dimonopoli aim loop → aksi one-shot kelaparan).
- Dukungan IP LAN (deteksi `server_ip`).

## [v1.0.0] — 2026-08-21
### Added
- MVP Target Range TV: FastAPI hub :8095, TV Canvas 2D, APK controller REST, room TG##, kalibrasi titik-nol, target dasar.

---

*Pelajaran yang dicatat di AUDIT_LOG.md — bukan hanya apa yang berubah, tapi mengapa.*
