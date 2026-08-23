# CHANGELOG — Range Shooter

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/). Versi mengikuti SemVer (lihat CONVENTIONS).

## [v2.0.0-alpha] — 2026-08-23
### Added
- **TV Frontend v2 (`tv-v2/`)**:
  - Engine render modern berbasis **PixiJS (WebGL2)** dengan auto-fallback Canvas 2D untuk browser TV lawas.
  - Tema visual **Neon Cyber Arena** (palet cyan `#22d3ee` / magenta `#e879f9` / deep space `#0a0f1e`, scanlines murni CSS tanpa filter berat di TV).
  - Sistem target penuh: *Static Node (bullseye rings), Drone Patrol (zigzag/horizontal), Pop-Up Core, Hazard Shield Drone (penalti & reset combo), Energy Cell (blast radius), Mega Bot (wave final)*.
  - Sistem partikel *additive-blending* dengan *object pooling* untuk performa TV tanpa GC stutter (muzzle flash, spark explosion, hit sparks, floating combat text).
  - Layout responsif penuh `100vw/100vh` yang adaptif pada resolusi 720p/1080p/4K tanpa distorsi koordinat.
  - Durasi ronde 120 detik, combo multiplier bertingkat (x1/x2/x3/x5), dan *Local Storage High Score* ranking.
  - Overlay kalibrasi 5-titik affine (`0.05/0.50/0.95`) dengan penyembunyian HUD otomatis.
- **Audio Engine Hybrid (`tv-v2/js/audio.js`)**:
  - Synthesizer prosedural Web Audio API murni (laser sweep, metallic hit ping, explosion noise buffer, reload, tick chimes) tanpa beban aset statis eksternal.
  - Announcer suara **English berkualitas** via Speech Synthesis API ("Three, Two, One, FIRE!", "BULLSEYE!", "Combo x3/x5!", "Time is running out!", "Time's up!").
- **Backend Hub FastAPI (`server/main.py`)**:
  - Endpoint mount `/tv_v2_static` dan routing `/v2` dengan *no-cache headers* ketat dan encoding UTF-8.
  - Endpoint WebSocket controller `/ws/controller/{room_code}` dan `/ws/ctrl/{room_code}` dengan relay instan ke `room.tv_socket` (menjaga aturan 1 slot TV per room).
  - Relay event kalibrasi (`CALIB_START`, `CALIB_DOT`, `CALIB_DONE`) via WebSocket channel.

### Changed (android-controller-app v2.0.0)
- **APK controller v2**: REST polling → **native WebSocket client** (`org.java_websocket.client.WebSocketClient` via `libs/java-websocket.jar`) ke `/ws/controller/{room_code}` (PRD-v2 §6.1/6.3).
- Aim sync via dedicated **WS send queue** (BlockingQueue) + sender thread, throttle ~30Hz (30–60Hz PRD) — tidak pernah memblokir thread sensor.
- Aksi one-shot (TRIGGER_FIRE/RELOAD_ACTION/START_GAME_REQ/CALIB_START/CALIB_DOT/CALIB_DONE) tetap lewat **actionExecutor terpisah** (AUDIT_LOG #2).
- Server events (`haptic`, `HIT_CONFIRMATION`, `GAME_STATE_SYNC`/game over) → `VibrationEffect` haptic di HP.
- **Fallback REST** otomatis bila WebSocket gagal/tutup (badge status "REST FALLBACK"), reconnect otomatis tiap ~2 detik.
- `build.sh`: classpath `libs/java-websocket.jar` **+ `libs/slf4j-api-1.7.30.jar`** (java-websocket 1.5.6 butuh slf4j-api saat runtime) untuk javac + ekstraksi jar & dex penuh via D8.
- AndroidManifest: versionCode 4 / versionName 2.0.0.

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
