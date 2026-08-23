# NEXT_SESSION_HANDOFF.md — Handoff Sesi Range Shooter v2

> **Tujuan Dokumen**: Memastikan sesi baru dapat langsung melanjutkan pembangunan Range Shooter v2 tanpa kehilangan konteks, tanpa halusinasi, dan hemat token.

---

## 📌 Status Terakhir Proyek (v2.0.0-alpha Siap Eksekusi)
- **Repositori**: `/home/ubuntu/Github/target-range-tv` (GitHub: `danskiv/target-range-tv`, branch `main`, public).
- **Hasil Uji Empiris v1**:
  - Topologi Wi-Fi WLAN rumah (`10.225.156.x`) terbukti latensi ~3ms (TV ↔ Laptop ↔ HP). AP Isolation di router sudah dinonaktifkan.
  - APK native dengan `SensorManager` (Rotation Vector) bekerja mulus tanpa izin runtime.
  - Kalibrasi 5-titik affine (`0.05` dan `0.95` pojok sejati, `0.50` tengah) terverifikasi sinkron antara TV dan APK.
  - TV MiTV 720p memerlukan layout responsif (`100vw`/`100vh`).
- **Keputusan Final PRD v2 (APPROVED)**:
  - **Nama**: *Range Shooter*
  - **Tema**: *Neon Cyber Arena* (cyan/magenta glow, dark arena)
  - **Durasi Ronde**: 120 detik
  - **Announcer**: Audio synth + English voice synthesis premium
  - **Penyimpanan Skor**: `localStorage` TV (alpha)
  - **Input Controller**: APK Native WebSocket (menggantikan REST v1)
  - **Renderer TV**: PixiJS (WebGL2 dengan fallback Canvas 2D)

---

## 🚀 Rencana Eksekusi Sesi Baru (Sub-Agent Orchestration v2-Alpha)

Sesi baru akan mengeksekusi pembangunan v2-alpha secara paralel menggunakan 4 worker (`delegate_task`):

1. **Worker A (TV Frontend - PixiJS Engine)**:
   - Membuat direktori `tv-v2/` dengan PixiJS (WebGL2 / Canvas fallback).
   - Tema Neon Cyber Arena, grid animasi, responsive viewport.
   - Sistem target: Node Statis, Drone Patrol, target pop-up.
   - HUD minimalis (timer 120s, combo multiplier, score, room code).
   - Mode kalibrasi overlay 5-titik (sembunyikan HUD saat kalibrasi).

2. **Worker B (TV Audio & Announcer)**:
   - Membuat `tv-v2/js/audio.js` (Web Audio API synth untuk laser/hit/explosion/reload).
   - Integrasi Web Speech API (English voice announcer untuk countdown "Three, Two, One, FIRE!", "Bullseye!", "Combo!", "Time's up!").

3. **Worker C (Backend Server Hub)**:
   - Update `server/main.py` dan `server/room_manager.py` untuk melayani rute `/v2` (statis `tv-v2/`).
   - Endpoint WebSocket khusus controller: `/ws/ctrl/{room_code}` (menerima aim vector 60Hz, action fire/reload/calib).
   - Relay otomatis ke `room.tv_socket` (pertahankan aturan: 1 slot TV per room).

4. **Worker D (Android Controller APK v2)**:
   - Update `android-controller-app/src/.../MainActivity.java` dari REST polling ke WebSocket client (`org.java_websocket.client.WebSocketClient` via `libs/java-websocket.jar`).
   - Pertahankan pemisahan `actionExecutor` dan thread sensor.
   - Pertahankan kalibrasi 5-titik affine + guard `isTransformGood()`.

---

## 🛑 Aturan & Pantangan Mutlak (Jangan Dilanggar)
1. **Baca `AUDIT_LOG.md` & `PRD-v2.md` sebelum menyentuh kode.**
2. **Dilarang hardcode resolusi** (TV MiTV adalah 1280x720, selalu gunakan `100vw`/`100vh` adaptif).
3. **Satu slot TV per room** (`room.tv_socket`), jangan biarkan observer mencuri slot TV.
4. **Koordinat kalibrasi harus sinkron** TV ↔ APK (`0.05`, `0.50`, `0.95`).
5. **Setiap perubahan file statis wajib bump cache-bust `?v=`** dan update badge versi.
6. **Konsistensi dokumen**: update `CHANGELOG.md` dan dokumen terkait di setiap commit.
