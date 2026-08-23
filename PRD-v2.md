# PRD — Range Shooter
**Product Requirements Document**
*Version: v2.0.0 — Status: APPROVED (keputusan final 2026-08-23)*
*Repositori: danskiv/target-range-tv (branch `main`) — v2 dibangun di atas fondasi v1 yang sudah teruji*

---

## 1. Executive Summary & Vision

**Range Shooter** adalah evolusi dari *Target Range TV*: game multi-layar *arcade shooting range* bergenre **Neon Cyber Arena** dengan fokus **engine & visual modern** (WebGL2 + partikel + audio) yang berjalan di **Android TV** dengan pengendali **HP Android native (APK)**.

- **Layar TV (Android TV / MiTV)**: Arena tembak futuristik neon, rendering **WebGL2 via PixiJS** (fallback Canvas 2D), partikel ledakan, *glow bloom*, target bergerak cerdas, HUD minimalis, dan announcer suara **English berkualitas**.
- **Pengendali (HP Android)**: APK native memanfaatkan **SensorManager (rotation vector)** — terbukti empiris tanpa izin runtime, stabil di jaringan HTTP LAN (berbeda dengan web controller yang gagal karena *secure context*).
- **Latensi**: Server lokal di laptop/TV via Wi-Fi rumah (WLAN), target <15 ms; topologi WLAN (bukan WireGuard) sudah terbukti 3 ms antar-perangkat.

**Perbedaan fundamental dari v1:**
| Aspek | v1 (Target Range TV) | v2 (Range Shooter) |
|---|---|---|
| Renderer | Canvas 2D vanilla | **PixiJS WebGL2** + fallback Canvas 2D |
| Tema | Dark blue generic | **Neon Cyber Arena** (cyan/magenta glow, grid, scanlines) |
| Audio | SFX dasar | **Hybrid**: Web Audio synth + **speech announcer** (TTS) |
| Input | APK REST + web controller (gagal) | **APK native WebSocket** (satu jalur, teruji) |
| Kalibrasi | 5-titik affine statis | 5-titik affine + **drift-damping otomatis** + kurva sensitivitas |
| Protocol | JSON REST/WS | JSON WebSocket (riset **MessagePack** untuk fase 2) |
| Server | Laptop ad-hoc | **systemd** (auto-restart) di laptop + NODIX1 cadangan |

---

## 2. Target Pengguna & Perangkat (realita terverifikasi)

| Entitas | Perangkat | Lingkungan / Resolusi | Fakta teruji (2026-08-23) |
|---|---|---|---|
| **Layar TV** | MiTV (Xiaomi) `com.danskiv.targetrangetv` (WebView) | **1280x720** @ 16:9 (WebView) | Layout v1 hardcode 1920x1080 **SALAH** → v2 **wajib responsif** (fill viewport, `100vw/100vh`) |
| **Pengendali** | HP Android (APK native) | Portrait, 60–120 Hz | `TYPE_ROTATION_VECTOR` tanpa izin runtime; APK vestigial REST → **v2 WebSocket** |
| **Server Hub** | Laptop HUAWEI (Windows) / NODIX1 (Ubuntu) | Wi-Fi rumah (WLAN `10.225.156.x`) | WLAN antar-perangkat **3 ms**; WireGuard 54–62 ms (cadangan saja) |
| **Jaringan** | Router rumah | AP isolation **WAJIB nonaktif** | Tanpa itu TV↔HP tidak bisa saling jangkau |

---

## 3. Game Loop & Core Mechanics

### 3.1. Session Flow (v2)
1. **TV nyala** → app WebView membuka `/v2` → server systemd siap → Room Code otomatis (mis. `RS42`).
2. **Pairing**: HP (APK) deteksi server via `/api/info` → join room terbaru (satu room per sesi, bukan acak tiap refresh — warisan fix v1).
3. **Kalibrasi 5 titik** (wajib saat pertama / opsional ulang kapan saja): TITIK 1/5 tengah → 4 pojok (0.05/0.95 normalized) → transformasi affine 6-parameter tersimpan per HP (`SharedPreferences "range_calib"`).
4. **Countdown 3-2-1-FIRE** → ronde **120 detik** (keputusan final).
5. **Gameplay**: bidik via gerakan HP (rotation vector → affine → koordinat layar), tembak via tap layar HP (getar haptic), reload via tombol/gesture.
6. **Ronde selesai** → ringkasan: skor, akurasi, combo tertinggi, gelar → tombol main lagi.

