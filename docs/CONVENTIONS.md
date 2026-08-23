# CONVENTIONS — Range Shooter (Target Range TV)
**Standar Arsitektur, Aturan Versioning, dan Disiplin Pengembangan**
*Version: v2.0.0-draft*

---

## 1. Aturan Versioning (SemVer 2.0.0)

Format: `MAJOR.MINOR.PATCH` (misal `v0.1.0` -> `v1.0.0`)
- **MAJOR**: Perubahan arsitektur mendasar (migrasi protocol, penggantian engine render — **v2 = PixiJS/WebGL2 + input APK native**).
- **MINOR**: Penambahan fitur baru (mode permainan baru, variasi target baru, sistem multiplayer).
- **PATCH**: Perbaikan bug, kalibrasi matematika sensor gyro, optimasi performa rendering TV.

> **v2: PRD.md (v1) digantikan PRD-v2.md sebagai sumber kebenaran.** ADR-003, ADR-004, ADR-005 mencatat keputusan arsitektur v2. ADR-001 di-SUPERSEDE oleh ADR-003 (web controller gagal di HTTP LAN — sensor butuh secure context).

---

## 2. Struktur Direktori Proyek

```
target-range-tv/
├── AGENTS.md                  # Panduan agen & konteks proyek
├── PRD.md                     # PRD v1 (arsip — sumber kebenaran v1)
├── PRD-v2.md                  # **PRD v2 — sumber kebenaran (Range Shooter v2)**
├── README.md                  # Ringkasan cepat & cara menjalankan
├── docs/
│   ├── CONVENTIONS.md         # Dokumen ini: aturan & disiplin
│   ├── 01-architecture-spec.md# Arsitektur sistem TV-Server-Controller
│   ├── 02-sensor-gyro-math.md # Formula matematika sensor, smoothing LERP, drift guard
│   ├── 03-websocket-protocol.md# Skema payload WebSocket & event contracts
│   ├── 04-bugs-and-pitfalls.md# Analisis mendalam potensi bug, edge cases, & mitigasi
│   ├── 05-game-loop-and-states.md# Diagram state machine & alur permainan
│   ├── 06-test-plan.md        # Rencana pengujian (unit, latency, hardware, gyro)
│   └── adr/
│       ├── ADR-001-websocket-lan-zero-install.md  # SUPERSEDED oleh ADR-003
│       ├── ADR-002-lerp-pointer-smoothing-client-side.md
│       ├── ADR-003-native-apk-input.md            # v2: input APK native (bukan web)
│       ├── ADR-004-pixijs-renderer.md             # v2: renderer WebGL2
│       └── ADR-005-affine-calibration-drift.md    # v2: kalibrasi 5-titik + drift
├── server/                    # Backend FastAPI Hub (WebSocket + Static Server)
│   ├── main.py
│   ├── room_manager.py
│   └── game_state.py
├── tv/                        # Frontend Layar TV v1 (Canvas 2D vanilla)
├── tv-v2/                     # **Frontend Layar TV v2 (PixiJS WebGL2 + Neon Cyber Arena)**
├── android-controller-app/    # APK pengendali HP (SensorManager + WebSocket)
├── android-tv-app/            # APK wrapper WebView untuk TV
└── controller/                # (arsip v1 — web controller, TIDAK dipakai input)
```

---

## 3. Disiplin Rekayasa Perangkat Lunak (Engineering Disciplines)

1. **Strict Zero-Install Principle**: HP Controller TIDAK BOLEH mewajibkan instalasi aplikasi native APK. Harus 100% berjalan di mobile browser modern via standar HTML5 (`DeviceMotionEvent`, `DeviceOrientationEvent`, `Vibration API`).
2. **TV CPU/RAM Budget**: TV pintar memiliki spesifikasi rendah. Rendering di TV dilarang menggunakan framework berat (React/Vue). Gunakan **Pure Vanilla JS + HTML5 Canvas 2D**.
3. **Payload Throttling**: Pengiriman data sensor dari HP ke WebSocket server dibatasi (*throttled*) maksimal **60 Hz** (interval $\approx 16.6$ ms) atau **30 Hz** (interval $\approx 33.3$ ms) untuk mencegah flooding jaringan Wi-Fi lokal.
4. **Authoritative Server / Client Prediction**:
   - Deteksi tabrakan tembakan (*Hit Detection*) dihitung di sisi TV / Server dengan bounding box yang adil.
   - Controller hanya mengirim sinyal *FIRE* beserta timestamp dan koordinat bidikan saat pelatuk ditekan.
5. **No Floats in Money/Points**: Semua skor dan poin menggunakan `Integer`.
6. **Bilingual Principle**:
   - Kode, commit, dokumentasi teknis, dan variabel: **English**.
   - UI TV, UI Controller HP, panduan suara (announcer): **Bahasa Indonesia**.