### 3.2. Target Taxonomy (v2 — Neon Cyber Arena)
| Tipe Target | Pola | Poin | Efek |
|---|---|---|---|
| **Node Statis** | Diam di posisi grid | 10/25/100 (bullseye) | Hilang 3 detik jika luput |
| **Drone Patrol** | Bergerak horizontal/zigzag, kecepatan naik per wave | 50 | Partikel percikan neon |
| **Hover Turret** | Melayang parabola/lingkaran | 150 | Menuntut *leading shot* |
| **Pop-Up Core** | Muncul mendadak 1.5 detik | 80 | Refleks seketika |
| **Shield Drone (Hazard)** | Berlindung di samping target | **-100 & reset combo** | Penalti jika tertembak |
| **Energy Cell** | Statis di tengah gerombolan | 50 + ledakan radius | Menghancurkan target radius 200px |
| **Mega Bot (wave final)** | Dinamis, health bar 500 HP | 1.000 bonus | Butuh tembakan bertubi |

### 3.3. Skor & Combo (dipetakan dari v1, integer murni)
- 1–4 hit: `1x` · 5–9: `2x` · 10–19: `3x` · 20+: `5x`
- Miss → combo reset ke `1x`
- Akurasi ≥85% akhir ronde: bonus +500

---

## 4. Tema & Identitas Visual — Neon Cyber Arena

- **Palet**: OKLCH berbasis `cyan (#22d3ee)` + `magenta (#e879f9)` + deep space `#0a0f1e`; glow via PixiJS filter (Bloom/Glow) — hindari CSS filter (mahal di TV).
- **Elemen**: grid perspektif bergerak, scanline halus, partikel ledakan (additive blending), muzzle flash, trail crosshair.
- **HUD**: minimal — timer, combo, skor, room code; tersembunyi saat kalibrasi (warisan v1.3.3).
- **Anti-slop (hallmark)**: kohesi tema ketat, tipografi display + sans, mikro-animasi target, tidak ada placeholder kosong.
- **Resolusi**: responsif penuh (`100vw/100vh`) — canvas mengikuti viewport TV (720p/1080p/4K).

---

## 5. Audio Design (Hybrid)

| Lapisan | Teknologi | Isi |
|---|---|---|
| **SFX synth** | Web Audio API (oscillator + noise buffer) | Tembakan, hit, miss, reload, countdown, ronde selesai |
| **Announcer** | Speech Synthesis API — **suara English berkualitas** (keputusan final; voice premium dipilih dari daftar TTS) | "Three… two… one… FIRE!", "BULLSEYE!", "Combo x3!", "Time's up!" |
| **Haptic HP** | APK `VibrationEffect` | Recoil pendek saat tembak, denyut kuat saat hit |

Aturan: audio **tidak boleh** memblokir frame render (dipisah thread/queue); master volume + mute toggle.

---

## 6. Arsitektur Teknis

### 6.1. Stack
- **Server**: FastAPI + Uvicorn (systemd di laptop, NODIX1 cadangan), port `8095` — dipertahankan dari v1.
- **TV**: PixiJS v8 (WebGL2, auto-fallback Canvas 2D bila WebGL tidak tersedia), Vanilla JS modular.
- **Controller**: APK Android Java — `TYPE_ROTATION_VECTOR`, WebSocket client (bukan REST — v2), `SharedPreferences` kalibrasi.
- **Protocol**: JSON via WebSocket; **riset MessagePack** (payload ~30–50% lebih kecil) untuk fase 2, tetap dengan fallback JSON.

### 6.2. Prinsip yang WAJIB dipertahankan (terbukti dari v1)
1. **Satu slot TV per room** — jangan pernah pasang observer/klien kedua di `room.tv_socket` (TV jadi tuli).
2. **Responsive canvas** — jangan pernah hardcode resolusi (1920x1080 menyalahi layar 720p).
3. **Cache-bust `?v=` + no-cache headers + badge versi** — perang melawan cache WebView TV.
4. **Kalibrasi berkualitas**: tolak transform degenerate (`isTransformGood`), koordinat 0.05/0.95 konsisten di TV & APK.
5. **Action executor terpisah dari aim loop** di APK (monopoli executor = aksi kelaparan).
6. **AP isolation router harus nonaktif** untuk topologi WLAN.
7. **Server-side rooms**: satu room per sesi, TV join room terbaru dari `/api/info`.

### 6.3. Pesan WebSocket (v2, backward-compatible dengan v1)
- TV→Server: `ROOM_READY`, `PLAYER_JOINED`, `PLAYER_LEFT`
- HP→Server: `{type:"aim", x, y, player_id}` (throttle 30–60 Hz), `{type:"action", action:"fire"|"reload"|"start_game"|"calib_start"|"calib_dot"|"calib_done"}`
- Server→TV: relay + `CALIB_START`/`CALIB_DOT`/`CALIB_DONE`, `START_GAME_REQ`, `TRIGGER_FIRE`, `RELOAD_ACTION`, `GAME_OVER`
- **BARU v2**: `{type:"settings", sensitivity, deadzone}` (per pemain), `{type:"haptic", pattern}` (server→HP untuk feedback hit)

---

## 7. Input & Kalibrasi (v2)

1. **APK native WebSocket** — satu-satunya jalur input (web controller mati di HTTP LAN karena *secure context*; keputusan ini menggantikan ADR-001).
2. **Kalibrasi 5 titik affine** — tengah + 4 pojok (0.05/0.95), transformasi 6 parameter menyerap inversi sumbu & grip bebas (vertikal/layar-kiri).
3. **Drift-damping otomatis** — deteksi drift statis (HP diam tapi crosshair bergerak) → koreksi perlahan; guard transform degenerate.
4. **Deadzone + kurva sensitivitas** — deadzone sudut <0.10°, kurva non-linear opsional untuk mikro-aim.
5. **Profil per pemain** — tersimpan per HP; kalibrasi ulang kapan saja dari tombol APK.

---

## 8. Mode Permainan (fase berikutnya setelah engine inti)

1. **Solo Range Training** — rekor pribadi (high score lokal).
2. **Co-op Wave Defense** — 2–4 pemain, gelombang sebelum waktu habis.
3. **Versus 1v1 Quick Duel** — berebut skor pada target bersama.

---

## 9. Roadmap Rilis

| Versi | Isi | Kriteria Selesai |
|---|---|---|
| **v2.0.0-alpha** | Scaffold `/v2`: PixiJS renderer, Neon Cyber Arena, target dasar (node + drone), input APK WebSocket | Bisa main 1 ronde di TV, crosshair mengikuti, hit terdeteksi |
| **v2.0.0-beta** | Partikel penuh, audio hybrid + announcer English, kalibrasi drift-damping, kurva sensitivitas, HUD v2 | Main 120 detik stabil tanpa lag; kalibrasi ulang mulus |
| **v2.0.0-gold** | Mode solo + leaderboard (LocalStorage TV), haptic penuh, dokumentasi + deploy systemd | UAT di TV 720p & laptop; repo public, CI hijau |
| **v2.1.0** | Co-op wave, versus 1v1, multi-profile | Multiplayer 2+ pemain |

---

## 10. Keputusan Final (dikunci 2026-08-23)

| # | Aspek | Keputusan |
|---|---|---|
| 1 | **Nama** | **Range Shooter** (dikunci) |
| 2 | **Tema** | **Neon Cyber Arena** (cyan/magenta glow, grid perspektif) |
| 3 | **Durasi ronde** | **120 detik** |
| 4 | **Announcer** | **English berkualitas** (Speech Synthesis, voice premium — bukan Bahasa Indonesia) |
| 5 | **MessagePack** | **Tunda ke fase 2** — JSON cukup di LAN 3ms; relevan hanya untuk 4+ pemain |
| 6 | **High score** | **LocalStorage TV** (alpha) — SQLite server menyusul saat multiplayer |

---

*Status: APPROVED — keputusan final terkunci. Eksekusi dapat dimulai.*
